/**
 * Integrated alert service that combines AlertManager with Home Assistant notifications
 */
import { NotificationConfig } from '../types/alerts';
import { PingResult, DNSResult } from '../types/results';
import { AlertThresholds, HomeAssistantConfig } from '../types/config';
export declare class IntegratedAlertService {
    private alertManager;
    private notificationService;
    private isRunning;
    constructor(alertThresholds: AlertThresholds, haConfig: HomeAssistantConfig);
    /**
     * Start the integrated alert service
     */
    start(): Promise<void>;
    /**
     * Stop the integrated alert service
     */
    stop(): void;
    /**
     * Process ping result
     */
    processPingResult(result: PingResult): void;
    /**
     * Process DNS result
     */
    processDNSResult(result: DNSResult): void;
    /**
     * Update alert thresholds
     */
    updateThresholds(thresholds: AlertThresholds): void;
    /**
     * Update Home Assistant configuration
     */
    updateHAConfig(haConfig: HomeAssistantConfig): void;
    /**
     * Add notification configuration
     */
    addNotificationConfig(config: NotificationConfig): void;
    /**
     * Get current alert manager state
     */
    getState(): import("../types/alerts").AlertManagerState;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): void;
    /**
     * Get notification configurations
     */
    getNotificationConfigs(): NotificationConfig[];
    /**
     * Setup event handlers to connect AlertManager with NotificationService
     */
    private setupEventHandlers;
}
//# sourceMappingURL=integrated-alert-service.d.ts.map