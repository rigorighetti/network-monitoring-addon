/**
 * Error types and classifications for comprehensive error handling
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK_TOOL = 'network_tool',
  DNS_SERVER = 'dns_server',
  CONFIGURATION = 'configuration',
  SYSTEM_RESOURCE = 'system_resource',
  TEMPORARY_FAILURE = 'temporary_failure',
  PERMANENT_FAILURE = 'permanent_failure'
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

export class NetworkMonitoringError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly component: string;
  public readonly target?: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    component: string,
    target?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'NetworkMonitoringError';
    this.category = category;
    this.severity = severity;
    this.component = component;
    if (target !== undefined) {
      this.target = target;
    }
    if (details !== undefined) {
      this.details = details;
    }
    this.timestamp = new Date();

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetworkMonitoringError);
    }
  }

  toJSON(): NetworkError {
    return {
      id: this.generateId(),
      timestamp: this.timestamp,
      category: this.category,
      severity: this.severity,
      component: this.component,
      ...(this.target !== undefined && { target: this.target }),
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
      ...(this.stack !== undefined && { stack_trace: this.stack }),
      recovery_attempted: false,
      retry_count: 0,
      max_retries: 0
    };
  }

  private generateId(): string {
    return `${this.component}-${this.category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}