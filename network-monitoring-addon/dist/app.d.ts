/**
 * Main application class for the Network Monitoring Add-on
 */
import { NetworkMonitorConfig } from './types';
export declare class NetworkMonitorApp {
    private logger;
    private configManager;
    private dataStore;
    private monitor;
    private haSensor;
    private alertManager;
    private apiServer;
    private errorHandler;
    private config;
    private isRunning;
    private isInitialized;
    private cleanupInterval;
    constructor();
    /**
     * Initialize all components
     */
    initialize(): Promise<void>;
    /**
     * Set up event handlers for component integration
     */
    private setupEventHandlers;
    /**
     * Create sensors for all configured targets
     */
    private createSensorsForTargets;
    /**
     * Start all monitoring services
     */
    start(): Promise<void>;
    /**
     * Stop all monitoring services gracefully
     */
    stop(): Promise<void>;
    /**
     * Apply configuration changes without full restart
     */
    private applyConfigurationChanges;
    /**
     * Start periodic data cleanup
     */
    private startPeriodicCleanup;
    /**
     * Get application status
     */
    getStatus(): {
        running: boolean;
        initialized: boolean;
        config: NetworkMonitorConfig | null;
        components: {
            dataStore: boolean;
            monitor: boolean;
            haSensor: boolean;
            alertManager: boolean;
            apiServer: boolean;
        };
    };
    /**
     * Health check endpoint
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        uptime: number;
        components: Record<string, boolean>;
    }>;
    /**
     * Sanitize name for entity IDs
     */
    private sanitizeName;
}
//# sourceMappingURL=app.d.ts.map