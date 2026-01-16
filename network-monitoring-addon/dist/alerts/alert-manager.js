"use strict";
/**
 * Alert Manager component for configurable threshold monitoring and notification generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertManager = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class AlertManager extends events_1.EventEmitter {
    constructor(alertThresholds) {
        super();
        this.alertRules = new Map();
        this.activeAlerts = new Map();
        this.notificationConfigs = new Map();
        this.targetStates = new Map();
        this.consecutiveFailures = new Map();
        this.lastAlertTimes = new Map();
        this.isRunning = false;
        this.alertThresholds = alertThresholds;
        this.initializeDefaultRules();
    }
    /**
     * Start the alert manager
     */
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('AlertManager is already running');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting Alert Manager');
    }
    /**
     * Stop the alert manager
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        logger_1.logger.info('Stopping Alert Manager');
        this.isRunning = false;
    }
    /**
     * Process a ping result and check for alert conditions
     */
    processPingResult(result) {
        if (!this.isRunning) {
            return;
        }
        const targetKey = `ping_${result.target_name}`;
        this.updateTargetState(targetKey, result);
        this.checkAlertConditions(targetKey, 'ping', result);
    }
    /**
     * Process a DNS result and check for alert conditions
     */
    processDNSResult(result) {
        if (!this.isRunning) {
            return;
        }
        const targetKey = `dns_${result.server_name}`;
        this.updateTargetState(targetKey, result);
        this.checkAlertConditions(targetKey, 'dns', result);
    }
    /**
     * Update alert thresholds
     */
    updateThresholds(thresholds) {
        this.alertThresholds = thresholds;
        logger_1.logger.info('Alert thresholds updated');
    }
    /**
     * Add or update an alert rule
     */
    addAlertRule(rule) {
        this.alertRules.set(rule.id, rule);
        logger_1.logger.debug(`Alert rule added/updated: ${rule.name}`);
    }
    /**
     * Remove an alert rule
     */
    removeAlertRule(ruleId) {
        this.alertRules.delete(ruleId);
        logger_1.logger.debug(`Alert rule removed: ${ruleId}`);
    }
    /**
     * Add or update notification configuration
     */
    addNotificationConfig(config) {
        this.notificationConfigs.set(config.service, config);
        logger_1.logger.debug(`Notification config added/updated: ${config.service}`);
    }
    /**
     * Get current alert manager state
     */
    getState() {
        return {
            active_alerts: Array.from(this.activeAlerts.values()),
            alert_rules: Array.from(this.alertRules.values()),
            notification_configs: Array.from(this.notificationConfigs.values()),
            last_check: new Date()
        };
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            logger_1.logger.info(`Alert acknowledged: ${alertId}`);
            this.emit('alert_acknowledged', alert);
        }
    }
    /**
     * Resolve an alert
     */
    resolveAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.resolved = true;
            this.activeAlerts.delete(alertId);
            logger_1.logger.info(`Alert resolved: ${alertId}`);
            this.emit('alert_resolved', alert);
        }
    }
    /**
     * Initialize default alert rules based on thresholds
     */
    initializeDefaultRules() {
        // Ping connectivity failure rule
        const pingFailureRule = {
            id: 'ping_connectivity_failure',
            name: 'Ping Connectivity Failure',
            target_type: 'ping',
            condition: {
                metric: 'availability',
                operator: 'equals',
                value: 0
            },
            threshold_value: 0,
            consecutive_failures: this.alertThresholds.consecutive_failures,
            enabled: true
        };
        // Ping high latency rule
        const pingLatencyRule = {
            id: 'ping_high_latency',
            name: 'Ping High Latency',
            target_type: 'ping',
            condition: {
                metric: 'response_time',
                operator: 'greater_than',
                value: this.alertThresholds.ping_timeout_ms
            },
            threshold_value: this.alertThresholds.ping_timeout_ms,
            consecutive_failures: 1,
            enabled: true
        };
        // Ping packet loss rule
        const pingPacketLossRule = {
            id: 'ping_packet_loss',
            name: 'Ping Packet Loss',
            target_type: 'ping',
            condition: {
                metric: 'packet_loss',
                operator: 'greater_than',
                value: this.alertThresholds.ping_loss_percent
            },
            threshold_value: this.alertThresholds.ping_loss_percent,
            consecutive_failures: 1,
            enabled: true
        };
        // DNS failure rule
        const dnsFailureRule = {
            id: 'dns_resolution_failure',
            name: 'DNS Resolution Failure',
            target_type: 'dns',
            condition: {
                metric: 'availability',
                operator: 'equals',
                value: 0
            },
            threshold_value: 0,
            consecutive_failures: this.alertThresholds.consecutive_failures,
            enabled: true
        };
        // DNS high latency rule
        const dnsLatencyRule = {
            id: 'dns_high_latency',
            name: 'DNS High Latency',
            target_type: 'dns',
            condition: {
                metric: 'response_time',
                operator: 'greater_than',
                value: this.alertThresholds.dns_timeout_ms
            },
            threshold_value: this.alertThresholds.dns_timeout_ms,
            consecutive_failures: 1,
            enabled: true
        };
        // Add default rules
        this.addAlertRule(pingFailureRule);
        this.addAlertRule(pingLatencyRule);
        this.addAlertRule(pingPacketLossRule);
        this.addAlertRule(dnsFailureRule);
        this.addAlertRule(dnsLatencyRule);
        logger_1.logger.info('Default alert rules initialized');
    }
    /**
     * Update target state based on monitoring result
     */
    updateTargetState(targetKey, result) {
        const currentFailures = this.consecutiveFailures.get(targetKey) || 0;
        if (!result.success) {
            this.consecutiveFailures.set(targetKey, currentFailures + 1);
        }
        else {
            // Reset consecutive failures on success
            if (currentFailures > 0) {
                this.consecutiveFailures.set(targetKey, 0);
                // Check for recovery notification
                this.checkRecoveryCondition(targetKey, result);
            }
        }
        // Update target state
        const status = {
            target_name: 'target_name' in result ? result.target_name : result.server_name,
            target_type: 'target_name' in result ? 'ping' : 'dns',
            status: this.determineStatus(result),
            last_success: result.success ? result.timestamp : this.targetStates.get(targetKey)?.last_success || new Date(0),
            consecutive_failures: this.consecutiveFailures.get(targetKey) || 0,
            ...(result.response_time_ms !== null && { current_response_time: result.response_time_ms }),
            ...(result.packet_loss_percent !== undefined && {
                current_packet_loss: result.packet_loss_percent
            })
        };
        this.targetStates.set(targetKey, status);
    }
    /**
     * Determine status based on result
     */
    determineStatus(result) {
        if (!result.success) {
            return 'target_name' in result ? 'offline' : 'unavailable';
        }
        if (result.response_time_ms) {
            const threshold = 'target_name' in result ?
                this.alertThresholds.ping_timeout_ms :
                this.alertThresholds.dns_timeout_ms;
            if (result.response_time_ms > threshold) {
                return 'target_name' in result ? 'degraded' : 'slow';
            }
        }
        return 'target_name' in result ? 'online' : 'available';
    }
    /**
     * Check alert conditions for a target
     */
    checkAlertConditions(targetKey, targetType, result) {
        const targetState = this.targetStates.get(targetKey);
        if (!targetState) {
            return;
        }
        // Check each alert rule
        for (const rule of this.alertRules.values()) {
            if (!rule.enabled || rule.target_type !== targetType) {
                continue;
            }
            if (this.evaluateAlertCondition(rule, result, targetState)) {
                this.generateAlert(rule, targetState, result);
            }
        }
    }
    /**
     * Evaluate if an alert condition is met
     */
    evaluateAlertCondition(rule, result, targetState) {
        const { condition } = rule;
        let metricValue;
        // Get metric value based on condition
        switch (condition.metric) {
            case 'response_time':
                metricValue = result.response_time_ms || 0;
                break;
            case 'packet_loss':
                metricValue = result.packet_loss_percent || 0;
                break;
            case 'availability':
                metricValue = result.success ? 1 : 0;
                break;
            case 'success_rate':
                // This would require historical data - simplified for now
                metricValue = result.success ? 100 : 0;
                break;
            default:
                return false;
        }
        // Evaluate condition
        let conditionMet = false;
        switch (condition.operator) {
            case 'greater_than':
                conditionMet = metricValue > condition.value;
                break;
            case 'less_than':
                conditionMet = metricValue < condition.value;
                break;
            case 'equals':
                conditionMet = metricValue === condition.value;
                break;
            case 'not_equals':
                conditionMet = metricValue !== condition.value;
                break;
        }
        // Check consecutive failures requirement
        if (conditionMet && rule.consecutive_failures > 1) {
            return targetState.consecutive_failures >= rule.consecutive_failures;
        }
        return conditionMet;
    }
    /**
     * Generate an alert
     */
    generateAlert(rule, targetState, result) {
        const alertId = `${rule.id}_${targetState.target_name}_${Date.now()}`;
        // Check if we already have a recent alert for this rule and target
        const recentAlertKey = `${rule.id}_${targetState.target_name}`;
        const lastAlertTime = this.lastAlertTimes.get(recentAlertKey);
        const now = new Date();
        // Prevent alert spam - don't generate alerts more than once every 5 minutes for the same condition
        if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < 5 * 60 * 1000) {
            return;
        }
        const alert = {
            id: alertId,
            type: this.determineAlertType(rule),
            severity: this.determineSeverity(rule, targetState),
            target_name: targetState.target_name,
            target_type: targetState.target_type,
            message: this.generateAlertMessage(rule, targetState, result),
            timestamp: now,
            acknowledged: false,
            resolved: false
        };
        this.activeAlerts.set(alertId, alert);
        this.lastAlertTimes.set(recentAlertKey, now);
        logger_1.logger.warn(`Alert generated: ${alert.message}`);
        this.emit('alert_generated', alert);
    }
    /**
     * Check for recovery condition and generate recovery notification
     */
    checkRecoveryCondition(targetKey, result) {
        const targetState = this.targetStates.get(targetKey);
        if (!targetState) {
            return;
        }
        // Find any active alerts for this target
        const targetAlerts = Array.from(this.activeAlerts.values())
            .filter(alert => alert.target_name === targetState.target_name && !alert.resolved);
        if (targetAlerts.length > 0) {
            // Generate recovery notification
            const recoveryAlert = {
                id: `recovery_${targetState.target_name}_${Date.now()}`,
                type: 'recovery',
                severity: 'info',
                target_name: targetState.target_name,
                target_type: targetState.target_type,
                message: `${targetState.target_name} has recovered. ${targetState.target_type === 'ping' ? 'Connectivity' : 'DNS resolution'} restored.`,
                timestamp: new Date(),
                acknowledged: false,
                resolved: false
            };
            logger_1.logger.info(`Recovery detected: ${recoveryAlert.message}`);
            this.emit('alert_generated', recoveryAlert);
            // Resolve related alerts
            targetAlerts.forEach(alert => {
                this.resolveAlert(alert.id);
            });
        }
    }
    /**
     * Determine alert type based on rule
     */
    determineAlertType(rule) {
        if (rule.condition.metric === 'availability') {
            return rule.target_type === 'ping' ? 'connectivity' : 'dns';
        }
        else if (rule.condition.metric === 'response_time') {
            return 'performance';
        }
        else {
            return rule.target_type === 'ping' ? 'connectivity' : 'dns';
        }
    }
    /**
     * Determine alert severity
     */
    determineSeverity(rule, targetState) {
        if (rule.condition.metric === 'availability' && rule.condition.value === 0) {
            return 'critical'; // Complete failure
        }
        else if (targetState.consecutive_failures >= this.alertThresholds.consecutive_failures) {
            return 'error'; // Persistent issues
        }
        else if (rule.condition.metric === 'response_time') {
            return 'warning'; // Performance issues
        }
        else {
            return 'warning'; // Default
        }
    }
    /**
     * Generate alert message
     */
    generateAlertMessage(rule, targetState, result) {
        const targetName = targetState.target_name;
        const targetType = targetState.target_type;
        switch (rule.condition.metric) {
            case 'availability':
                if (targetType === 'ping') {
                    return `Ping connectivity failed for ${targetName}. ${targetState.consecutive_failures} consecutive failures.`;
                }
                else {
                    return `DNS resolution failed for ${targetName}. ${targetState.consecutive_failures} consecutive failures.`;
                }
            case 'response_time':
                const responseTime = result.response_time_ms || 0;
                const threshold = rule.threshold_value;
                if (targetType === 'ping') {
                    return `High ping latency detected for ${targetName}: ${responseTime}ms (threshold: ${threshold}ms)`;
                }
                else {
                    return `Slow DNS response detected for ${targetName}: ${responseTime}ms (threshold: ${threshold}ms)`;
                }
            case 'packet_loss':
                const packetLoss = result.packet_loss_percent || 0;
                return `Packet loss detected for ${targetName}: ${packetLoss}% (threshold: ${rule.threshold_value}%)`;
            default:
                return `Alert condition met for ${targetName}: ${rule.name}`;
        }
    }
}
exports.AlertManager = AlertManager;
//# sourceMappingURL=alert-manager.js.map