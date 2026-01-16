/**
 * Independent monitoring scheduler system
 * Provides separate scheduling for ping and DNS monitoring with resource coordination
 */

import { EventEmitter } from 'events';
import { PingTarget, DNSTarget } from '../types';
import { logger } from '../utils/logger';

export interface SchedulerTask {
  id: string;
  type: 'ping' | 'dns';
  target: PingTarget | DNSTarget;
  nextExecution: Date;
  interval: number; // milliseconds
  enabled: boolean;
}

export interface SchedulerOptions {
  maxConcurrentTasks?: number;
  minTaskInterval?: number; // minimum milliseconds between any tasks
  resourceCoordinationEnabled?: boolean;
}

/**
 * Independent scheduler for monitoring tasks
 * Manages separate scheduling for ping and DNS with resource coordination
 */
export class MonitoringScheduler extends EventEmitter {
  private tasks: Map<string, SchedulerTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private options: Required<SchedulerOptions>;
  private activeTasks = new Set<string>();
  private lastTaskExecution = 0;

  constructor(options: SchedulerOptions = {}) {
    super();
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks ?? 10,
      minTaskInterval: options.minTaskInterval ?? 100, // 100ms minimum between tasks
      resourceCoordinationEnabled: options.resourceCoordinationEnabled ?? true,
      ...options
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('MonitoringScheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting monitoring scheduler');

    // Schedule all enabled tasks
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping monitoring scheduler');
    this.isRunning = false;

    // Clear all timers
    for (const [taskId, timer] of this.timers) {
      clearTimeout(timer);
      logger.debug(`Cleared timer for task: ${taskId}`);
    }
    this.timers.clear();
    this.activeTasks.clear();
  }

