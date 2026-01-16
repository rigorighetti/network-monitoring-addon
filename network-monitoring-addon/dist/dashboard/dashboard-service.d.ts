/**
 * Dashboard service integration
 * Coordinates API server, real-time service, and static file serving
 */
import { DataStore } from '../storage/data-store';
import { ConfigManager } from '../config/config-manager';
import { Logger } from '../types';
import { PingResult, DNSResult } from '../types/results';
export interface DashboardServiceConfig {
    port: number;
    host: string;
    enableCors: boolean;
    staticPath?: string;
}
export declare class DashboardService {
    private apiServer;
    private realtimeService;
    private dataStore;
    private configManager;
    private logger;
    private config;
    private isRunning;
    constructor(dataStore: DataStore, configManager: ConfigManager, logger: Logger, config: DashboardServiceConfig);
    private setupEventHandlers;
    /**
     * Start the dashboard service
     */
    start(): Promise<void>;
    /**
     * Stop the dashboard service
     */
    stop(): Promise<void>;
    /**
     * Handle new ping result for real-time updates
     */
    handlePingResult(result: PingResult): Promise<void>;
    /**
     * Handle new DNS result for real-time updates
     */
    handleDnsResult(result: DNSResult): Promise<void>;
    /**
     * Get service status
     */
    getStatus(): {
        running: boolean;
        port: number;
        host: string;
        connections: number;
    };
    /**
     * Get dashboard URL
     */
    getDashboardUrl(): string;
    /**
     * Get API base URL
     */
    getApiUrl(): string;
    /**
     * Broadcast update to all connected clients
     */
    broadcastUpdate(data: any): void;
    /**
     * Check if service is healthy
     */
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=dashboard-service.d.ts.map