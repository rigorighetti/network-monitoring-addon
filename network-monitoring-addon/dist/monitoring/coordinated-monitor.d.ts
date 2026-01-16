/**
 * Coordinated monitoring manager that uses independent schedulers
 * for ping and DNS monitoring with resource coordination
 */
import { EventEmitter } from 'events';
import { PingTarget, DNSTarget } from '../types';
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
export declare class CoordinatedMonitor extends EventEmitter {
    private schedulerCoordinator;
    private pingMonitor;
    private dnsMonitor;
    private errorHandler;
    private isRunning;
    constructor(options?: CoordinatedMonitorOptions);
    /**
     * Set up event handlers for coordination between schedulers and monitors
     */
    private setupEventHandlers;
    /**
     * Start coordinated monitoring
     */
    start(): Promise<void>;
    /**
     * Stop coordinated monitoring
     */
    stop(): Promise<void>;
    /**
     * Update ping targets with independent scheduling
     */
    updatePingTargets(targets: PingTarget[]): void;
    /**
     * Update DNS targets with independent scheduling
     */
    updateDNSTargets(targets: DNSTarget[]): void;
    /**
     * Update both ping and DNS targets
     */
    updateTargets(pingTargets: PingTarget[], dnsTargets: DNSTarget[]): void;
    /**
     * Get current ping targets
     */
    getPingTargets(): PingTarget[];
    /**
     * Get current DNS targets
     */
    getDNSTargets(): DNSTarget[];
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
    };
    /**
     * Get scheduler coordinator instance for advanced control
     */
    getSchedulerCoordinator(): SchedulerCoordinator;
    /**
     * Get ping monitor instance
     */
    getPingMonitor(): PingMonitor;
    /**
     * Get DNS monitor instance
     */
    getDNSMonitor(): DNSMonitor;
    /**
     * Check if monitoring is running
     */
    isMonitoringRunning(): boolean;
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
    };
}
//# sourceMappingURL=coordinated-monitor.d.ts.map