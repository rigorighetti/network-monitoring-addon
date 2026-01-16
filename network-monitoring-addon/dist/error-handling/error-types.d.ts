/**
 * Error types and classifications for comprehensive error handling
 */
export declare enum ErrorSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum ErrorCategory {
    NETWORK_TOOL = "network_tool",
    DNS_SERVER = "dns_server",
    CONFIGURATION = "configuration",
    SYSTEM_RESOURCE = "system_resource",
    TEMPORARY_FAILURE = "temporary_failure",
    PERMANENT_FAILURE = "permanent_failure"
}
export interface NetworkError {
    id: string;
    timestamp: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
    component: string;
    target?: string;
    message: string;
    details?: Record<string, any>;
    stack_trace?: string;
    recovery_attempted: boolean;
    recovery_successful?: boolean;
    retry_count: number;
    max_retries: number;
}
export interface ErrorRecoveryStrategy {
    category: ErrorCategory;
    max_retries: number;
    retry_delay_ms: number;
    backoff_multiplier: number;
    max_delay_ms: number;
    recovery_action: (error: NetworkError) => Promise<boolean>;
}
export interface SystemHealth {
    overall_status: 'healthy' | 'degraded' | 'critical';
    component_health: ComponentHealth[];
    active_errors: NetworkError[];
    recovery_attempts: number;
    last_health_check: Date;
}
export interface ComponentHealth {
    component: string;
    status: 'healthy' | 'degraded' | 'failed';
    last_success: Date;
    consecutive_failures: number;
    error_rate: number;
    response_time_avg: number;
}
export declare class NetworkMonitoringError extends Error {
    readonly category: ErrorCategory;
    readonly severity: ErrorSeverity;
    readonly component: string;
    readonly target?: string;
    readonly details?: Record<string, any>;
    readonly timestamp: Date;
    constructor(message: string, category: ErrorCategory, severity: ErrorSeverity, component: string, target?: string, details?: Record<string, any>);
    toJSON(): NetworkError;
    private generateId;
}
//# sourceMappingURL=error-types.d.ts.map