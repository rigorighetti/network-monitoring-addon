/**
 * Express.js API server for dashboard data
 * Provides REST endpoints for historical data retrieval and configuration management
 */
import { DataStore } from '../storage/data-store';
import { ConfigManager } from '../config/config-manager';
import { Logger } from '../types';
export interface APIServerConfig {
    port: number;
    host: string;
    staticPath?: string;
    enableCors?: boolean;
}
export declare class APIServer {
    private app;
    private server;
    private wss;
    private dataStore;
    private configManager;
    private logger;
    private config;
    private startTime;
    constructor(dataStore: DataStore, configManager: ConfigManager, logger: Logger, config: APIServerConfig);
    private setupMiddleware;
    private setupRoutes;
    private handleHealthCheck;
    private handleGetDashboardData;
    private handleGetPingData;
    private handleGetDnsData;
    private handleGetTargets;
    private handleGetPingHistory;
    private handleGetDnsHistory;
    private handleGetAggregatedPingData;
    private handleGetAggregatedDnsData;
    private handleGetAggregatedDnsDataByType;
    private handleGetConfig;
    private handleUpdateConfig;
    private handleValidateConfig;
    private handleResetConfig;
    private handleGetSystemStatus;
    private handleGetSystemStats;
    private parseTimeRange;
    private getPingTargetData;
    private getDnsTargetData;
    private getSystemStatus;
    private determineStatus;
    private determineDnsStatus;
    start(): Promise<void>;
    stop(): Promise<void>;
    private setupWebSocketHandlers;
    private handleWebSocketMessage;
    /**
     * Broadcast update to all connected clients
     */
    broadcastUpdate(data: any): void;
    /**
     * Broadcast custom update to all connected clients
     */
    broadcastCustomUpdate(data: any): void;
}
//# sourceMappingURL=api-server.d.ts.map