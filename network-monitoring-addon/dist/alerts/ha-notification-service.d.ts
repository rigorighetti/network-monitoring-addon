/**
 * Home Assistant notification service integration
 */
import { Alert, NotificationConfig } from '../types/alerts';
import { HomeAssistantConfig } from '../types/config';
export interface HANotificationPayload {
    title: string;
    message: string;
    data?: {
        tag?: string;
        group?: string;
        importance?: 'min' | 'low' | 'default' | 'high' | 'max';
        persistent?: boolean;
        actions?: Array<{
            action: string;
            title: string;
        }>;
    };
}
export declare class HANotificationService {
    private haClient;
    private haConfig;
    private notificationConfigs;
    private isConnected;
    constructor(haConfig: HomeAssistantConfig);
    /**
     * Test connection to Home Assistant
     */
    testConnection(): Promise<boolean>;
    /**
     * Send notification for an alert
     */
    sendAlertNotification(alert: Alert): Promise<boolean>;
    /**
     * Send recovery notification
     */
    sendRecoveryNotification(alert: Alert): Promise<boolean>;
    /**
     * Add or update notification configuration
     */
    addNotificationConfig(config: NotificationConfig): void;
    /**
     * Remove notification configuration
     */
    removeNotificationConfig(service: string): void;
    /**
     * Get all notification configurations
     */
    getNotificationConfigs(): NotificationConfig[];
    /**
     * Update Home Assistant configuration
     */
    updateHAConfig(haConfig: HomeAssistantConfig): void;
    /**
     * Initialize default notification configurations
     */
    private initializeDefaultConfigs;
    /**
     * Get notification configuration for alert
     */
    private getNotificationConfig;
    /**
     * Format notification payload for alert
     */
    private formatNotificationPayload;
    /**
     * Format recovery notification payload
     */
    private formatRecoveryNotificationPayload;
    /**
     * Send notification to Home Assistant service
     */
    private sendToHAService;
    /**
     * Process template string with alert data
     */
    private processTemplate;
    /**
     * Convert string to title case
     */
    private titleCase;
    /**
     * Map alert severity to Home Assistant importance level
     */
    private mapSeverityToImportance;
}
//# sourceMappingURL=ha-notification-service.d.ts.map