/**
 * DNS monitoring component for continuous DNS resolution testing
 */
import { EventEmitter } from 'events';
import { DNSTarget } from '../types';
import { ErrorHandler } from '../error-handling';
import { DNSScheduler } from './scheduler';
export declare class DNSMonitor extends EventEmitter {
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
    updateTargets(targets: DNSTarget[]): void;
    /**
     * Get current targets
     */
    getTargets(): DNSTarget[];
    /**
     * Get scheduler status
     */
    getSchedulerStatus(): ReturnType<DNSScheduler['getStatus']>;
    /**
     * Execute DNS tests for all domains in a target (called by scheduler)
     */
    executeDNSTests(target: DNSTarget): Promise<void>;
    /**
     * Execute a single DNS query
     */
    private executeDNSQuery;
    /**
     * Execute a reverse DNS query
     */
    private executeReverseDNSQuery;
    /**
     * Perform the actual DNS query
     */
    private performDNSQuery;
    /**
     * Perform reverse DNS query
     */
    private performReverseDNSQuery;
    /**
     * Resolve domain using specific DNS server
     */
    private resolveWithServer;
}
//# sourceMappingURL=dns-monitor.d.ts.map