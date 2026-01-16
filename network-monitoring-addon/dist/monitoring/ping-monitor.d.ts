/**
 * Ping monitoring component for continuous ICMP ping execution
 */
import { EventEmitter } from 'events';
import { PingTarget } from '../types';
import { ErrorHandler } from '../error-handling';
import { PingScheduler } from './scheduler';
export declare class PingMonitor extends EventEmitter {
    private targets;
    private scheduler;
    private isRunning;
    private errorHandler;
    private consecutiveFailures;
    constructor(errorHandler?: ErrorHandler);
    /**
     * Start continuous monitoring for all configured targets
     */
    start(): void;
    /**
     * Stop all monitoring activities
     */
    stop(): void;
    /**
     * Update monitoring targets without restart
     */
    updateTargets(targets: PingTarget[]): void;
    /**
     * Get current targets
     */
    getTargets(): PingTarget[];
    /**
     * Get scheduler status
     */
    getSchedulerStatus(): ReturnType<PingScheduler['getStatus']>;
    /**
     * Execute a single ping test (called by scheduler)
     */
    executePing(target: PingTarget): Promise<void>;
    /**
     * Perform the actual ping operation
     */
    private performPing;
    /**
     * Parse ping command output to extract metrics
     */
    private parsePingOutput;
    /**
     * Extract response time and packet loss from ping output
     */
    private extractPingMetrics;
    /**
     * Parse Windows ping output
     */
    private parseWindowsPingOutput;
    /**
     * Parse Unix ping output
     */
    private parseUnixPingOutput;
}
//# sourceMappingURL=ping-monitor.d.ts.map