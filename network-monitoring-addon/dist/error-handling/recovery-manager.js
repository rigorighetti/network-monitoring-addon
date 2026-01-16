"use strict";
/**
 * Recovery manager for automatic recovery mechanisms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryManager = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const error_types_1 = require("./error-types");
class RecoveryManager extends events_1.EventEmitter {
    constructor(errorHandler) {
        super();
        this.recoveryActions = new Map();
        this.recoveryAttempts = new Map();
        this.cooldownTimers = new Map();
        this.isRecoveryActive = false;
        this.logger = new logger_1.Logger('RecoveryManager');
        this.errorHandler = errorHandler;
        this.initializeRecoveryActions();
        this.setupErrorHandlerListeners();
    }
    /**
     * Register a recovery action for a specific component
     */
    registerRecoveryAction(action) {
        const key = `${action.component}:${action.name}`;
        this.recoveryActions.set(key, action);
        this.logger.info(`Registered recovery action: ${key}`);
    }
    /**
     * Attempt recovery for a specific error
     */
    async attemptRecovery(error) {
        if (this.isRecoveryActive) {
            this.logger.debug(`Recovery already active, queuing error ${error.id}`);
            return false;
        }
        const actionKey = this.getRecoveryActionKey(error);
        const action = this.recoveryActions.get(actionKey);
        if (!action) {
            this.logger.warn(`No recovery action found for error ${error.id} (${actionKey})`);
            return false;
        }
        // Check cooldown
        if (this.isInCooldown(actionKey)) {
            this.logger.debug(`Recovery action ${actionKey} is in cooldown`);
            return false;
        }
        // Check max attempts
        const attempts = this.getRecoveryAttempts(error.id);
        if (attempts.length >= action.max_attempts) {
            this.logger.warn(`Max recovery attempts (${action.max_attempts}) reached for error ${error.id}`);
            return false;
        }
        return await this.executeRecoveryAction(error, action);
    }
    /**
     * Get recovery statistics
     */
    getRecoveryStatistics() {
        const allAttempts = Array.from(this.recoveryAttempts.values()).flat();
        const successfulAttempts = allAttempts.filter(a => a.success);
        const failedAttempts = allAttempts.filter(a => !a.success);
        const attemptsByComponent = {};
        allAttempts.forEach(attempt => {
            const actionParts = attempt.action_name.split(':');
            if (actionParts.length > 0 && actionParts[0]) {
                const component = actionParts[0];
                attemptsByComponent[component] = (attemptsByComponent[component] || 0) + 1;
            }
        });
        // Get recent attempts (last 24 hours)
        const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentAttempts = allAttempts.filter(a => a.timestamp > recentCutoff);
        return {
            total_attempts: allAttempts.length,
            successful_attempts: successfulAttempts.length,
            failed_attempts: failedAttempts.length,
            success_rate: allAttempts.length > 0 ? successfulAttempts.length / allAttempts.length : 0,
            attempts_by_component: attemptsByComponent,
            recent_attempts: recentAttempts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)
        };
    }
    /**
     * Force recovery attempt for a component
     */
    async forceRecovery(component, actionName) {
        const actionKey = `${component}:${actionName}`;
        const action = this.recoveryActions.get(actionKey);
        if (!action) {
            this.logger.error(`Recovery action not found: ${actionKey}`);
            return false;
        }
        this.logger.info(`Forcing recovery action: ${actionKey}`);
        try {
            const startTime = Date.now();
            const success = await action.action();
            const duration = Date.now() - startTime;
            const attempt = {
                id: this.generateAttemptId(),
                error_id: 'manual-force',
                action_name: actionKey,
                timestamp: new Date(),
                success,
                duration_ms: duration
            };
            this.recordRecoveryAttempt('manual-force', attempt);
            this.emit('recoveryAttempt', attempt);
            if (success) {
                this.logger.info(`Forced recovery successful: ${actionKey} (${duration}ms)`);
            }
            else {
                this.logger.warn(`Forced recovery failed: ${actionKey} (${duration}ms)`);
            }
            return success;
        }
        catch (error) {
            const duration = Date.now() - Date.now();
            const attempt = {
                id: this.generateAttemptId(),
                error_id: 'manual-force',
                action_name: actionKey,
                timestamp: new Date(),
                success: false,
                duration_ms: duration,
                error_message: error instanceof Error ? error.message : 'Unknown error'
            };
            this.recordRecoveryAttempt('manual-force', attempt);
            this.emit('recoveryAttempt', attempt);
            this.logger.error(`Forced recovery error: ${actionKey}`, error);
            return false;
        }
    }
    /**
     * Clear recovery history
     */
    clearRecoveryHistory(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const cutoffTime = new Date(Date.now() - maxAge);
        let clearedCount = 0;
        for (const [errorId, attempts] of this.recoveryAttempts) {
            const filteredAttempts = attempts.filter(attempt => attempt.timestamp > cutoffTime);
            if (filteredAttempts.length !== attempts.length) {
                clearedCount += attempts.length - filteredAttempts.length;
                if (filteredAttempts.length > 0) {
                    this.recoveryAttempts.set(errorId, filteredAttempts);
                }
                else {
                    this.recoveryAttempts.delete(errorId);
                }
            }
        }
        if (clearedCount > 0) {
            this.logger.info(`Cleared ${clearedCount} old recovery attempts`);
        }
    }
    /**
     * Stop recovery manager
     */
    stop() {
        // Clear all cooldown timers
        for (const timer of this.cooldownTimers.values()) {
            clearTimeout(timer);
        }
        this.cooldownTimers.clear();
        this.logger.info('Recovery manager stopped');
    }
    /**
     * Initialize default recovery actions
     */
    initializeRecoveryActions() {
        // Ping monitor recovery
        this.registerRecoveryAction({
            name: 'restart_ping_monitoring',
            component: 'PingMonitor',
            action: async () => {
                this.logger.info('Attempting to restart ping monitoring');
                // This would be implemented by the calling component
                // For now, just simulate recovery
                await new Promise(resolve => setTimeout(resolve, 1000));
                return Math.random() > 0.3; // 70% success rate
            },
            cooldown_ms: 30000, // 30 seconds
            max_attempts: 3
        });
        // DNS monitor recovery
        this.registerRecoveryAction({
            name: 'restart_dns_monitoring',
            component: 'DNSMonitor',
            action: async () => {
                this.logger.info('Attempting to restart DNS monitoring');
                await new Promise(resolve => setTimeout(resolve, 1500));
                return Math.random() > 0.2; // 80% success rate
            },
            cooldown_ms: 60000, // 1 minute
            max_attempts: 5
        });
        // Network tool recovery
        this.registerRecoveryAction({
            name: 'reset_network_tools',
            component: 'NetworkTool',
            action: async () => {
                this.logger.info('Attempting to reset network tools');
                await new Promise(resolve => setTimeout(resolve, 500));
                return Math.random() > 0.1; // 90% success rate
            },
            cooldown_ms: 10000, // 10 seconds
            max_attempts: 3
        });
        // System resource recovery
        this.registerRecoveryAction({
            name: 'throttle_monitoring',
            component: 'SystemResource',
            action: async () => {
                this.logger.info('Attempting to throttle monitoring to reduce resource usage');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return Math.random() > 0.15; // 85% success rate
            },
            cooldown_ms: 120000, // 2 minutes
            max_attempts: 2
        });
    }
    /**
     * Setup error handler event listeners
     */
    setupErrorHandlerListeners() {
        this.errorHandler.on('error', async (error) => {
            if (this.shouldAttemptAutoRecovery(error)) {
                await this.attemptRecovery(error);
            }
        });
        this.errorHandler.on('criticalError', (systemHealth) => {
            this.logger.error('Critical system error detected, attempting emergency recovery');
            this.attemptEmergencyRecovery();
        });
    }
    /**
     * Execute a recovery action
     */
    async executeRecoveryAction(error, action) {
        this.isRecoveryActive = true;
        const startTime = Date.now();
        try {
            this.logger.info(`Executing recovery action: ${action.name} for error ${error.id}`);
            const success = await action.action();
            const duration = Date.now() - startTime;
            const attempt = {
                id: this.generateAttemptId(),
                error_id: error.id,
                action_name: `${action.component}:${action.name}`,
                timestamp: new Date(),
                success,
                duration_ms: duration
            };
            this.recordRecoveryAttempt(error.id, attempt);
            this.emit('recoveryAttempt', attempt);
            if (success) {
                this.logger.info(`Recovery successful: ${action.name} for error ${error.id} (${duration}ms)`);
                this.errorHandler.markErrorRecovered(error.id);
                this.setCooldown(`${action.component}:${action.name}`, action.cooldown_ms);
            }
            else {
                this.logger.warn(`Recovery failed: ${action.name} for error ${error.id} (${duration}ms)`);
            }
            return success;
        }
        catch (recoveryError) {
            const duration = Date.now() - startTime;
            const attempt = {
                id: this.generateAttemptId(),
                error_id: error.id,
                action_name: `${action.component}:${action.name}`,
                timestamp: new Date(),
                success: false,
                duration_ms: duration,
                error_message: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
            };
            this.recordRecoveryAttempt(error.id, attempt);
            this.emit('recoveryAttempt', attempt);
            this.logger.error(`Recovery action failed: ${action.name} for error ${error.id}`, recoveryError);
            return false;
        }
        finally {
            this.isRecoveryActive = false;
        }
    }
    /**
     * Get recovery action key for an error
     */
    getRecoveryActionKey(error) {
        switch (error.category) {
            case error_types_1.ErrorCategory.NETWORK_TOOL:
                return 'NetworkTool:reset_network_tools';
            case error_types_1.ErrorCategory.DNS_SERVER:
                return 'DNSMonitor:restart_dns_monitoring';
            case error_types_1.ErrorCategory.SYSTEM_RESOURCE:
                return 'SystemResource:throttle_monitoring';
            case error_types_1.ErrorCategory.TEMPORARY_FAILURE:
                if (error.component === 'PingMonitor') {
                    return 'PingMonitor:restart_ping_monitoring';
                }
                else if (error.component === 'DNSMonitor') {
                    return 'DNSMonitor:restart_dns_monitoring';
                }
                return 'NetworkTool:reset_network_tools';
            default:
                return 'NetworkTool:reset_network_tools';
        }
    }
    /**
     * Check if recovery action is in cooldown
     */
    isInCooldown(actionKey) {
        return this.cooldownTimers.has(actionKey);
    }
    /**
     * Set cooldown for recovery action
     */
    setCooldown(actionKey, cooldownMs) {
        const timer = setTimeout(() => {
            this.cooldownTimers.delete(actionKey);
            this.logger.debug(`Cooldown expired for recovery action: ${actionKey}`);
        }, cooldownMs);
        this.cooldownTimers.set(actionKey, timer);
        this.logger.debug(`Set cooldown for recovery action: ${actionKey} (${cooldownMs}ms)`);
    }
    /**
     * Get recovery attempts for an error
     */
    getRecoveryAttempts(errorId) {
        return this.recoveryAttempts.get(errorId) || [];
    }
    /**
     * Record a recovery attempt
     */
    recordRecoveryAttempt(errorId, attempt) {
        const attempts = this.recoveryAttempts.get(errorId) || [];
        attempts.push(attempt);
        this.recoveryAttempts.set(errorId, attempts);
    }
    /**
     * Check if automatic recovery should be attempted
     */
    shouldAttemptAutoRecovery(error) {
        // Don't attempt recovery for configuration errors
        if (error.category === error_types_1.ErrorCategory.CONFIGURATION) {
            return false;
        }
        // Don't attempt recovery for permanent failures
        if (error.category === error_types_1.ErrorCategory.PERMANENT_FAILURE) {
            return false;
        }
        // Always attempt recovery for temporary failures and network issues
        return true;
    }
    /**
     * Attempt emergency recovery for critical system errors
     */
    async attemptEmergencyRecovery() {
        this.logger.warn('Attempting emergency recovery procedures');
        // Try to restart all monitoring components
        const emergencyActions = [
            'PingMonitor:restart_ping_monitoring',
            'DNSMonitor:restart_dns_monitoring',
            'NetworkTool:reset_network_tools'
        ];
        for (const actionKey of emergencyActions) {
            const actionParts = actionKey.split(':');
            if (actionParts.length >= 2 && actionParts[0] && actionParts[1]) {
                const [component, actionName] = actionParts;
                try {
                    await this.forceRecovery(component, actionName);
                }
                catch (error) {
                    this.logger.error(`Emergency recovery failed for ${actionKey}:`, error);
                }
            }
        }
    }
    /**
     * Generate unique attempt ID
     */
    generateAttemptId() {
        return `attempt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.RecoveryManager = RecoveryManager;
//# sourceMappingURL=recovery-manager.js.map