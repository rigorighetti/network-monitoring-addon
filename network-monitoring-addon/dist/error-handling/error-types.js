"use strict";
/**
 * Error types and classifications for comprehensive error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkMonitoringError = exports.ErrorCategory = exports.ErrorSeverity = void 0;
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["NETWORK_TOOL"] = "network_tool";
    ErrorCategory["DNS_SERVER"] = "dns_server";
    ErrorCategory["CONFIGURATION"] = "configuration";
    ErrorCategory["SYSTEM_RESOURCE"] = "system_resource";
    ErrorCategory["TEMPORARY_FAILURE"] = "temporary_failure";
    ErrorCategory["PERMANENT_FAILURE"] = "permanent_failure";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
class NetworkMonitoringError extends Error {
    constructor(message, category, severity, component, target, details) {
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
    toJSON() {
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
    generateId() {
        return `${this.component}-${this.category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.NetworkMonitoringError = NetworkMonitoringError;
//# sourceMappingURL=error-types.js.map