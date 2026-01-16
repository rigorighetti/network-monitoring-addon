"use strict";
/**
 * Comprehensive error handler for network monitoring operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const error_types_1 = require("./error-types");
class ErrorHandler extends events_1.EventEmitter {
    constructor() {
        super();
        this.errors = new Map();
        this.recoveryStrategies = new Map();
        this.componentHealth = new Map();
        this.isRecoveryInProgress = false;
        this.logger = new logger_1.Logger('ErrorHandler');
        this.initializeRecoveryStrategies();
        this.startHealthMonitoring();
    }
    /**
     * Handle an error with automatic recovery attempts
     */
    async handleError(error, context) {
        let networkError;
        if (error instanceof error_types_1.NetworkMonitoringError) {
            networkError = error.toJSON();
        }
        else {
            // Convert generic error to NetworkError
            networkError = {
                id: this.generateErrorId(),
                timestamp: new Date(),
                category: this.categorizeError(error),
                severity: this.assessSeverity(error),
                component: context?.component || 'unknown',
                message: error.message,
                recovery_attempted: false,
                retry_count: 0,
                max_retries: this.getMaxRetries(this.categorizeError(error)),
                ...(context?.target && { target: context.target }),
                ...(context && { details: { ...context, originalError: error.name } }),
                ...(error.stack && { stack_trace: error.stack })
            };
        }
        // Store the error
        this.errors.set(networkError.id, networkError);
        // Log the error
        this.logError(networkError);
        // Update component health
        this.updateComponentHealth(networkError);
        // Emit error event
        this.emit('error', networkError);
        // Attempt recovery if appropriate
        if (this.shouldAttemptRecovery(networkError)) {
            await this.attemptRecovery(networkError);
        }
        // Check if system health is critical
        const systemHealth = this.getSystemHealth();
        if (systemHealth.overall_status === 'critical') {
            this.emit('criticalError', systemHealth);
        }
    }
    /**
     * Handle network tool execution failures
     */
    async handleNetworkToolFailure(tool, target, error, retryCount = 0) {
        const networkError = new error_types_1.NetworkMonitoringError(`Network tool '${tool}' failed for target '${target}': ${error.message}`, error_types_1.ErrorCategory.NETWORK_TOOL, retryCount > 2 ? error_types_1.ErrorSeverity.HIGH : error_types_1.ErrorSeverity.MEDIUM, 'NetworkTool', target, { tool, retryCount, originalError: error.message });
        await this.handleError(networkError);
    }
    /**
     * Handle DNS server unreachability
     */
    async handleDNSServerUnreachable(serverIP, domain, error, consecutiveFailures = 0) {
        try {
            const severity = consecutiveFailures > 5 ? error_types_1.ErrorSeverity.HIGH : error_types_1.ErrorSeverity.MEDIUM;
            const networkError = new error_types_1.NetworkMonitoringError(`DNS server '${serverIP}' unreachable for domain '${domain}': ${error.message}`, error_types_1.ErrorCategory.DNS_SERVER, severity, 'DNSMonitor', serverIP, { domain, consecutiveFailures, originalError: error.message });
            await this.handleError(networkError);
        }
        catch (handlingError) {
            // If error handling itself fails, just log it and don't propagate
            this.logger.error(`Failed to handle DNS server unreachable error:`, handlingError);
        }
    }
    /**
     * Handle system resource limitations
     */
    async handleResourceLimitation(resource, usage, limit, component) {
        const networkError = new error_types_1.NetworkMonitoringError(`System resource '${resource}' usage (${usage}) exceeds limit (${limit})`, error_types_1.ErrorCategory.SYSTEM_RESOURCE, error_types_1.ErrorSeverity.HIGH, component, undefined, { resource, usage, limit, usagePercent: (usage / limit) * 100 });
        await this.handleError(networkError);
    }
    /**
     * Handle temporary failures with automatic retry
     */
    async handleTemporaryFailure(operation, target, error, component, retryCount = 0) {
        const networkError = new error_types_1.NetworkMonitoringError(`Temporary failure in '${operation}' for target '${target}': ${error.message}`, error_types_1.ErrorCategory.TEMPORARY_FAILURE, error_types_1.ErrorSeverity.LOW, component, target, { operation, retryCount, originalError: error.message });
        await this.handleError(networkError);
    }
    /**
     * Mark error as recovered
     */
    markErrorRecovered(errorId) {
        const error = this.errors.get(errorId);
        if (error) {
            error.recovery_successful = true;
            this.logger.info(`Error ${errorId} marked as recovered`);
            this.emit('errorRecovered', error);
            // Update component health
            this.updateComponentHealthOnRecovery(error);
        }
    }
    /**
     * Get current system health status
     */
    getSystemHealth() {
        const activeErrors = Array.from(this.errors.values()).filter(error => !error.recovery_successful);
        const componentHealthArray = Array.from(this.componentHealth.values());
        // Determine overall status
        let overallStatus = 'healthy';
        const criticalErrors = activeErrors.filter(e => e.severity === error_types_1.ErrorSeverity.CRITICAL);
        const highErrors = activeErrors.filter(e => e.severity === error_types_1.ErrorSeverity.HIGH);
        const failedComponents = componentHealthArray.filter(c => c.status === 'failed');
        if (criticalErrors.length > 0 || failedComponents.length > componentHealthArray.length * 0.5) {
            overallStatus = 'critical';
        }
        else if (highErrors.length > 0 || activeErrors.length > 0) {
            overallStatus = 'degraded';
        }
        return {
            overall_status: overallStatus,
            component_health: componentHealthArray,
            active_errors: activeErrors,
            recovery_attempts: this.getTotalRecoveryAttempts(),
            last_health_check: new Date()
        };
    }
    /**
     * Get error statistics
     */
    getErrorStatistics() {
        const allErrors = Array.from(this.errors.values());
        const activeErrors = allErrors.filter(e => !e.recovery_successful);
        const recoveredErrors = allErrors.filter(e => e.recovery_successful);
        const errorsByCategory = {};
        const errorsBySeverity = {};
        // Initialize counters
        Object.values(error_types_1.ErrorCategory).forEach(category => {
            errorsByCategory[category] = 0;
        });
        Object.values(error_types_1.ErrorSeverity).forEach(severity => {
            errorsBySeverity[severity] = 0;
        });
        // Count errors
        allErrors.forEach(error => {
            errorsByCategory[error.category]++;
            errorsBySeverity[error.severity]++;
        });
        return {
            total_errors: allErrors.length,
            active_errors: activeErrors.length,
            recovered_errors: recoveredErrors.length,
            errors_by_category: errorsByCategory,
            errors_by_severity: errorsBySeverity
        };
    }
    /**
     * Clear old recovered errors (cleanup)
     */
    clearOldErrors(maxAge = 24 * 60 * 60 * 1000) {
        const cutoffTime = new Date(Date.now() - maxAge);
        let clearedCount = 0;
        for (const [id, error] of this.errors) {
            if (error.recovery_successful && error.timestamp < cutoffTime) {
                this.errors.delete(id);
                clearedCount++;
            }
        }
        if (clearedCount > 0) {
            this.logger.info(`Cleared ${clearedCount} old recovered errors`);
        }
    }
    /**
     * Stop error handling and cleanup
     */
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.logger.info('Error handler stopped');
    }
    /**
     * Initialize recovery strategies for different error categories
     */
    initializeRecoveryStrategies() {
        // Network tool failures - retry with exponential backoff
        this.recoveryStrategies.set(error_types_1.ErrorCategory.NETWORK_TOOL, {
            category: error_types_1.ErrorCategory.NETWORK_TOOL,
            max_retries: 3,
            retry_delay_ms: 1000,
            backoff_multiplier: 2,
            max_delay_ms: 10000,
            recovery_action: async (error) => {
                this.logger.info(`Attempting recovery for network tool error: ${error.id}`);
                // Recovery logic would be implemented by the calling component
                return true;
            }
        });
        // DNS server failures - retry with longer delays
        this.recoveryStrategies.set(error_types_1.ErrorCategory.DNS_SERVER, {
            category: error_types_1.ErrorCategory.DNS_SERVER,
            max_retries: 5,
            retry_delay_ms: 2000,
            backoff_multiplier: 1.5,
            max_delay_ms: 30000,
            recovery_action: async (error) => {
                this.logger.info(`Attempting recovery for DNS server error: ${error.id}`);
                return true;
            }
        });
        // Temporary failures - aggressive retry
        this.recoveryStrategies.set(error_types_1.ErrorCategory.TEMPORARY_FAILURE, {
            category: error_types_1.ErrorCategory.TEMPORARY_FAILURE,
            max_retries: 5,
            retry_delay_ms: 500,
            backoff_multiplier: 1.2,
            max_delay_ms: 5000,
            recovery_action: async (error) => {
                this.logger.info(`Attempting recovery for temporary failure: ${error.id}`);
                return true;
            }
        });
        // System resource issues - throttle and retry
        this.recoveryStrategies.set(error_types_1.ErrorCategory.SYSTEM_RESOURCE, {
            category: error_types_1.ErrorCategory.SYSTEM_RESOURCE,
            max_retries: 2,
            retry_delay_ms: 5000,
            backoff_multiplier: 2,
            max_delay_ms: 20000,
            recovery_action: async (error) => {
                this.logger.info(`Attempting recovery for system resource error: ${error.id}`);
                // Could implement throttling logic here
                return true;
            }
        });
    }
    /**
     * Attempt automatic recovery for an error
     */
    async attemptRecovery(error) {
        if (this.isRecoveryInProgress) {
            this.logger.debug(`Recovery already in progress, queuing error ${error.id}`);
            return;
        }
        const strategy = this.recoveryStrategies.get(error.category);
        if (!strategy || error.retry_count >= error.max_retries) {
            this.logger.warn(`No recovery strategy or max retries exceeded for error ${error.id}`);
            return;
        }
        this.isRecoveryInProgress = true;
        error.recovery_attempted = true;
        error.retry_count++;
        try {
            // Calculate delay with exponential backoff
            const delay = Math.min(strategy.retry_delay_ms * Math.pow(strategy.backoff_multiplier, error.retry_count - 1), strategy.max_delay_ms);
            this.logger.info(`Attempting recovery for error ${error.id} (attempt ${error.retry_count}/${error.max_retries}) after ${delay}ms`);
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delay));
            // Attempt recovery
            const success = await strategy.recovery_action(error);
            if (success) {
                error.recovery_successful = true;
                this.logger.info(`Recovery successful for error ${error.id}`);
                this.emit('recoverySuccess', error);
            }
            else {
                this.logger.warn(`Recovery failed for error ${error.id}`);
                this.emit('recoveryFailed', error);
            }
        }
        catch (recoveryError) {
            this.logger.error(`Recovery attempt failed for error ${error.id}:`, recoveryError);
            this.emit('recoveryFailed', error);
        }
        finally {
            this.isRecoveryInProgress = false;
        }
    }
    /**
     * Categorize error based on error message and type
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        if (message.includes('ping') || message.includes('network tool') || message.includes('command')) {
            return error_types_1.ErrorCategory.NETWORK_TOOL;
        }
        if (message.includes('dns') || message.includes('resolve') || message.includes('lookup')) {
            return error_types_1.ErrorCategory.DNS_SERVER;
        }
        if (message.includes('timeout') || message.includes('temporary')) {
            return error_types_1.ErrorCategory.TEMPORARY_FAILURE;
        }
        if (message.includes('resource') || message.includes('memory') || message.includes('cpu')) {
            return error_types_1.ErrorCategory.SYSTEM_RESOURCE;
        }
        if (message.includes('config') || message.includes('validation')) {
            return error_types_1.ErrorCategory.CONFIGURATION;
        }
        return error_types_1.ErrorCategory.TEMPORARY_FAILURE; // Default
    }
    /**
     * Assess error severity
     */
    assessSeverity(error) {
        const message = error.message.toLowerCase();
        if (message.includes('critical') || message.includes('fatal')) {
            return error_types_1.ErrorSeverity.CRITICAL;
        }
        if (message.includes('failed') || message.includes('error')) {
            return error_types_1.ErrorSeverity.HIGH;
        }
        if (message.includes('warning') || message.includes('degraded')) {
            return error_types_1.ErrorSeverity.MEDIUM;
        }
        return error_types_1.ErrorSeverity.LOW;
    }
    /**
     * Get max retries for error category
     */
    getMaxRetries(category) {
        const strategy = this.recoveryStrategies.get(category);
        return strategy?.max_retries || 3;
    }
    /**
     * Check if recovery should be attempted
     */
    shouldAttemptRecovery(error) {
        return error.retry_count < error.max_retries &&
            error.severity !== error_types_1.ErrorSeverity.CRITICAL &&
            !error.recovery_attempted;
    }
    /**
     * Log error with appropriate level
     */
    logError(error) {
        const logMessage = `[${error.category}] ${error.component}: ${error.message}`;
        switch (error.severity) {
            case error_types_1.ErrorSeverity.CRITICAL:
                this.logger.error(`CRITICAL ERROR - ${logMessage}`, error.details);
                break;
            case error_types_1.ErrorSeverity.HIGH:
                this.logger.error(`HIGH SEVERITY - ${logMessage}`, error.details);
                break;
            case error_types_1.ErrorSeverity.MEDIUM:
                this.logger.warn(`MEDIUM SEVERITY - ${logMessage}`, error.details);
                break;
            case error_types_1.ErrorSeverity.LOW:
                this.logger.info(`LOW SEVERITY - ${logMessage}`, error.details);
                break;
        }
    }
    /**
     * Update component health based on error
     */
    updateComponentHealth(error) {
        const component = error.component;
        let health = this.componentHealth.get(component);
        if (!health) {
            health = {
                component,
                status: 'healthy',
                last_success: new Date(0),
                consecutive_failures: 0,
                error_rate: 0,
                response_time_avg: 0
            };
        }
        health.consecutive_failures++;
        // Update status based on consecutive failures and severity
        if (error.severity === error_types_1.ErrorSeverity.CRITICAL || health.consecutive_failures > 5) {
            health.status = 'failed';
        }
        else if (error.severity === error_types_1.ErrorSeverity.HIGH || health.consecutive_failures > 2) {
            health.status = 'degraded';
        }
        this.componentHealth.set(component, health);
    }
    /**
     * Update component health on recovery
     */
    updateComponentHealthOnRecovery(error) {
        const health = this.componentHealth.get(error.component);
        if (health) {
            health.consecutive_failures = 0;
            health.last_success = new Date();
            health.status = 'healthy';
            this.componentHealth.set(error.component, health);
        }
    }
    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 60000); // Check every minute
    }
    /**
     * Perform periodic health check
     */
    performHealthCheck() {
        const systemHealth = this.getSystemHealth();
        this.emit('healthCheck', systemHealth);
        // Clean up old errors
        this.clearOldErrors();
        this.logger.debug(`Health check completed. Status: ${systemHealth.overall_status}, Active errors: ${systemHealth.active_errors.length}`);
    }
    /**
     * Get total recovery attempts across all errors
     */
    getTotalRecoveryAttempts() {
        return Array.from(this.errors.values()).reduce((total, error) => total + error.retry_count, 0);
    }
    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=error-handler.js.map