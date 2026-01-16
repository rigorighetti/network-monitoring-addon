/**
 * Comprehensive error handler for network monitoring operations
 */
import { EventEmitter } from 'events';
import { ErrorCategory, ErrorSeverity, SystemHealth, NetworkMonitoringError } from './error-types';
export declare class ErrorHandler extends EventEmitter {
    private logger;
    private errors;
    private recoveryStrategies;
    private componentHealth;
    private isRecoveryInProgress;
    private healthCheckInterval?;
    constructor();
    /**
     * Handle an error with automatic recovery attempts
     */
    handleError(error: Error | NetworkMonitoringError, context?: Record<string, any>): Promise<void>;
    /**
     * Handle network tool execution failures
     */
    handleNetworkToolFailure(tool: string, target: string, error: Error, retryCount?: number): Promise<void>;
    /**
     * Handle DNS server unreachability
     */
    handleDNSServerUnreachable(serverIP: string, domain: string, error: Error, consecutiveFailures?: number): Promise<void>;
    /**
     * Handle system resource limitations
     */
    handleResourceLimitation(resource: string, usage: number, limit: number, component: string): Promise<void>;
    /**
     * Handle temporary failures with automatic retry
     */
    handleTemporaryFailure(operation: string, target: string, error: Error, component: string, retryCount?: number): Promise<void>;
    /**
     * Mark error as recovered
     */
    markErrorRecovered(errorId: string): void;
    /**
     * Get current system health status
     */
    getSystemHealth(): SystemHealth;
    /**
     * Get error statistics
     */
    getErrorStatistics(): {
        total_errors: number;
        active_errors: number;
        recovered_errors: number;
        errors_by_category: Record<ErrorCategory, number>;
        errors_by_severity: Record<ErrorSeverity, number>;
    };
    /**
     * Clear old recovered errors (cleanup)
     */
    clearOldErrors(maxAge?: number): void;
    /**
     * Stop error handling and cleanup
     */
    stop(): void;
    /**
     * Initialize recovery strategies for different error categories
     */
    private initializeRecoveryStrategies;
    /**
     * Attempt automatic recovery for an error
     */
    private attemptRecovery;
    /**
     * Categorize error based on error message and type
     */
    private categorizeError;
    /**
     * Assess error severity
     */
    private assessSeverity;
    /**
     * Get max retries for error category
     */
    private getMaxRetries;
    /**
     * Check if recovery should be attempted
     */
    private shouldAttemptRecovery;
    /**
     * Log error with appropriate level
     */
    private logError;
    /**
     * Update component health based on error
     */
    private updateComponentHealth;
    /**
     * Update component health on recovery
     */
    private updateComponentHealthOnRecovery;
    /**
     * Start health monitoring
     */
    private startHealthMonitoring;
    /**
     * Perform periodic health check
     */
    private performHealthCheck;
    /**
     * Get total recovery attempts across all errors
     */
    private getTotalRecoveryAttempts;
    /**
     * Generate unique error ID
     */
    private generateErrorId;
}
//# sourceMappingURL=error-handler.d.ts.map