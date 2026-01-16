"use strict";
/**
 * Detailed error logging and reporting system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReporter = void 0;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("../utils/logger");
const error_types_1 = require("./error-types");
class ErrorReporter {
    constructor(config = {}) {
        this.reports = [];
        this.logger = new logger_1.Logger('ErrorReporter');
        this.config = {
            log_directory: config.log_directory || '/data/logs',
            max_log_files: config.max_log_files || 10,
            max_file_size_mb: config.max_file_size_mb || 10,
            report_interval_minutes: config.report_interval_minutes || 60,
            include_stack_traces: config.include_stack_traces ?? true,
            include_system_info: config.include_system_info ?? true,
            ...config
        };
        this.initializeReporting();
    }
    /**
     * Report a network error with detailed information
     */
    async reportError(error, context) {
        const report = {
            id: this.generateReportId(),
            timestamp: new Date(),
            report_type: 'error',
            title: `${error.category} Error in ${error.component}`,
            content: this.formatErrorReport(error, context),
            metadata: {
                error_id: error.id,
                category: error.category,
                severity: error.severity,
                component: error.component,
                target: error.target,
                retry_count: error.retry_count,
                ...context
            }
        };
        await this.storeReport(report);
        await this.writeToLogFile('errors', report);
        // Log to console based on severity
        this.logToConsole(error, report);
    }
    /**
     * Report recovery attempt
     */
    async reportRecoveryAttempt(attempt, error) {
        const report = {
            id: this.generateReportId(),
            timestamp: new Date(),
            report_type: 'recovery',
            title: `Recovery Attempt: ${attempt.action_name}`,
            content: this.formatRecoveryReport(attempt, error),
            metadata: {
                attempt_id: attempt.id,
                error_id: attempt.error_id,
                action_name: attempt.action_name,
                success: attempt.success,
                duration_ms: attempt.duration_ms,
                error_message: attempt.error_message
            }
        };
        await this.storeReport(report);
        await this.writeToLogFile('recovery', report);
        if (attempt.success) {
            this.logger.info(`Recovery successful: ${attempt.action_name} (${attempt.duration_ms}ms)`);
        }
        else {
            this.logger.warn(`Recovery failed: ${attempt.action_name} - ${attempt.error_message || 'Unknown error'}`);
        }
    }
    /**
     * Report system health status
     */
    async reportSystemHealth(health) {
        const report = {
            id: this.generateReportId(),
            timestamp: new Date(),
            report_type: 'health',
            title: `System Health Report - ${health.overall_status.toUpperCase()}`,
            content: this.formatHealthReport(health),
            metadata: {
                overall_status: health.overall_status,
                active_errors: health.active_errors.length,
                component_count: health.component_health.length,
                recovery_attempts: health.recovery_attempts
            }
        };
        await this.storeReport(report);
        await this.writeToLogFile('health', report);
        if (health.overall_status === 'critical') {
            this.logger.error(`CRITICAL SYSTEM HEALTH: ${health.active_errors.length} active errors`);
        }
        else if (health.overall_status === 'degraded') {
            this.logger.warn(`System health degraded: ${health.active_errors.length} active errors`);
        }
    }
    /**
     * Generate periodic summary report
     */
    async generateSummaryReport(errors, recoveryAttempts, systemHealth) {
        const report = {
            id: this.generateReportId(),
            timestamp: new Date(),
            report_type: 'summary',
            title: 'Network Monitoring Summary Report',
            content: this.formatSummaryReport(errors, recoveryAttempts, systemHealth),
            metadata: {
                total_errors: errors.length,
                active_errors: errors.filter(e => !e.recovery_successful).length,
                total_recovery_attempts: recoveryAttempts.length,
                successful_recoveries: recoveryAttempts.filter(a => a.success).length,
                system_status: systemHealth.overall_status
            }
        };
        await this.storeReport(report);
        await this.writeToLogFile('summary', report);
        this.logger.info(`Summary report generated: ${errors.length} errors, ${recoveryAttempts.length} recovery attempts`);
    }
    /**
     * Export error reports to file
     */
    async exportReports(startDate, endDate, reportTypes) {
        const filteredReports = this.reports.filter(report => {
            const dateMatch = (!startDate || report.timestamp >= startDate) &&
                (!endDate || report.timestamp <= endDate);
            const typeMatch = !reportTypes || reportTypes.includes(report.report_type);
            return dateMatch && typeMatch;
        });
        const exportData = {
            export_timestamp: new Date().toISOString(),
            filter_criteria: {
                start_date: startDate?.toISOString(),
                end_date: endDate?.toISOString(),
                report_types: reportTypes
            },
            total_reports: filteredReports.length,
            reports: filteredReports
        };
        const filename = `error_report_export_${Date.now()}.json`;
        const filepath = (0, path_1.join)(this.config.log_directory, filename);
        await this.ensureLogDirectory();
        await (0, promises_1.writeFile)(filepath, JSON.stringify(exportData, null, 2));
        this.logger.info(`Exported ${filteredReports.length} reports to ${filename}`);
        return filepath;
    }
    /**
     * Get error statistics
     */
    getErrorStatistics() {
        const reportsByType = {};
        const reportsBySeverity = {};
        this.reports.forEach(report => {
            reportsByType[report.report_type] = (reportsByType[report.report_type] || 0) + 1;
            if (report.metadata.severity) {
                const severity = report.metadata.severity;
                reportsBySeverity[severity] = (reportsBySeverity[severity] || 0) + 1;
            }
        });
        // Get recent errors (last 24 hours)
        const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentErrors = this.reports
            .filter(r => r.timestamp > recentCutoff && r.report_type === 'error')
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10);
        // Generate error trends (last 7 days)
        const trends = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            if (dateStr) {
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);
                const count = this.reports.filter(r => r.report_type === 'error' &&
                    r.timestamp >= dayStart &&
                    r.timestamp <= dayEnd).length;
                trends.push({ date: dateStr, count });
            }
        }
        return {
            total_reports: this.reports.length,
            reports_by_type: reportsByType,
            reports_by_severity: reportsBySeverity,
            recent_errors: recentErrors,
            error_trends: trends
        };
    }
    /**
     * Clear old reports
     */
    clearOldReports(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const cutoffTime = new Date(Date.now() - maxAge);
        const initialCount = this.reports.length;
        this.reports = this.reports.filter(report => report.timestamp > cutoffTime);
        const clearedCount = initialCount - this.reports.length;
        if (clearedCount > 0) {
            this.logger.info(`Cleared ${clearedCount} old error reports`);
        }
    }
    /**
     * Stop error reporting
     */
    stop() {
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
        }
        this.logger.info('Error reporter stopped');
    }
    /**
     * Initialize error reporting system
     */
    async initializeReporting() {
        await this.ensureLogDirectory();
        // Start periodic reporting
        this.reportingInterval = setInterval(() => {
            this.performPeriodicMaintenance();
        }, this.config.report_interval_minutes * 60 * 1000);
        this.logger.info(`Error reporting initialized. Log directory: ${this.config.log_directory}`);
    }
    /**
     * Format error report content
     */
    formatErrorReport(error, context) {
        let content = `ERROR REPORT\n`;
        content += `============\n\n`;
        content += `Error ID: ${error.id}\n`;
        content += `Timestamp: ${error.timestamp.toISOString()}\n`;
        content += `Category: ${error.category}\n`;
        content += `Severity: ${error.severity}\n`;
        content += `Component: ${error.component}\n`;
        if (error.target) {
            content += `Target: ${error.target}\n`;
        }
        content += `Message: ${error.message}\n`;
        content += `Retry Count: ${error.retry_count}/${error.max_retries}\n`;
        content += `Recovery Attempted: ${error.recovery_attempted ? 'Yes' : 'No'}\n`;
        if (error.recovery_successful !== undefined) {
            content += `Recovery Successful: ${error.recovery_successful ? 'Yes' : 'No'}\n`;
        }
        if (error.details) {
            content += `\nDetails:\n`;
            content += JSON.stringify(error.details, null, 2) + '\n';
        }
        if (context) {
            content += `\nContext:\n`;
            content += JSON.stringify(context, null, 2) + '\n';
        }
        if (this.config.include_stack_traces && error.stack_trace) {
            content += `\nStack Trace:\n`;
            content += error.stack_trace + '\n';
        }
        if (this.config.include_system_info) {
            content += `\nSystem Information:\n`;
            content += `Platform: ${process.platform}\n`;
            content += `Node Version: ${process.version}\n`;
            content += `Memory Usage: ${JSON.stringify(process.memoryUsage(), null, 2)}\n`;
            content += `Uptime: ${process.uptime()} seconds\n`;
        }
        return content;
    }
    /**
     * Format recovery report content
     */
    formatRecoveryReport(attempt, error) {
        let content = `RECOVERY ATTEMPT REPORT\n`;
        content += `======================\n\n`;
        content += `Attempt ID: ${attempt.id}\n`;
        content += `Timestamp: ${attempt.timestamp.toISOString()}\n`;
        content += `Error ID: ${attempt.error_id}\n`;
        content += `Action: ${attempt.action_name}\n`;
        content += `Success: ${attempt.success ? 'Yes' : 'No'}\n`;
        content += `Duration: ${attempt.duration_ms}ms\n`;
        if (attempt.error_message) {
            content += `Error Message: ${attempt.error_message}\n`;
        }
        if (error) {
            content += `\nOriginal Error:\n`;
            content += `Category: ${error.category}\n`;
            content += `Severity: ${error.severity}\n`;
            content += `Component: ${error.component}\n`;
            content += `Message: ${error.message}\n`;
        }
        return content;
    }
    /**
     * Format health report content
     */
    formatHealthReport(health) {
        let content = `SYSTEM HEALTH REPORT\n`;
        content += `====================\n\n`;
        content += `Overall Status: ${health.overall_status.toUpperCase()}\n`;
        content += `Timestamp: ${health.last_health_check.toISOString()}\n`;
        content += `Active Errors: ${health.active_errors.length}\n`;
        content += `Recovery Attempts: ${health.recovery_attempts}\n`;
        content += `\nComponent Health:\n`;
        health.component_health.forEach(component => {
            content += `  ${component.component}: ${component.status.toUpperCase()}\n`;
            content += `    Last Success: ${component.last_success.toISOString()}\n`;
            content += `    Consecutive Failures: ${component.consecutive_failures}\n`;
            content += `    Error Rate: ${component.error_rate.toFixed(2)}%\n`;
            content += `    Avg Response Time: ${component.response_time_avg.toFixed(2)}ms\n`;
        });
        if (health.active_errors.length > 0) {
            content += `\nActive Errors:\n`;
            health.active_errors.forEach(error => {
                content += `  ${error.id}: ${error.category} - ${error.message}\n`;
            });
        }
        return content;
    }
    /**
     * Format summary report content
     */
    formatSummaryReport(errors, recoveryAttempts, systemHealth) {
        const activeErrors = errors.filter(e => !e.recovery_successful);
        const recoveredErrors = errors.filter(e => e.recovery_successful);
        const successfulRecoveries = recoveryAttempts.filter(a => a.success);
        let content = `NETWORK MONITORING SUMMARY REPORT\n`;
        content += `=================================\n\n`;
        content += `Report Generated: ${new Date().toISOString()}\n`;
        content += `System Status: ${systemHealth.overall_status.toUpperCase()}\n\n`;
        content += `ERROR SUMMARY:\n`;
        content += `  Total Errors: ${errors.length}\n`;
        content += `  Active Errors: ${activeErrors.length}\n`;
        content += `  Recovered Errors: ${recoveredErrors.length}\n`;
        // Error breakdown by category
        const errorsByCategory = {};
        errors.forEach(error => {
            errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
        });
        content += `\nErrors by Category:\n`;
        Object.entries(errorsByCategory).forEach(([category, count]) => {
            content += `  ${category}: ${count}\n`;
        });
        // Error breakdown by severity
        const errorsBySeverity = {};
        errors.forEach(error => {
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
        });
        content += `\nErrors by Severity:\n`;
        Object.entries(errorsBySeverity).forEach(([severity, count]) => {
            content += `  ${severity}: ${count}\n`;
        });
        content += `\nRECOVERY SUMMARY:\n`;
        content += `  Total Recovery Attempts: ${recoveryAttempts.length}\n`;
        content += `  Successful Recoveries: ${successfulRecoveries.length}\n`;
        content += `  Recovery Success Rate: ${recoveryAttempts.length > 0 ?
            ((successfulRecoveries.length / recoveryAttempts.length) * 100).toFixed(1) : 0}%\n`;
        content += `\nCOMPONENT HEALTH:\n`;
        systemHealth.component_health.forEach(component => {
            content += `  ${component.component}: ${component.status.toUpperCase()}\n`;
        });
        if (activeErrors.length > 0) {
            content += `\nACTIVE ERRORS:\n`;
            activeErrors.slice(0, 10).forEach(error => {
                content += `  ${error.timestamp.toISOString()} - ${error.component}: ${error.message}\n`;
            });
            if (activeErrors.length > 10) {
                content += `  ... and ${activeErrors.length - 10} more\n`;
            }
        }
        return content;
    }
    /**
     * Store report in memory
     */
    async storeReport(report) {
        this.reports.push(report);
        // Keep only recent reports in memory (last 1000)
        if (this.reports.length > 1000) {
            this.reports = this.reports.slice(-1000);
        }
    }
    /**
     * Write report to log file
     */
    async writeToLogFile(logType, report) {
        try {
            const filename = `${logType}_${new Date().toISOString().split('T')[0]}.log`;
            const filepath = (0, path_1.join)(this.config.log_directory, filename);
            const logEntry = `[${report.timestamp.toISOString()}] ${report.title}\n${report.content}\n${'='.repeat(80)}\n\n`;
            await (0, promises_1.appendFile)(filepath, logEntry);
        }
        catch (error) {
            this.logger.error(`Failed to write to log file:`, error);
        }
    }
    /**
     * Log error to console based on severity
     */
    logToConsole(error, report) {
        const message = `${error.component}: ${error.message}`;
        switch (error.severity) {
            case error_types_1.ErrorSeverity.CRITICAL:
                this.logger.error(`CRITICAL - ${message}`, error.details);
                break;
            case error_types_1.ErrorSeverity.HIGH:
                this.logger.error(`HIGH - ${message}`, error.details);
                break;
            case error_types_1.ErrorSeverity.MEDIUM:
                this.logger.warn(`MEDIUM - ${message}`, error.details);
                break;
            case error_types_1.ErrorSeverity.LOW:
                this.logger.info(`LOW - ${message}`, error.details);
                break;
        }
    }
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            if (!(0, fs_1.existsSync)(this.config.log_directory)) {
                await (0, promises_1.mkdir)(this.config.log_directory, { recursive: true });
                this.logger.info(`Created log directory: ${this.config.log_directory}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to create log directory:`, error);
        }
    }
    /**
     * Perform periodic maintenance
     */
    performPeriodicMaintenance() {
        this.clearOldReports();
        // Could add log file rotation here
    }
    /**
     * Generate unique report ID
     */
    generateReportId() {
        return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ErrorReporter = ErrorReporter;
//# sourceMappingURL=error-reporter.js.map