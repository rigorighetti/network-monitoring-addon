"use strict";
/**
 * Independent monitoring scheduler system
 * Provides separate scheduling for ping and DNS monitoring with resource coordination
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerCoordinator = exports.DNSScheduler = exports.PingScheduler = exports.MonitoringScheduler = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
/**
 * Independent scheduler for monitoring tasks
 * Manages separate scheduling for ping and DNS with resource coordination
 */
class MonitoringScheduler extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.tasks = new Map();
        this.timers = new Map();
        this.isRunning = false;
        this.activeTasks = new Set();
        this.lastTaskExecution = 0;
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
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('MonitoringScheduler is already running');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting monitoring scheduler');
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
    stop() {
        if (!this.isRunning) {
            return;
        }
        logger_1.logger.info('Stopping monitoring scheduler');
        this.isRunning = false;
        // Clear all timers
        for (const [taskId, timer] of this.timers) {
            clearTimeout(timer);
            logger_1.logger.debug(`Cleared timer for task: ${taskId}`);
        }
        this.timers.clear();
        this.activeTasks.clear();
    }
    /**
     * Add or update ping targets
     */
    updatePingTargets(targets) {
        logger_1.logger.info(`Updating ping targets: ${targets.length} targets`);
        // Remove old ping tasks
        const oldPingTasks = Array.from(this.tasks.values()).filter(task => task.type === 'ping');
        for (const task of oldPingTasks) {
            this.removeTask(task.id);
        }
        // Add new ping tasks
        for (const target of targets) {
            const taskId = `ping:${target.name}`;
            const task = {
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
    updateDNSTargets(targets) {
        logger_1.logger.info(`Updating DNS targets: ${targets.length} targets`);
        // Remove old DNS tasks
        const oldDNSTasks = Array.from(this.tasks.values()).filter(task => task.type === 'dns');
        for (const task of oldDNSTasks) {
            this.removeTask(task.id);
        }
        // Add new DNS tasks
        for (const target of targets) {
            const taskId = `dns:${target.name}`;
            const task = {
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
    getStatus() {
        const pingTasks = Array.from(this.tasks.values()).filter(task => task.type === 'ping' && task.enabled).length;
        const dnsTasks = Array.from(this.tasks.values()).filter(task => task.type === 'dns' && task.enabled).length;
        let nextExecution;
        for (const task of this.tasks.values()) {
            if (task.enabled && (!nextExecution || task.nextExecution < nextExecution)) {
                nextExecution = task.nextExecution;
            }
        }
        const result = {
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
    getTasksByType(type) {
        return Array.from(this.tasks.values()).filter(task => task.type === type);
    }
    /**
     * Schedule a specific task
     */
    scheduleTask(task) {
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
        logger_1.logger.debug(`Scheduling ${task.type} task ${task.id} in ${coordinatedDelay}ms`);
        const timer = setTimeout(() => {
            this.executeTask(task);
        }, coordinatedDelay);
        this.timers.set(task.id, timer);
    }
    /**
     * Execute a scheduled task
     */
    async executeTask(task) {
        if (!this.isRunning || !task.enabled) {
            return;
        }
        // Check concurrent task limit
        if (this.activeTasks.size >= this.options.maxConcurrentTasks) {
            logger_1.logger.warn(`Skipping task ${task.id} - concurrent task limit reached (${this.options.maxConcurrentTasks})`);
            this.rescheduleTask(task);
            return;
        }
        this.activeTasks.add(task.id);
        this.lastTaskExecution = Date.now();
        try {
            logger_1.logger.debug(`Executing ${task.type} task: ${task.id}`);
            // Emit task execution event
            this.emit('task:execute', {
                taskId: task.id,
                type: task.type,
                target: task.target
            });
            // Schedule next execution
            this.rescheduleTask(task);
        }
        catch (error) {
            logger_1.logger.error(`Error executing task ${task.id}:`, error);
            this.emit('task:error', {
                taskId: task.id,
                type: task.type,
                target: task.target,
                error
            });
        }
        finally {
            this.activeTasks.delete(task.id);
        }
    }
    /**
     * Reschedule a task for its next execution
     */
    rescheduleTask(task) {
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
    removeTask(taskId) {
        const timer = this.timers.get(taskId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(taskId);
        }
        this.tasks.delete(taskId);
        this.activeTasks.delete(taskId);
        logger_1.logger.debug(`Removed task: ${taskId}`);
    }
    /**
     * Apply resource coordination to prevent conflicts
     */
    applyResourceCoordination(originalDelay) {
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
exports.MonitoringScheduler = MonitoringScheduler;
/**
 * Ping-specific scheduler that extends the base scheduler
 */
class PingScheduler extends MonitoringScheduler {
    constructor(options = {}) {
        super({
            maxConcurrentTasks: 5, // Lower limit for ping tasks
            minTaskInterval: 200, // 200ms between ping tasks
            ...options
        });
    }
    /**
     * Update ping targets
     */
    updateTargets(targets) {
        this.updatePingTargets(targets);
    }
}
exports.PingScheduler = PingScheduler;
/**
 * DNS-specific scheduler that extends the base scheduler
 */
class DNSScheduler extends MonitoringScheduler {
    constructor(options = {}) {
        super({
            maxConcurrentTasks: 8, // Higher limit for DNS tasks
            minTaskInterval: 150, // 150ms between DNS tasks
            ...options
        });
    }
    /**
     * Update DNS targets
     */
    updateTargets(targets) {
        this.updateDNSTargets(targets);
    }
}
exports.DNSScheduler = DNSScheduler;
/**
 * Coordinated scheduler manager that manages both ping and DNS schedulers
 */
class SchedulerCoordinator extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.isRunning = false;
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
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('SchedulerCoordinator is already running');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting scheduler coordinator');
        this.pingScheduler.start();
        this.dnsScheduler.start();
    }
    /**
     * Stop both schedulers
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        logger_1.logger.info('Stopping scheduler coordinator');
        this.isRunning = false;
        this.pingScheduler.stop();
        this.dnsScheduler.stop();
    }
    /**
     * Update ping targets
     */
    updatePingTargets(targets) {
        this.pingScheduler.updateTargets(targets);
    }
    /**
     * Update DNS targets
     */
    updateDNSTargets(targets) {
        this.dnsScheduler.updateTargets(targets);
    }
    /**
     * Get combined status from both schedulers
     */
    getStatus() {
        return {
            running: this.isRunning,
            ping: this.pingScheduler.getStatus(),
            dns: this.dnsScheduler.getStatus()
        };
    }
    /**
     * Get ping scheduler instance
     */
    getPingScheduler() {
        return this.pingScheduler;
    }
    /**
     * Get DNS scheduler instance
     */
    getDNSScheduler() {
        return this.dnsScheduler;
    }
}
exports.SchedulerCoordinator = SchedulerCoordinator;
//# sourceMappingURL=scheduler.js.map