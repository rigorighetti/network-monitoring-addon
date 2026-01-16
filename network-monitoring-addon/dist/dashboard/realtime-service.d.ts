/**
 * Real-time data streaming service for live dashboard updates
 * Manages WebSocket connections and broadcasts monitoring data updates
 */
import { EventEmitter } from 'events';
import { DataStore } from '../storage/data-store';
import { APIServer } from './api-server';
import { Logger } from '../types';
import { PingResult, DNSResult } from '../types/results';
export interface RealtimeUpdate {
    type: 'ping' | 'dns' | 'system';
    target: string;
    data: any;
    timestamp: Date;
}
export declare class RealtimeService extends EventEmitter {
    private dataStore;
    private apiServer;
    private logger;
    private updateInterval;
    private isRunning;
    constructor(dataStore: DataStore, apiServer: APIServer, logger: Logger);
    /**
     * Start the real-time service
     */
    start(): void;
    /**
     * Stop the real-time service
     */
    stop(): void;
    /**
     * Handle new ping result and broadcast update
     */
    handlePingResult(result: PingResult): Promise<void>;
    /**
     * Handle new DNS result and broadcast update
     */
    handleDnsResult(result: DNSResult): Promise<void>;
    /**
     * Broadcast system-wide update
     */
    private broadcastSystemUpdate;
    /**
     * Broadcast update to all connected WebSocket clients
     */
    private broadcastUpdate;
    /**
     * Determine ping status from result
     */
    private determinePingStatus;
    /**
     * Determine DNS status from result
     */
    private determineDnsStatus;
    /**
     * Calculate ping trend from recent results
     */
    private calculatePingTrend;
    /**
     * Calculate DNS trend from recent results
     */
    private calculateDnsTrend;
    /**
     * Calculate average response time from ping results
     */
    private calculateAverageResponseTime;
    /**
     * Calculate average response time from DNS results
     */
    private calculateAverageDnsResponseTime;
    /**
     * Get current connection count
     */
    getConnectionCount(): number;
    /**
     * Send targeted update to specific clients
     */
    sendTargetedUpdate(targetName: string, update: RealtimeUpdate): void;
}
//# sourceMappingURL=realtime-service.d.ts.map