  /**
   * Add or update ping targets
   */
  updatePingTargets(targets: PingTarget[]): void {
    logger.info(`Updating ping targets: ${targets.length} targets`);

    // Remove old ping tasks
    const oldPingTasks = Array.from(this.tasks.values()).filter(task => task.type === 'ping');
    for (const task of oldPingTasks) {
      this.removeTask(task.id);
    }

    // Add new ping tasks
    for (const target of targets) {
      const taskId = `ping:${target.name}`;
      const task: SchedulerTask = {
        id: taskId,
        type: 'ping',
        target,
        nextExecution: new Date(Date.now() + (target.interval * 1000)),
        interval: target.interval * 1000,
        enabled: target.enabled
      };

      this.tasks.set(taskId, task);

      if (this.isRunning && task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * Add or update DNS targets
   */
  updateDNSTargets(targets: DNSTarget[]): void {
    logger.info(`Updating DNS targets: ${targets.length} targets`);

    // Remove old DNS tasks
    const oldDNSTasks = Array.from(this.tasks.values()).filter(task => task.type === 'dns');
    for (const task of oldDNSTasks) {
      this.removeTask(task.id);
    }

    // Add new DNS tasks
    for (const target of targets) {
      const taskId = `dns:${target.name}`;
      const task: SchedulerTask = {
        id: taskId,
        type: 'dns',
        target,
        nextExecution: new Date(Date.now() + (target.interval * 1000)),
        interval: target.interval * 1000,
        enabled: target.enabled
      };

      this.tasks.set(taskId, task);

      if (this.isRunning && task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): {
    running: boolean;
    totalTasks: number;
    activeTasks: number;
    pingTasks: number;
    dnsTasks: number;
    nextExecution?: Date;
  } {
    const pingTasks = Array.from(this.tasks.values()).filter(task => task.type === 'ping' && task.enabled).length;
    const dnsTasks = Array.from(this.tasks.values()).filter(task => task.type === 'dns' && task.enabled).length;
    
    let nextExecution: Date | undefined;
    for (const task of this.tasks.values()) {
      if (task.enabled && (!nextExecution || task.nextExecution < nextExecution)) {
        nextExecution = task.nextExecution;
      }
    }

    const result: {
      running: boolean;
      totalTasks: number;
      activeTasks: number;
      pingTasks: number;
      dnsTasks: number;
      nextExecution?: Date;
    } = {
      running: this.isRunning,
      totalTasks: this.tasks.size,
      activeTasks: this.activeTasks.size,
      pingTasks,
      dnsTasks
    };

    if (nextExecution) {
      result.nextExecution = nextExecution;
    }

    return result;
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: 'ping' | 'dns'): SchedulerTask[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }

  /**
   * Schedule a specific task
   */
  private scheduleTask(task: SchedulerTask): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(task.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate delay until next execution
    const now = Date.now();
    const delay = Math.max(0, task.nextExecution.getTime() - now);

    // Apply resource coordination if enabled
    const coordinatedDelay = this.options.resourceCoordinationEnabled 
      ? this.applyResourceCoordination(delay)
      : delay;

    logger.debug(`Scheduling ${task.type} task ${task.id} in ${coordinatedDelay}ms`);

    const timer = setTimeout(() => {
      this.executeTask(task);
    }, coordinatedDelay);

    this.timers.set(task.id, timer);
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: SchedulerTask): Promise<void> {
    if (!this.isRunning || !task.enabled) {
      return;
    }

    // Check concurrent task limit
    if (this.activeTasks.size >= this.options.maxConcurrentTasks) {
      logger.warn(`Skipping task ${task.id} - concurrent task limit reached (${this.options.maxConcurrentTasks})`);
      this.rescheduleTask(task);
      return;
    }

    this.activeTasks.add(task.id);
    this.lastTaskExecution = Date.now();

    try {
      logger.debug(`Executing ${task.type} task: ${task.id}`);
      
      // Emit task execution event
      this.emit('task:execute', {
        taskId: task.id,
        type: task.type,
        target: task.target
      });

      // Schedule next execution
      this.rescheduleTask(task);

    } catch (error) {
      logger.error(`Error executing task ${task.id}:`, error);
      this.emit('task:error', {
        taskId: task.id,
        type: task.type,
        target: task.target,
        error
      });
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Reschedule a task for its next execution
   */
  private rescheduleTask(task: SchedulerTask): void {
    if (!this.isRunning || !task.enabled) {
      return;
    }

    // Calculate next execution time
    task.nextExecution = new Date(Date.now() + task.interval);
    
    // Schedule the task again
    this.scheduleTask(task);
  }

  /**
   * Remove a task from the scheduler
   */
  private removeTask(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }

    this.tasks.delete(taskId);
    this.activeTasks.delete(taskId);
    logger.debug(`Removed task: ${taskId}`);
  }

  /**
   * Apply resource coordination to prevent conflicts
   */
  private applyResourceCoordination(originalDelay: number): number {
    if (!this.options.resourceCoordinationEnabled) {
      return originalDelay;
    }

    const timeSinceLastTask = Date.now() - this.lastTaskExecution;
    const minInterval = this.options.minTaskInterval;

    // If not enough time has passed since last task, add delay
    if (timeSinceLastTask < minInterval) {
      const additionalDelay = minInterval - timeSinceLastTask;
      return originalDelay + additionalDelay;
    }

    return originalDelay;
  }
}

/**
 * Ping-specific scheduler that extends the base scheduler
 */
export class PingScheduler extends MonitoringScheduler {
  constructor(options: SchedulerOptions = {}) {
    super({
      maxConcurrentTasks: 5, // Lower limit for ping tasks
      minTaskInterval: 200, // 200ms between ping tasks
      ...options
    });
  }

  /**
   * Update ping targets
   */
  updateTargets(targets: PingTarget[]): void {
    this.updatePingTargets(targets);
  }
}

/**
 * DNS-specific scheduler that extends the base scheduler
 */
export class DNSScheduler extends MonitoringScheduler {
  constructor(options: SchedulerOptions = {}) {
    super({
      maxConcurrentTasks: 8, // Higher limit for DNS tasks
      minTaskInterval: 150, // 150ms between DNS tasks
      ...options
    });
  }

  /**
   * Update DNS targets
   */
  updateTargets(targets: DNSTarget[]): void {
    this.updateDNSTargets(targets);
  }
}

/**
 * Coordinated scheduler manager that manages both ping and DNS schedulers
 */
export class SchedulerCoordinator extends EventEmitter {
  private pingScheduler: PingScheduler;
  private dnsScheduler: DNSScheduler;
  private isRunning = false;

  constructor(options: {
    pingOptions?: SchedulerOptions;
    dnsOptions?: SchedulerOptions;
  } = {}) {
    super();
    
    this.pingScheduler = new PingScheduler(options.pingOptions);
    this.dnsScheduler = new DNSScheduler(options.dnsOptions);

    // Forward events from individual schedulers
    this.pingScheduler.on('task:execute', (event) => {
      this.emit('ping:execute', event);
    });

    this.pingScheduler.on('task:error', (event) => {
      this.emit('ping:error', event);
    });

    this.dnsScheduler.on('task:execute', (event) => {
      this.emit('dns:execute', event);
    });

    this.dnsScheduler.on('task:error', (event) => {
      this.emit('dns:error', event);
    });
  }

  /**
   * Start both schedulers
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('SchedulerCoordinator is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler coordinator');

    this.pingScheduler.start();
    this.dnsScheduler.start();
  }

  /**
   * Stop both schedulers
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping scheduler coordinator');
    this.isRunning = false;

    this.pingScheduler.stop();
    this.dnsScheduler.stop();
  }

  /**
   * Update ping targets
   */
  updatePingTargets(targets: PingTarget[]): void {
    this.pingScheduler.updateTargets(targets);
  }

  /**
   * Update DNS targets
   */
  updateDNSTargets(targets: DNSTarget[]): void {
    this.dnsScheduler.updateTargets(targets);
  }

  /**
   * Get combined status from both schedulers
   */
  getStatus(): {
    running: boolean;
    ping: ReturnType<PingScheduler['getStatus']>;
    dns: ReturnType<DNSScheduler['getStatus']>;
  } {
    return {
      running: this.isRunning,
      ping: this.pingScheduler.getStatus(),
      dns: this.dnsScheduler.getStatus()
    };
  }

  /**
   * Get ping scheduler instance
   */
  getPingScheduler(): PingScheduler {
    return this.pingScheduler;
  }

  /**
   * Get DNS scheduler instance
   */
  getDNSScheduler(): DNSScheduler {
    return this.dnsScheduler;
  }
}