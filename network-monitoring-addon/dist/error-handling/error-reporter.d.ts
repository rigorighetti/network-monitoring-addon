/**
 * Detailed error logging and reporting system
 */
import { NetworkError, SystemHealth } from './error-types';
import { RecoveryAttempt } from './recovery-manager';
export interface ErrorReport {
    id: string;
    timestamp: Date;
    report_type: 'error' | 'recovery' | 'health' | 'summary';
    title: string;
    content: string;
    metadata: Record<string, any>;
}
export interface ErrorReportingConfig {
    log_directory: string;
    max_log_files: number;
    max_file_size_mb: number;
    report_interval_minutes: number;
    include_stack_traces: boolean;
    include_system_info: boolean;
}
export declare class ErrorReporter {
    private logger;
    private config;
    private reports;
    private reportingInterval?;
    constructor(config?: Partial<ErrorReportingConfig>);
    /**
     * Report a network error with detailed information
     */
    reportError(error: NetworkError, context?: Record<string, any>): Promise<void>;
    /**
     * Report recovery attempt
     */
    reportRecoveryAttempt(attempt: RecoveryAttempt, error?: NetworkError): Promise<void>;
    /**
     * Report system health status
     */
    reportSystemHealth(health: SystemHealth): Promise<void>;
    /**
     * Generate periodic summary report
     */
    generateSummaryReport(errors: NetworkError[], recoveryAttempts: RecoveryAttempt[], systemHealth: SystemHealth): Promise<void>;
    /**
     * Export error reports to file
     */
    exportReports(startDate?: Date, endDate?: Date, reportTypes?: string[]): Promise<string>;
    /**
     * Get error statistics
     */
    getErrorStatistics(): {
        total_reports: number;
        reports_by_type: Record<string, number>;
        reports_by_severity: Record<string, number>;
        recent_errors: ErrorReport[];
        error_trends: {
            date: string;
            count: number;
        }[];
    };
    /**
     * Clear old reports
     */
    clearOldReports(maxAge?: number): void;
    /**
     * Stop error reporting
     */
    stop(): void;
    /**
     * Initialize error reporting system
     */
    private initializeReporting;
    /**
     * Format error report content
     */
    private formatErrorReport;
    /**
     * Format recovery report content
     */
    private formatRecoveryReport;
    /**
     * Format health report content
     */
    private formatHealthReport;
    /**
     * Format summary report content
     */
    private formatSummaryReport;
    /**
     * Store report in memory
     */
    private storeReport;
    /**
     * Write report to log file
     */
    private writeToLogFile;
    /**
     * Log error to console based on severity
     */
    private logToConsole;
    /**
     * Ensure log directory exists
     */
    private ensureLogDirectory;
    /**
     * Perform periodic maintenance
     */
    private performPeriodicMaintenance;
    /**
     * Generate unique report ID
     */
    private generateReportId;
}
//# sourceMappingURL=error-reporter.d.ts.map