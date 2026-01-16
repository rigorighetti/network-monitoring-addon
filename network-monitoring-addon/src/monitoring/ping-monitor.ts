/**
 * Ping monitoring component for continuous ICMP ping execution
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { PingTarget, PingResult } from '../types';
import { logger } from '../utils/logger';
import { ErrorHandler, NetworkMonitoringError, ErrorCategory, ErrorSeverity } from '../error-handling';
import { PingScheduler } from './scheduler';

export class PingMonitor extends EventEmitter {
  private targets: Map<string, PingTarget> = new Map();
  private scheduler: PingScheduler;
  private isRunning = false;
  private errorHandler: ErrorHandler;
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(errorHandler?: ErrorHandler) {
    super();
    this.errorHandler = errorHandler || new ErrorHandler();
    this.scheduler = new PingScheduler();

    // Listen to scheduler events
    this.scheduler.on('task:execute', (event) => {
      if (event.type === 'ping') {
        this.executePing(event.target as PingTarget);
      }
    });

    this.scheduler.on('task:error', (event) => {
      logger.error(`Scheduler error for ping task ${event.taskId}:`, event.error);
    });
  }

  /**
   * Start continuous monitoring for all configured targets
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('PingMonitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting ping monitoring with scheduler');

    // Start the scheduler with current targets
    this.scheduler.updateTargets(Array.from(this.targets.values()));
    this.scheduler.start();
  }

  /**
   * Stop all monitoring activities
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping ping monitoring');
    this.isRunning = false;

    // Stop the scheduler
    this.scheduler.stop();
  }

  /**
   * Update monitoring targets without restart
   */
  updateTargets(targets: PingTarget[]): void {
    logger.info(`Updating ping targets: ${targets.length} targets`);

    // Update targets map
    this.targets.clear();
    for (const target of targets) {
      this.targets.set(target.name, target);
    }

    // Update scheduler with new targets
    this.scheduler.updateTargets(targets);
  }

  /**
   * Get current targets
   */
  getTargets(): PingTarget[] {
    return Array.from(this.targets.values());
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus(): ReturnType<PingScheduler['getStatus']> {
    return this.scheduler.getStatus();
  }

  /**
   * Execute a single ping test (called by scheduler)
   */
  public async executePing(target: PingTarget): Promise<void> {
    try {
      const result = await this.performPing(target);
      
      // Reset consecutive failures on success
      if (result.success) {
        this.consecutiveFailures.set(target.name, 0);
      } else {
        const failures = (this.consecutiveFailures.get(target.name) || 0) + 1;
        this.consecutiveFailures.set(target.name, failures);
        
        // Handle consecutive failures
        if (failures >= 3) {
          await this.errorHandler.handleTemporaryFailure(
            'ping_execution',
            target.address,
            new Error(`${failures} consecutive ping failures`),
            'PingMonitor',
            failures
          );
        }
      }
      
      this.emit('result', result);
      logger.debug(`Ping result for ${target.name}: ${result.success ? `${result.response_time_ms}ms` : 'failed'}`);
    } catch (error) {
      const failures = (this.consecutiveFailures.get(target.name) || 0) + 1;
      this.consecutiveFailures.set(target.name, failures);
      
      // Handle network tool failure
      await this.errorHandler.handleNetworkToolFailure(
        'ping',
        target.address,
        error instanceof Error ? error : new Error('Unknown ping error'),
        failures
      );
      
      const result: PingResult = {
        timestamp: new Date(),
        target_name: target.name,
        target_address: target.address,
        response_time_ms: null,
        packet_loss_percent: 100,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('result', result);
      logger.error(`Ping failed for ${target.name}: ${result.error_message}`);
    }
  }

  /**
   * Perform the actual ping operation
   */
  private performPing(target: PingTarget): Promise<PingResult> {
    return new Promise((resolve, reject) => {
      // Use platform-appropriate ping command
      const isWindows = process.platform === 'win32';
      const pingCmd = isWindows ? 'ping' : 'ping';
      const pingArgs = isWindows 
        ? ['-n', '4', target.address] // Windows: 4 packets
        : ['-c', '4', target.address]; // Unix: 4 packets

      let pingProcess: any;
      
      try {
        pingProcess = spawn(pingCmd, pingArgs);
      } catch (spawnError) {
        reject(new NetworkMonitoringError(
          `Failed to spawn ping process: ${spawnError instanceof Error ? spawnError.message : 'Unknown error'}`,
          ErrorCategory.NETWORK_TOOL,
          ErrorSeverity.HIGH,
          'PingMonitor',
          target.address,
          { command: pingCmd, args: pingArgs }
        ));
        return;
      }

      let stdout = '';
      let stderr = '';

      pingProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pingProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pingProcess.on('close', (code: number) => {
        try {
          const result = this.parsePingOutput(target, stdout, stderr, code === 0);
          resolve(result);
        } catch (error) {
          reject(new NetworkMonitoringError(
            `Failed to parse ping output: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ErrorCategory.NETWORK_TOOL,
            ErrorSeverity.MEDIUM,
            'PingMonitor',
            target.address,
            { stdout, stderr, exitCode: code }
          ));
        }
      });

      pingProcess.on('error', (error: Error) => {
        reject(new NetworkMonitoringError(
          `Ping process error: ${error.message}`,
          ErrorCategory.NETWORK_TOOL,
          ErrorSeverity.HIGH,
          'PingMonitor',
          target.address,
          { command: pingCmd, args: pingArgs, originalError: error.message }
        ));
      });

      // Set timeout for ping operation (default 15 seconds to allow for network delays)
      const timeout = setTimeout(() => {
        if (pingProcess && !pingProcess.killed) {
          pingProcess.kill('SIGTERM');
          
          // Force kill after 2 seconds if still running
          setTimeout(() => {
            if (pingProcess && !pingProcess.killed) {
              pingProcess.kill('SIGKILL');
            }
          }, 2000);
        }
        
        reject(new NetworkMonitoringError(
          'Ping operation timed out after 15 seconds',
          ErrorCategory.TEMPORARY_FAILURE,
          ErrorSeverity.MEDIUM,
          'PingMonitor',
          target.address,
          { timeout_seconds: 15 }
        ));
      }, 15000);

      // Clear timeout when process completes
      pingProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse ping command output to extract metrics
   */
  private parsePingOutput(target: PingTarget, stdout: string, stderr: string, success: boolean): PingResult {
    const timestamp = new Date();
    
    if (!success || stderr) {
      return {
        timestamp,
        target_name: target.name,
        target_address: target.address,
        response_time_ms: null,
        packet_loss_percent: 100,
        success: false,
        error_message: stderr || 'Ping command failed'
      };
    }

    try {
      // Parse response time and packet loss from output
      const { responseTime, packetLoss } = this.extractPingMetrics(stdout);
      
      return {
        timestamp,
        target_name: target.name,
        target_address: target.address,
        response_time_ms: responseTime,
        packet_loss_percent: packetLoss,
        success: packetLoss < 100,
        ...(packetLoss === 100 && { error_message: 'All packets lost' })
      };
    } catch (error) {
      return {
        timestamp,
        target_name: target.name,
        target_address: target.address,
        response_time_ms: null,
        packet_loss_percent: 100,
        success: false,
        error_message: `Failed to parse ping output: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract response time and packet loss from ping output
   */
  private extractPingMetrics(output: string): { responseTime: number | null; packetLoss: number } {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      return this.parseWindowsPingOutput(output);
    } else {
      return this.parseUnixPingOutput(output);
    }
  }

  /**
   * Parse Windows ping output
   */
  private parseWindowsPingOutput(output: string): { responseTime: number | null; packetLoss: number } {
    // Extract packet loss percentage
    const lossMatch = output.match(/\((\d+)% loss\)/);
    const packetLoss = lossMatch && lossMatch[1] ? parseInt(lossMatch[1], 10) : 100;

    // Extract average response time
    let responseTime: number | null = null;
    const timeMatch = output.match(/Average = (\d+)ms/);
    if (timeMatch && timeMatch[1]) {
      responseTime = parseInt(timeMatch[1], 10);
    }

    return { responseTime, packetLoss };
  }

  /**
   * Parse Unix ping output
   */
  private parseUnixPingOutput(output: string): { responseTime: number | null; packetLoss: number } {
    // Extract packet loss percentage
    const lossMatch = output.match(/(\d+)% packet loss/);
    const packetLoss = lossMatch && lossMatch[1] ? parseInt(lossMatch[1], 10) : 100;

    // Extract average response time from statistics line
    // Supports multiple formats:
    // - round-trip min/avg/max = 14.307/14.451/14.743 ms (Alpine/BusyBox)
    // - rtt min/avg/max/mdev = 3.319/3.393/3.500/0.070 ms (GNU/Linux)
    // - min/avg/max/stddev = 14.307/14.451/14.743/0.123 ms (macOS)
    let responseTime: number | null = null;
    const statsMatch = output.match(/(?:rtt |round-trip |)min\/avg\/max(?:\/(?:mdev|stddev))? = [\d.]+\/([\d.]+)\/[\d.]+/);
    
    if (statsMatch && statsMatch[1]) {
      responseTime = parseFloat(statsMatch[1]);
    }

    return { responseTime, packetLoss };
  }
}