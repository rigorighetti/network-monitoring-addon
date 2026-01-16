"use strict";
/**
 * Integrated alert service that combines AlertManager with Home Assistant notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegratedAlertService = void 0;
const alert_manager_1 = require("./alert-manager");
const ha_notification_service_1 = require("./ha-notification-service");
const logger_1 = require("../utils/logger");
class IntegratedAlertService {
    constructor(alertThresholds, haConfig) {
        this.isRunning = false;
        this.alertManager = new alert_manager_1.AlertManager(alertThresholds);
        this.notificationService = new ha_notification_service_1.HANotificationService(haConfig);
        // Connect alert manager events to notification service
        this.setupEventHandlers();
    }
    /**
     * Start the integrated alert service
     */
    async start() {
        if (this.isRunning) {
            logger_1.logger.warn('IntegratedAlertService is already running');
            return;
        }
        try {
            // Test Home Assistant connection
            const connected = await this.notificationService.testConnection();
            if (!connected) {
                logger_1.logger.warn('Home Assistant connection failed - notifications may not work');
            }
            // Start alert manager
            this.alertManager.start();
            this.isRunning = true;
            logger_1.logger.info('Integrated Alert Service started successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to start Integrated Alert Service:', error);
            throw error;
        }
    }
    /**
     * Stop the integrated alert service
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.alertManager.stop();
        this.isRunning = false;
        logger_1.logger.info('Integrated Alert Service stopped');
    }
    /**
     * Process ping result
     */
    processPingResult(result) {
        if (!this.isRunning) {
            return;
        }
        this.alertManager.processPingResult(result);
    }
    /**
     * Process DNS result
     */
    processDNSResult(result) {
        if (!this.isRunning) {
            return;
        }
        this.alertManager.processDNSResult(result);
    }
    /**
     * Update alert thresholds
     */
    updateThresholds(thresholds) {
        this.alertManager.updateThresholds(thresholds);
    }
    /**
     * Update Home Assistant configuration
     */
    updateHAConfig(haConfig) {
        this.notificationService.updateHAConfig(haConfig);
    }
    /**
     * Add notification configuration
     */
    addNotificationConfig(config) {
        this.alertManager.addNotificationConfig(config);
        this.notificationService.addNotificationConfig(config);
    }
    /**
     * Get current alert manager state
     */
    getState() {
        return this.alertManager.getState();
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId) {
        this.alertManager.acknowledgeAlert(alertId);
    }
    /**
     * Get notification configurations
     */
    getNotificationConfigs() {
        return this.notificationService.getNotificationConfigs();
    }
    /**
     * Setup event handlers to connect AlertManager with NotificationService
     */
    setupEventHandlers() {
        // Handle alert generation
        this.alertManager.on('alert_generated', async (alert) => {
            try {
                if (alert.type === 'recovery') {
                    await this.notificationService.sendRecoveryNotification(alert);
                }
                else {
                    await this.notificationService.sendAlertNotification(alert);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to send notification for alert ${alert.id}:`, error);
            }
        });
        // Handle alert acknowledgment
        this.alertManager.on('alert_acknowledged', (alert) => {
            logger_1.logger.info(`Alert acknowledged: ${alert.id} - ${alert.message}`);
        });
        // Handle alert resolution
        this.alertManager.on('alert_resolved', (alert) => {
            logger_1.logger.info(`Alert resolved: ${alert.id} - ${alert.message}`);
        });
    }
}
exports.IntegratedAlertService = IntegratedAlertService;
//# sourceMappingURL=integrated-alert-service.js.map