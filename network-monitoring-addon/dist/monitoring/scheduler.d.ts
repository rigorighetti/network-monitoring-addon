/**
 * Independent monitoring scheduler system
 * Provides separate scheduling for ping and DNS monitoring with resource coordination
 */
import { EventEmitter } from 'events';
import { PingTarget, DNSTarget } from '../types';
export interface SchedulerTask {
    id: string;
    type: 'ping' | 'dns';
    target: PingTarget | DNSTarget;
    nextExecution: Date;
    interval: number;
    enabled: boolean;
}
export interface SchedulerOptions {
    maxConcurrentTasks?: number;
    minTaskInterval?: number;
    resourceCoordinationEnabled?: boolean;
}
/**
 * Independent scheduler for monitoring tasks
 * Manages separate scheduling for ping and DNS with resource coordination
 */
export declare class MonitoringScheduler extends EventEmitter {
    private tasks;
    private timers;
    private isRunning;
    private options;
    private activeTasks;
    private lastTaskExecution;
    constructor(options?: SchedulerOptions);
    /**
     * Start the scheduler
     */
    start(): void;
    /**
     * Stop the scheduler
     */
    stop(): void;
    /**
     * Add or update ping targets
     */
    updatePingTargets(targets: PingTarget[]): void;
    /**
     * Add or update DNS targets
     */
    updateDNSTargets(targets: DNSTarget[]): void;
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
    };
    /**
     * Get tasks by type
     */
    getTasksByType(type: 'ping' | 'dns'): SchedulerTask[];
    /**
     * Schedule a specific task
     */
    private scheduleTask;
    /**
     * Execute a scheduled task
     */
    private executeTask;
    /**
     * Reschedule a task for its next execution
     */
    private rescheduleTask;
    /**
     * Remove a task from the scheduler
     */
    private removeTask;
    /**
     * Apply resource coordination to prevent conflicts
     */
    private applyResourceCoordination;
}
/**
 * Ping-specific scheduler that extends the base scheduler
 */
export declare class PingScheduler extends MonitoringScheduler {
    constructor(options?: SchedulerOptions);
    /**
     * Update ping targets
     */
    updateTargets(targets: PingTarget[]): void;
}
/**
 * DNS-specific scheduler that extends the base scheduler
 */
export declare class DNSScheduler extends MonitoringScheduler {
    constructor(options?: SchedulerOptions);
    /**
     * Update DNS targets
     */
    updateTargets(targets: DNSTarget[]): void;
}
/**
 * Coordinated scheduler manager that manages both ping and DNS schedulers
 */
export declare class SchedulerCoordinator extends EventEmitter {
    private pingScheduler;
    private dnsScheduler;
    private isRunning;
    constructor(options?: {
        pingOptions?: SchedulerOptions;
        dnsOptions?: SchedulerOptions;
    });
    /**
     * Start both schedulers
     */
    start(): void;
    /**
     * Stop both schedulers
     */
    stop(): void;
    /**
     * Update ping targets
     */
    updatePingTargets(targets: PingTarget[]): void;
    /**
     * Update DNS targets
     */
    updateDNSTargets(targets: DNSTarget[]): void;
    /**
     * Get combined status from both schedulers
     */
    getStatus(): {
        running: boolean;
        ping: ReturnType<PingScheduler['getStatus']>;
        dns: ReturnType<DNSScheduler['getStatus']>;
    };
    /**
     * Get ping scheduler instance
     */
    getPingScheduler(): PingScheduler;
    /**
     * Get DNS scheduler instance
     */
    getDNSScheduler(): DNSScheduler;
}
//# sourceMappingURL=scheduler.d.ts.map