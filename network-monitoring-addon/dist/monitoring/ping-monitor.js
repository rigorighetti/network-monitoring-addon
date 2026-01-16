"use strict";
/**
 * Ping monitoring component for continuous ICMP ping execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingMonitor = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const error_handling_1 = require("../error-handling");
const scheduler_1 = require("./scheduler");
class PingMonitor extends events_1.EventEmitter {
    constructor(errorHandler) {
        super();
        this.targets = new Map();
        this.isRunning = false;
        this.consecutiveFailures = new Map();
        this.errorHandler = errorHandler || new error_handling_1.ErrorHandler();
        this.scheduler = new scheduler_1.PingScheduler();
        // Listen to scheduler events
        this.scheduler.on('task:execute', (event) => {
            if (event.type === 'ping') {
                this.executePing(event.target);
            }
        });
        this.scheduler.on('task:error', (event) => {
            logger_1.logger.error(`Scheduler error for ping task ${event.taskId}:`, event.error);
        });
    }
    /**
     * Start continuous monitoring for all configured targets
     */
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('PingMonitor is already running');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting ping monitoring with scheduler');
        // Start the scheduler with current targets
        this.scheduler.updateTargets(Array.from(this.targets.values()));
        this.scheduler.start();
    }
    /**
     * Stop all monitoring activities
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        logger_1.logger.info('Stopping ping monitoring');
        this.isRunning = false;
        // Stop the scheduler
        this.scheduler.stop();
    }
    /**
     * Update monitoring targets without restart
     */
    updateTargets(targets) {
        logger_1.logger.info(`Updating ping targets: ${targets.length} targets`);
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
    getTargets() {
        return Array.from(this.targets.values());
    }
    /**
     * Get scheduler status
     */
    getSchedulerStatus() {
        return this.scheduler.getStatus();
    }
    /**
     * Execute a single ping test (called by scheduler)
     */
    async executePing(target) {
        try {
            const result = await this.performPing(target);
            // Reset consecutive failures on success
            if (result.success) {
                this.consecutiveFailures.set(target.name, 0);
            }
            else {
                const failures = (this.consecutiveFailures.get(target.name) || 0) + 1;
                this.consecutiveFailures.set(target.name, failures);
                // Handle consecutive failures
                if (failures >= 3) {
                    await this.errorHandler.handleTemporaryFailure('ping_execution', target.address, new Error(`${failures} consecutive ping failures`), 'PingMonitor', failures);
                }
            }
            this.emit('result', result);
            logger_1.logger.debug(`Ping result for ${target.name}: ${result.success ? `${result.response_time_ms}ms` : 'failed'}`);
        }
        catch (error) {
            const failures = (this.consecutiveFailures.get(target.name) || 0) + 1;
            this.consecutiveFailures.set(target.name, failures);
            // Handle network tool failure
            await this.errorHandler.handleNetworkToolFailure('ping', target.address, error instanceof Error ? error : new Error('Unknown ping error'), failures);
            const result = {
                timestamp: new Date(),
                target_name: target.name,
                target_address: target.address,
                response_time_ms: null,
                packet_loss_percent: 100,
                success: false,
                error_message: error instanceof Error ? error.message : 'Unknown error'
            };
            this.emit('result', result);
            logger_1.logger.error(`Ping failed for ${target.name}: ${result.error_message}`);
        }
    }
    /**
     * Perform the actual ping operation
     */
    performPing(target) {
        return new Promise((resolve, reject) => {
            // Use platform-appropriate ping command
            const isWindows = process.platform === 'win32';
            const pingCmd = isWindows ? 'ping' : 'ping';
            const pingArgs = isWindows
                ? ['-n', '4', target.address] // Windows: 4 packets
                : ['-c', '4', target.address]; // Unix: 4 packets
            let pingProcess;
            try {
                pingProcess = (0, child_process_1.spawn)(pingCmd, pingArgs);
            }
            catch (spawnError) {
                reject(new error_handling_1.NetworkMonitoringError(`Failed to spawn ping process: ${spawnError instanceof Error ? spawnError.message : 'Unknown error'}`, error_handling_1.ErrorCategory.NETWORK_TOOL, error_handling_1.ErrorSeverity.HIGH, 'PingMonitor', target.address, { command: pingCmd, args: pingArgs }));
                return;
            }
            let stdout = '';
            let stderr = '';
            pingProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            pingProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            pingProcess.on('close', (code) => {
                try {
                    const result = this.parsePingOutput(target, stdout, stderr, code === 0);
                    resolve(result);
                }
                catch (error) {
                    reject(new error_handling_1.NetworkMonitoringError(`Failed to parse ping output: ${error instanceof Error ? error.message : 'Unknown error'}`, error_handling_1.ErrorCategory.NETWORK_TOOL, error_handling_1.ErrorSeverity.MEDIUM, 'PingMonitor', target.address, { stdout, stderr, exitCode: code }));
                }
            });
            pingProcess.on('error', (error) => {
                reject(new error_handling_1.NetworkMonitoringError(`Ping process error: ${error.message}`, error_handling_1.ErrorCategory.NETWORK_TOOL, error_handling_1.ErrorSeverity.HIGH, 'PingMonitor', target.address, { command: pingCmd, args: pingArgs, originalError: error.message }));
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
                reject(new error_handling_1.NetworkMonitoringError('Ping operation timed out after 15 seconds', error_handling_1.ErrorCategory.TEMPORARY_FAILURE, error_handling_1.ErrorSeverity.MEDIUM, 'PingMonitor', target.address, { timeout_seconds: 15 }));
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
    parsePingOutput(target, stdout, stderr, success) {
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
        }
        catch (error) {
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
    extractPingMetrics(output) {
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            return this.parseWindowsPingOutput(output);
        }
        else {
            return this.parseUnixPingOutput(output);
        }
    }
    /**
     * Parse Windows ping output
     */
    parseWindowsPingOutput(output) {
        // Extract packet loss percentage
        const lossMatch = output.match(/\((\d+)% loss\)/);
        const packetLoss = lossMatch && lossMatch[1] ? parseInt(lossMatch[1], 10) : 100;
        // Extract average response time
        let responseTime = null;
        const timeMatch = output.match(/Average = (\d+)ms/);
        if (timeMatch && timeMatch[1]) {
            responseTime = parseInt(timeMatch[1], 10);
        }
        return { responseTime, packetLoss };
    }
    /**
     * Parse Unix ping output
     */
    parseUnixPingOutput(output) {
        // Extract packet loss percentage
        const lossMatch = output.match(/(\d+)% packet loss/);
        const packetLoss = lossMatch && lossMatch[1] ? parseInt(lossMatch[1], 10) : 100;
        // Extract average response time from statistics line
        // Supports multiple formats:
        // - round-trip min/avg/max = 14.307/14.451/14.743 ms (Alpine/BusyBox)
        // - rtt min/avg/max/mdev = 3.319/3.393/3.500/0.070 ms (GNU/Linux)
        // - min/avg/max/stddev = 14.307/14.451/14.743/0.123 ms (macOS)
        let responseTime = null;
        const statsMatch = output.match(/(?:rtt |round-trip |)min\/avg\/max(?:\/(?:mdev|stddev))? = [\d.]+\/([\d.]+)\/[\d.]+/);
        if (statsMatch && statsMatch[1]) {
            responseTime = parseFloat(statsMatch[1]);
        }
        return { responseTime, packetLoss };
    }
}
exports.PingMonitor = PingMonitor;
//# sourceMappingURL=ping-monitor.js.map