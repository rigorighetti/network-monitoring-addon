/**
 * Integrated alert service that combines AlertManager with Home Assistant notifications
 */

import { AlertManager } from './alert-manager';
import { HANotificationService } from './ha-notification-service';
import { Alert, NotificationConfig } from '../types/alerts';
import { PingResult, DNSResult } from '../types/results';
import { AlertThresholds, HomeAssistantConfig } from '../types/config';
import { logger } from '../utils/logger';

export class IntegratedAlertService {
  private alertManager: AlertManager;
  private notificationService: HANotificationService;
  private isRunning = false;

  constructor(alertThresholds: AlertThresholds, haConfig: HomeAssistantConfig) {
    this.alertManager = new AlertManager(alertThresholds);
    this.notificationService = new HANotificationService(haConfig);

    // Connect alert manager events to notification service
    this.setupEventHandlers();
  }

  /**
   * Start the integrated alert service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('IntegratedAlertService is already running');
      return;
    }

    try {
      // Test Home Assistant connection
      const connected = await this.notificationService.testConnection();
      if (!connected) {
        logger.warn('Home Assistant connection failed - notifications may not work');
      }

      // Start alert manager
      this.alertManager.start();
      this.isRunning = true;
      
      logger.info('Integrated Alert Service started successfully');
    } catch (error) {
      logger.error('Failed to start Integrated Alert Service:', error);
      throw error;
    }
  }

  /**
   * Stop the integrated alert service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.alertManager.stop();
    this.isRunning = false;
    logger.info('Integrated Alert Service stopped');
  }

  /**
   * Process ping result
   */
  processPingResult(result: PingResult): void {
    if (!this.isRunning) {
      return;
    }
    this.alertManager.processPingResult(result);
  }

  /**
   * Process DNS result
   */
  processDNSResult(result: DNSResult): void {
    if (!this.isRunning) {
      return;
    }
    this.alertManager.processDNSResult(result);
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(thresholds: AlertThresholds): void {
    this.alertManager.updateThresholds(thresholds);
  }

  /**
   * Update Home Assistant configuration
   */
  updateHAConfig(haConfig: HomeAssistantConfig): void {
    this.notificationService.updateHAConfig(haConfig);
  }

  /**
   * Add notification configuration
   */
  addNotificationConfig(config: NotificationConfig): void {
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
  acknowledgeAlert(alertId: string): void {
    this.alertManager.acknowledgeAlert(alertId);
  }

  /**
   * Get notification configurations
   */
  getNotificationConfigs(): NotificationConfig[] {
    return this.notificationService.getNotificationConfigs();
  }

  /**
   * Setup event handlers to connect AlertManager with NotificationService
   */
  private setupEventHandlers(): void {
    // Handle alert generation
    this.alertManager.on('alert_generated', async (alert: Alert) => {
      try {
        if (alert.type === 'recovery') {
          await this.notificationService.sendRecoveryNotification(alert);
        } else {
          await this.notificationService.sendAlertNotification(alert);
        }
      } catch (error) {
        logger.error(`Failed to send notification for alert ${alert.id}:`, error);
      }
    });

    // Handle alert acknowledgment
    this.alertManager.on('alert_acknowledged', (alert: Alert) => {
      logger.info(`Alert acknowledged: ${alert.id} - ${alert.message}`);
    });

    // Handle alert resolution
    this.alertManager.on('alert_resolved', (alert: Alert) => {
      logger.info(`Alert resolved: ${alert.id} - ${alert.message}`);
    });
  }
}