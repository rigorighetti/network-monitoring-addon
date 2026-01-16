/**
 * Alert Manager component for configurable threshold monitoring and notification generation
 */
import { EventEmitter } from 'events';
import { AlertRule, NotificationConfig, AlertManagerState } from '../types/alerts';
import { PingResult, DNSResult } from '../types/results';
import { AlertThresholds } from '../types/config';
export declare class AlertManager extends EventEmitter {
    private alertRules;
    private activeAlerts;
    private notificationConfigs;
    private targetStates;
    private consecutiveFailures;
    private lastAlertTimes;
    private alertThresholds;
    private isRunning;
    constructor(alertThresholds: AlertThresholds);
    /**
     * Start the alert manager
     */
    start(): void;
    /**
     * Stop the alert manager
     */
    stop(): void;
    /**
     * Process a ping result and check for alert conditions
     */
    processPingResult(result: PingResult): void;
    /**
     * Process a DNS result and check for alert conditions
     */
    processDNSResult(result: DNSResult): void;
    /**
     * Update alert thresholds
     */
    updateThresholds(thresholds: AlertThresholds): void;
    /**
     * Add or update an alert rule
     */
    addAlertRule(rule: AlertRule): void;
    /**
     * Remove an alert rule
     */
    removeAlertRule(ruleId: string): void;
    /**
     * Add or update notification configuration
     */
    addNotificationConfig(config: NotificationConfig): void;
    /**
     * Get current alert manager state
     */
    getState(): AlertManagerState;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): void;
    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): void;
    /**
     * Initialize default alert rules based on thresholds
     */
    private initializeDefaultRules;
    /**
     * Update target state based on monitoring result
     */
    private updateTargetState;
    /**
     * Determine status based on result
     */
    private determineStatus;
    /**
     * Check alert conditions for a target
     */
    private checkAlertConditions;
    /**
     * Evaluate if an alert condition is met
     */
    private evaluateAlertCondition;
    /**
     * Generate an alert
     */
    private generateAlert;
    /**
     * Check for recovery condition and generate recovery notification
     */
    private checkRecoveryCondition;
    /**
     * Determine alert type based on rule
     */
    private determineAlertType;
    /**
     * Determine alert severity
     */
    private determineSeverity;
    /**
     * Generate alert message
     */
    private generateAlertMessage;
}
//# sourceMappingURL=alert-manager.d.ts.map