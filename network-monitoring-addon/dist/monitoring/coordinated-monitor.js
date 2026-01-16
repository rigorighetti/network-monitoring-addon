"use strict";
/**
 * Coordinated monitoring manager that uses independent schedulers
 * for ping and DNS monitoring with resource coordination
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinatedMonitor = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const error_handling_1 = require("../error-handling");
const scheduler_1 = require("./scheduler");
const ping_monitor_1 = require("./ping-monitor");
const dns_monitor_1 = require("./dns-monitor");
/**
 * Coordinated monitoring manager that provides independent scheduling
 * for ping and DNS monitoring with resource coordination
 */
class CoordinatedMonitor extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.isRunning = false;
        this.errorHandler = options.errorHandler || new error_handling_1.ErrorHandler();
        // Create scheduler coordinator with independent schedulers
        this.schedulerCoordinator = new scheduler_1.SchedulerCoordinator({
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
        this.pingMonitor = new ping_monitor_1.PingMonitor(this.errorHandler);
        this.dnsMonitor = new dns_monitor_1.DNSMonitor(this.errorHandler);
        this.setupEventHandlers();
    }
    /**
     * Set up event handlers for coordination between schedulers and monitors
     */
    setupEventHandlers() {
        // Handle ping execution events from scheduler
        this.schedulerCoordinator.on('ping:execute', async (event) => {
            try {
                logger_1.logger.debug(`Executing scheduled ping task: ${event.taskId}`);
                // Execute ping directly through the monitor's public method
                const target = event.target;
                await this.pingMonitor.executePing(target);
            }
            catch (error) {
                logger_1.logger.error(`Error executing scheduled ping task ${event.taskId}:`, error);
                this.emit('ping:error', { taskId: event.taskId, target: event.target, error });
            }
        });
        // Handle DNS execution events from scheduler
        this.schedulerCoordinator.on('dns:execute', async (event) => {
            try {
                logger_1.logger.debug(`Executing scheduled DNS task: ${event.taskId}`);
                // Execute DNS tests directly through the monitor's public method
                const target = event.target;
                await this.dnsMonitor.executeDNSTests(target);
            }
            catch (error) {
                logger_1.logger.error(`Error executing scheduled DNS task ${event.taskId}:`, error);
                this.emit('dns:error', { taskId: event.taskId, target: event.target, error });
            }
        });
        // Forward ping results
        this.pingMonitor.on('result', (result) => {
            this.emit('ping:result', result);
            this.emit('result', { type: 'ping', result });
        });
        // Forward DNS results
        this.dnsMonitor.on('result', (result) => {
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
    async start() {
        if (this.isRunning) {
            logger_1.logger.warn('CoordinatedMonitor is already running');
            return;
        }
        logger_1.logger.info('Starting coordinated monitoring with independent schedulers');
        this.isRunning = true;
        try {
            // Start the scheduler coordinator
            this.schedulerCoordinator.start();
            logger_1.logger.info('Coordinated monitoring started successfully');
            this.emit('started');
        }
        catch (error) {
            this.isRunning = false;
            logger_1.logger.error('Failed to start coordinated monitoring:', error);
            throw error;
        }
    }
    /**
     * Stop coordinated monitoring
     */
    async stop() {
        if (!this.isRunning) {
            logger_1.logger.warn('CoordinatedMonitor is not running');
            return;
        }
        logger_1.logger.info('Stopping coordinated monitoring');
        this.isRunning = false;
        try {
            // Stop the scheduler coordinator
            this.schedulerCoordinator.stop();
            logger_1.logger.info('Coordinated monitoring stopped successfully');
            this.emit('stopped');
        }
        catch (error) {
            logger_1.logger.error('Error stopping coordinated monitoring:', error);
            throw error;
        }
    }
    /**
     * Update ping targets with independent scheduling
     */
    updatePingTargets(targets) {
        logger_1.logger.info(`Updating ping targets with independent scheduling: ${targets.length} targets`);
        // Update targets in ping monitor for reference
        this.pingMonitor.updateTargets(targets);
        // Update scheduler with new targets and their independent intervals
        this.schedulerCoordinator.updatePingTargets(targets);
        this.emit('ping:targets:updated', targets);
    }
    /**
     * Update DNS targets with independent scheduling
     */
    updateDNSTargets(targets) {
        logger_1.logger.info(`Updating DNS targets with independent scheduling: ${targets.length} targets`);
        // Update targets in DNS monitor for reference
        this.dnsMonitor.updateTargets(targets);
        // Update scheduler with new targets and their independent intervals
        this.schedulerCoordinator.updateDNSTargets(targets);
        this.emit('dns:targets:updated', targets);
    }
    /**
     * Update both ping and DNS targets
     */
    updateTargets(pingTargets, dnsTargets) {
        this.updatePingTargets(pingTargets);
        this.updateDNSTargets(dnsTargets);
    }
    /**
     * Get current ping targets
     */
    getPingTargets() {
        return this.pingMonitor.getTargets();
    }
    /**
     * Get current DNS targets
     */
    getDNSTargets() {
        return this.dnsMonitor.getTargets();
    }
    /**
     * Get comprehensive status including scheduler information
     */
    getStatus() {
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
    getSchedulerCoordinator() {
        return this.schedulerCoordinator;
    }
    /**
     * Get ping monitor instance
     */
    getPingMonitor() {
        return this.pingMonitor;
    }
    /**
     * Get DNS monitor instance
     */
    getDNSMonitor() {
        return this.dnsMonitor;
    }
    /**
     * Check if monitoring is running
     */
    isMonitoringRunning() {
        return this.isRunning;
    }
    /**
     * Get detailed scheduler statistics
     */
    getSchedulerStatistics() {
        const status = this.schedulerCoordinator.getStatus();
        const result = {
            ping: {
                totalTasks: status.ping.totalTasks,
                activeTasks: status.ping.activeTasks
            },
            dns: {
                totalTasks: status.dns.totalTasks,
                activeTasks: status.dns.activeTasks
            },
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
exports.CoordinatedMonitor = CoordinatedMonitor;
//# sourceMappingURL=coordinated-monitor.js.map