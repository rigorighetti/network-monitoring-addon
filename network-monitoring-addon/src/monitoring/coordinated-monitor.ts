/**
 * Coordinated monitoring manager that uses independent schedulers
 * for ping and DNS monitoring with resource coordination
 */

import { EventEmitter } from 'events';
import { PingTarget, DNSTarget, PingResult, DNSResult } from '../types';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../error-handling';
import { SchedulerCoordinator, SchedulerOptions } from './scheduler';
import { PingMonitor } from './ping-monitor';
import { DNSMonitor } from './dns-monitor';

export interface CoordinatedMonitorOptions {
  pingSchedulerOptions?: SchedulerOptions;
  dnsSchedulerOptions?: SchedulerOptions;
  errorHandler?: ErrorHandler;
}

/**
 * Coordinated monitoring manager that provides independent scheduling
 * for ping and DNS monitoring with resource coordination
 */
export class CoordinatedMonitor extends EventEmitter {
  private schedulerCoordinator: SchedulerCoordinator;
  private pingMonitor: PingMonitor;
  private dnsMonitor: DNSMonitor;
  private errorHandler: ErrorHandler;
  private isRunning = false;

  constructor(options: CoordinatedMonitorOptions = {}) {
    super();
    
    this.errorHandler = options.errorHandler || new ErrorHandler();
    
    // Create scheduler coordinator with independent schedulers
    this.schedulerCoordinator = new SchedulerCoordinator({
      pingOptions: {
        maxConcurrentTasks: 5,
        minTaskInterval: 200, // 200ms between ping tasks
        resourceCoordinationEnabled: true,
        ...options.pingSchedulerOptions
      },
      dnsOptions: {
        maxConcurrentTasks: 8,
        minTaskInterval: 150, // 150ms between DNS tasks  
        resourceCoordinationEnabled: true,
        ...options.dnsSchedulerOptions
      }
    });

    // Create monitors that will execute tasks when scheduled
    this.pingMonitor = new PingMonitor(this.errorHandler);
    this.dnsMonitor = new DNSMonitor(this.errorHandler);

    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for coordination between schedulers and monitors
   */
  private setupEventHandlers(): void {
    // Handle ping execution events from scheduler
    this.schedulerCoordinator.on('ping:execute', async (event) => {
      try {
        logger.debug(`Executing scheduled ping task: ${event.taskId}`);
        
        // Execute ping directly through the monitor's public method
        const target = event.target as PingTarget;
        await this.pingMonitor.executePing(target);
        
      } catch (error) {
        logger.error(`Error executing scheduled ping task ${event.taskId}:`, error);
        this.emit('ping:error', { taskId: event.taskId, target: event.target, error });
      }
    });

    // Handle DNS execution events from scheduler
    this.schedulerCoordinator.on('dns:execute', async (event) => {
      try {
        logger.debug(`Executing scheduled DNS task: ${event.taskId}`);
        
        // Execute DNS tests directly through the monitor's public method
        const target = event.target as DNSTarget;
        await this.dnsMonitor.executeDNSTests(target);
        
      } catch (error) {
        logger.error(`Error executing scheduled DNS task ${event.taskId}:`, error);
        this.emit('dns:error', { taskId: event.taskId, target: event.target, error });
      }
    });

    // Forward ping results
    this.pingMonitor.on('result', (result: PingResult) => {
      this.emit('ping:result', result);
      this.emit('result', { type: 'ping', result });
    });

    // Forward DNS results
    this.dnsMonitor.on('result', (result: DNSResult) => {
      this.emit('dns:result', result);
      this.emit('result', { type: 'dns', result });
    });

    // Forward scheduler errors
    this.schedulerCoordinator.on('ping:error', (event) => {
      this.emit('ping:error', event);
    });

    this.schedulerCoordinator.on('dns:error', (event) => {
      this.emit('dns:error', event);
    });
  }

  /**
   * Start coordinated monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('CoordinatedMonitor is already running');
      return;
    }

    logger.info('Starting coordinated monitoring with independent schedulers');
    this.isRunning = true;

    try {
      // Start the scheduler coordinator
      this.schedulerCoordinator.start();
      
      logger.info('Coordinated monitoring started successfully');
      this.emit('started');
      
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start coordinated monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop coordinated monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('CoordinatedMonitor is not running');
      return;
    }

    logger.info('Stopping coordinated monitoring');
    this.isRunning = false;

    try {
      // Stop the scheduler coordinator
      this.schedulerCoordinator.stop();
      
      logger.info('Coordinated monitoring stopped successfully');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error stopping coordinated monitoring:', error);
      throw error;
    }
  }

  /**
   * Update ping targets with independent scheduling
   */
  updatePingTargets(targets: PingTarget[]): void {
    logger.info(`Updating ping targets with independent scheduling: ${targets.length} targets`);
    
    // Update targets in ping monitor for reference
    this.pingMonitor.updateTargets(targets);
    
    // Update scheduler with new targets and their independent intervals
    this.schedulerCoordinator.updatePingTargets(targets);
    
    this.emit('ping:targets:updated', targets);
  }

  /**
   * Update DNS targets with independent scheduling
   */
  updateDNSTargets(targets: DNSTarget[]): void {
    logger.info(`Updating DNS targets with independent scheduling: ${targets.length} targets`);
    
    // Update targets in DNS monitor for reference
    this.dnsMonitor.updateTargets(targets);
    
    // Update scheduler with new targets and their independent intervals
    this.schedulerCoordinator.updateDNSTargets(targets);
    
    this.emit('dns:targets:updated', targets);
  }

  /**
   * Update both ping and DNS targets
   */
  updateTargets(pingTargets: PingTarget[], dnsTargets: DNSTarget[]): void {
    this.updatePingTargets(pingTargets);
    this.updateDNSTargets(dnsTargets);
  }

  /**
   * Get current ping targets
   */
  getPingTargets(): PingTarget[] {
    return this.pingMonitor.getTargets();
  }

  /**
   * Get current DNS targets
   */
  getDNSTargets(): DNSTarget[] {
    return this.dnsMonitor.getTargets();
  }

  /**
   * Get comprehensive status including scheduler information
   */
  getStatus(): {
    running: boolean;
    scheduler: ReturnType<SchedulerCoordinator['getStatus']>;
    targets: {
      ping: PingTarget[];
      dns: DNSTarget[];
    };
  } {
    return {
      running: this.isRunning,
      scheduler: this.schedulerCoordinator.getStatus(),
      targets: {
        ping: this.getPingTargets(),
        dns: this.getDNSTargets()
      }
    };
  }

  /**
   * Get scheduler coordinator instance for advanced control
   */
  getSchedulerCoordinator(): SchedulerCoordinator {
    return this.schedulerCoordinator;
  }

  /**
   * Get ping monitor instance
   */
  getPingMonitor(): PingMonitor {
    return this.pingMonitor;
  }

  /**
   * Get DNS monitor instance
   */
  getDNSMonitor(): DNSMonitor {
    return this.dnsMonitor;
  }

  /**
   * Check if monitoring is running
   */
  isMonitoringRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get detailed scheduler statistics
   */
  getSchedulerStatistics(): {
    ping: {
      totalTasks: number;
      activeTasks: number;
      nextExecution?: Date;
    };
    dns: {
      totalTasks: number;
      activeTasks: number;
      nextExecution?: Date;
    };
    coordination: {
      resourceCoordinationEnabled: boolean;
      totalActiveTasks: number;
    };
  } {
    const status = this.schedulerCoordinator.getStatus();
    
    const result = {
      ping: {
        totalTasks: status.ping.totalTasks,
        activeTasks: status.ping.activeTasks
      } as { totalTasks: number; activeTasks: number; nextExecution?: Date },
      dns: {
        totalTasks: status.dns.totalTasks,
        activeTasks: status.dns.activeTasks
      } as { totalTasks: number; activeTasks: number; nextExecution?: Date },
      coordination: {
        resourceCoordinationEnabled: true,
        totalActiveTasks: status.ping.activeTasks + status.dns.activeTasks
      }
    };

    if (status.ping.nextExecution) {
      result.ping.nextExecution = status.ping.nextExecution;
    }

    if (status.dns.nextExecution) {
      result.dns.nextExecution = status.dns.nextExecution;
    }

    return result;
  }
}