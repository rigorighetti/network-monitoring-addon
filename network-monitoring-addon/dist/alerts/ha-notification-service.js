"use strict";
/**
 * Home Assistant notification service integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HANotificationService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class HANotificationService {
    constructor(haConfig) {
        this.notificationConfigs = new Map();
        this.isConnected = false;
        this.haConfig = haConfig;
        this.haClient = axios_1.default.create({
            baseURL: haConfig.url,
            headers: {
                'Authorization': `Bearer ${haConfig.token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        this.initializeDefaultConfigs();
    }
    /**
     * Test connection to Home Assistant
     */
    async testConnection() {
        try {
            const response = await this.haClient.get('/api/');
            this.isConnected = response.status === 200;
            logger_1.logger.info(`Home Assistant connection test: ${this.isConnected ? 'success' : 'failed'}`);
            return this.isConnected;
        }
        catch (error) {
            this.isConnected = false;
            logger_1.logger.error('Failed to connect to Home Assistant:', error);
            return false;
        }
    }
    /**
     * Send notification for an alert
     */
    async sendAlertNotification(alert) {
        if (!this.isConnected) {
            logger_1.logger.warn('Cannot send notification - not connected to Home Assistant');
            return false;
        }
        try {
            // Get notification config for alert type
            const config = this.getNotificationConfig(alert);
            if (!config || !config.enabled) {
                logger_1.logger.debug(`Notifications disabled for alert type: ${alert.type}`);
                return true; // Not an error, just disabled
            }
            // Format notification payload
            const payload = this.formatNotificationPayload(alert, config);
            // Send to Home Assistant notification service
            await this.sendToHAService(config.service, payload);
            logger_1.logger.info(`Notification sent for alert: ${alert.id}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to send notification for alert ${alert.id}:`, error);
            return false;
        }
    }
    /**
     * Send recovery notification
     */
    async sendRecoveryNotification(alert) {
        if (!this.isConnected) {
            logger_1.logger.warn('Cannot send recovery notification - not connected to Home Assistant');
            return false;
        }
        try {
            const config = this.getNotificationConfig(alert);
            if (!config || !config.enabled) {
                return true;
            }
            const payload = this.formatRecoveryNotificationPayload(alert, config);
            await this.sendToHAService(config.service, payload);
            logger_1.logger.info(`Recovery notification sent for: ${alert.target_name}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to send recovery notification for ${alert.target_name}:`, error);
            return false;
        }
    }
    /**
     * Add or update notification configuration
     */
    addNotificationConfig(config) {
        this.notificationConfigs.set(config.service, config);
        logger_1.logger.debug(`Notification config updated for service: ${config.service}`);
    }
    /**
     * Remove notification configuration
     */
    removeNotificationConfig(service) {
        this.notificationConfigs.delete(service);
        logger_1.logger.debug(`Notification config removed for service: ${service}`);
    }
    /**
     * Get all notification configurations
     */
    getNotificationConfigs() {
        return Array.from(this.notificationConfigs.values());
    }
    /**
     * Update Home Assistant configuration
     */
    updateHAConfig(haConfig) {
        this.haConfig = haConfig;
        this.haClient.defaults.baseURL = haConfig.url;
        this.haClient.defaults.headers['Authorization'] = `Bearer ${haConfig.token}`;
        this.isConnected = false; // Reset connection status
        logger_1.logger.info('Home Assistant configuration updated');
    }
    /**
     * Initialize default notification configurations
     */
    initializeDefaultConfigs() {
        // Default mobile notification config
        const mobileConfig = {
            service: 'mobile_app_notification',
            title_template: 'Network Monitor Alert',
            message_template: '{{alert.message}}',
            enabled: true
        };
        // Default persistent notification config
        const persistentConfig = {
            service: 'persistent_notification',
            title_template: 'Network Monitor: {{alert.type | title}} Alert',
            message_template: '{{alert.message}}\n\nTarget: {{alert.target_name}}\nTime: {{alert.timestamp | timestamp_local}}',
            enabled: true
        };
        this.addNotificationConfig(mobileConfig);
        this.addNotificationConfig(persistentConfig);
    }
    /**
     * Get notification configuration for alert
     */
    getNotificationConfig(alert) {
        // Try to find specific config for alert type, fallback to default
        const specificConfig = this.notificationConfigs.get(`${alert.type}_notification`);
        if (specificConfig) {
            return specificConfig;
        }
        // Use persistent notification as default
        return this.notificationConfigs.get('persistent_notification');
    }
    /**
     * Format notification payload for alert
     */
    formatNotificationPayload(alert, config) {
        const title = this.processTemplate(config.title_template, alert);
        const message = this.processTemplate(config.message_template, alert);
        const payload = {
            title,
            message,
            data: {
                tag: `network_monitor_${alert.target_name}`,
                group: 'network_monitoring',
                importance: this.mapSeverityToImportance(alert.severity),
                persistent: alert.severity === 'critical' || alert.severity === 'error',
                actions: [
                    {
                        action: 'acknowledge',
                        title: 'Acknowledge'
                    },
                    {
                        action: 'view_details',
                        title: 'View Details'
                    }
                ]
            }
        };
        return payload;
    }
    /**
     * Format recovery notification payload
     */
    formatRecoveryNotificationPayload(alert, config) {
        const title = 'Network Monitor: Recovery';
        const message = this.processTemplate(config.message_template, alert);
        return {
            title,
            message,
            data: {
                tag: `network_monitor_${alert.target_name}`,
                group: 'network_monitoring',
                importance: 'default',
                persistent: false
            }
        };
    }
    /**
     * Send notification to Home Assistant service
     */
    async sendToHAService(service, payload) {
        const endpoint = `/api/services/notify/${service}`;
        const requestPayload = {
            title: payload.title,
            message: payload.message,
            ...(payload.data && { data: payload.data })
        };
        await this.haClient.post(endpoint, requestPayload);
    }
    /**
     * Process template string with alert data
     */
    processTemplate(template, alert) {
        return template
            .replace(/\{\{alert\.message\}\}/g, alert.message)
            .replace(/\{\{alert\.type\s*\|\s*title\}\}/g, this.titleCase(alert.type))
            .replace(/\{\{alert\.type\}\}/g, alert.type)
            .replace(/\{\{alert\.target_name\}\}/g, alert.target_name)
            .replace(/\{\{alert\.severity\}\}/g, alert.severity)
            .replace(/\{\{alert\.timestamp\s*\|\s*timestamp_local\}\}/g, alert.timestamp.toLocaleString())
            .replace(/\{\{alert\.timestamp\}\}/g, alert.timestamp.toISOString());
    }
    /**
     * Convert string to title case
     */
    titleCase(str) {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    /**
     * Map alert severity to Home Assistant importance level
     */
    mapSeverityToImportance(severity) {
        switch (severity) {
            case 'critical':
                return 'max';
            case 'error':
                return 'high';
            case 'warning':
                return 'default';
            case 'info':
                return 'low';
            default:
                return 'default';
        }
    }
}
exports.HANotificationService = HANotificationService;
//# sourceMappingURL=ha-notification-service.js.map