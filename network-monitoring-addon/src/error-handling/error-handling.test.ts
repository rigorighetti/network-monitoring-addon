/**
 * Comprehensive error handling integration tests
 */

import { ErrorHandler, RecoveryManager, ErrorReporter } from './index';
import { NetworkMonitoringError, ErrorCategory, ErrorSeverity } from './error-types';

describe('Error Handling Integration', () => {
  let errorHandler: ErrorHandler;
  let recoveryManager: RecoveryManager;
  let errorReporter: ErrorReporter;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    recoveryManager = new RecoveryManager(errorHandler);
    errorReporter = new ErrorReporter({
      log_directory: '/tmp/test-logs',
      include_stack_traces: false,
      include_system_info: false
    });
  });

  afterEach(() => {
    errorHandler.stop();
    recoveryManager.stop();
    errorReporter.stop();
  });

  describe('Network Tool Failure Handling', () => {
    it('should handle ping tool execution failures gracefully', async () => {
      const mockError = new Error('ping command not found');
      
      await errorHandler.handleNetworkToolFailure('ping', '8.8.8.8', mockError, 1);
      
      const systemHealth = errorHandler.getSystemHealth();
      expect(systemHealth.active_errors.length).toBeGreaterThan(0);
      
      const error = systemHealth.active_errors[0];
      if (error) {
        expect(error.category).toBe(ErrorCategory.NETWORK_TOOL);
        expect(error.component).toBe('NetworkTool');
        expect(error.target).toBe('8.8.8.8');
      }
    });

    it('should escalate severity after multiple failures', async () => {
      const mockError = new Error('network unreachable');
      
      // First failure - should be medium severity
      await errorHandler.handleNetworkToolFailure('ping', '8.8.8.8', mockError, 1);
      let systemHealth = errorHandler.getSystemHealth();
      let error = systemHealth.active_errors[0];
      if (error) {
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      }
      
      // Third failure - should be high severity
      await errorHandler.handleNetworkToolFailure('ping', '8.8.8.8', mockError, 3);
      systemHealth = errorHandler.getSystemHealth();
      // Find the high severity error (should be the most recent one)
      error = systemHealth.active_errors.find(e => e.severity === ErrorSeverity.HIGH);
      if (error) {
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      } else {
        // If no high severity error found, check all errors
        const severities = systemHealth.active_errors.map(e => e.severity);
        throw new Error(`Expected HIGH severity error but found: ${severities.join(', ')}`);
      }
    });
  });

  describe('DNS Server Unreachability Handling', () => {
    it('should handle DNS server unreachability with appropriate severity', async () => {
      const mockError = new Error('ECONNREFUSED');
      
      await errorHandler.handleDNSServerUnreachable('8.8.8.8', 'example.com', mockError, 3);
      
      const systemHealth = errorHandler.getSystemHealth();
      expect(systemHealth.active_errors.length).toBeGreaterThan(0);
      
      const error = systemHealth.active_errors[0];
      if (error) {
        expect(error.category).toBe(ErrorCategory.DNS_SERVER);
        expect(error.component).toBe('DNSMonitor');
        expect(error.target).toBe('8.8.8.8');
        expect(error.details?.domain).toBe('example.com');
      }
    });

    it('should escalate to high severity after many consecutive failures', async () => {
      const mockError = new Error('DNS timeout');
      
      await errorHandler.handleDNSServerUnreachable('8.8.8.8', 'example.com', mockError, 6);
      
      const systemHealth = errorHandler.getSystemHealth();
      const error = systemHealth.active_errors[0];
      if (error) {
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      }
    });
  });

  describe('System Resource Limitation Handling', () => {
    it('should handle resource limitations with high severity', async () => {
      await errorHandler.handleResourceLimitation('memory', 950, 1000, 'PingMonitor');
      
      const systemHealth = errorHandler.getSystemHealth();
      expect(systemHealth.active_errors.length).toBeGreaterThan(0);
      
      const error = systemHealth.active_errors[0];
      if (error) {
        expect(error.category).toBe(ErrorCategory.SYSTEM_RESOURCE);
        expect(error.severity).toBe(ErrorSeverity.HIGH);
        expect(error.details?.usagePercent).toBe(95);
      }
    });
  });

  describe('Temporary Failure Handling', () => {
    it('should handle temporary failures with low severity', async () => {
      const mockError = new Error('temporary network glitch');
      
      await errorHandler.handleTemporaryFailure('ping_test', '8.8.8.8', mockError, 'PingMonitor', 1);
      
      const systemHealth = errorHandler.getSystemHealth();
      expect(systemHealth.active_errors.length).toBeGreaterThan(0);
      
      const error = systemHealth.active_errors[0];
      if (error) {
        expect(error.category).toBe(ErrorCategory.TEMPORARY_FAILURE);
        expect(error.severity).toBe(ErrorSeverity.LOW);
      }
    });
  });

  describe('System Health Monitoring', () => {
    it('should report healthy status with no errors', () => {
      const systemHealth = errorHandler.getSystemHealth();
      expect(systemHealth.overall_status).toBe('healthy');
      expect(systemHealth.active_errors.length).toBe(0);
    });

    it('should report degraded status with medium severity errors', async () => {
      const mockError = new NetworkMonitoringError(
        'Medium severity error',
        ErrorCategory.TEMPORARY_FAILURE,
        ErrorSeverity.MEDIUM,
        'TestComponent'
      );

      await errorHandler.handleError(mockError);
      
      const systemHealth = errorHandler.getSystemHealth();
      expect(systemHealth.overall_status).toBe('degraded');
    });
  });

  describe('Error Recovery Manager', () => {
    it('should register and execute recovery actions', async () => {
      let recoveryExecuted = false;
      
      // Register recovery action with the expected key format
      recoveryManager.registerRecoveryAction({
        name: 'reset_network_tools',
        component: 'NetworkTool',
        action: async () => {
          recoveryExecuted = true;
          return true;
        },
        cooldown_ms: 1000,
        max_attempts: 3
      });

      const mockError = new NetworkMonitoringError(
        'Test error for recovery',
        ErrorCategory.NETWORK_TOOL, // This will map to 'NetworkTool:reset_network_tools'
        ErrorSeverity.MEDIUM,
        'NetworkTool'
      ).toJSON();

      const success = await recoveryManager.attemptRecovery(mockError);
      
      expect(success).toBe(true);
      expect(recoveryExecuted).toBe(true);
    });
  });

  describe('Error Reporting', () => {
    it('should generate detailed error reports', async () => {
      const mockError = new NetworkMonitoringError(
        'Test error for reporting',
        ErrorCategory.NETWORK_TOOL,
        ErrorSeverity.HIGH,
        'TestComponent',
        'test-target',
        { testDetail: 'test value' }
      ).toJSON();

      await errorReporter.reportError(mockError, { contextInfo: 'test context' });
      
      const stats = errorReporter.getErrorStatistics();
      expect(stats.total_reports).toBeGreaterThan(0);
      expect(stats.reports_by_type.error).toBeGreaterThan(0);
    });
  });

  describe('Component Health Tracking', () => {
    it('should track component health degradation', async () => {
      // Generate multiple errors for the same component
      for (let i = 0; i < 3; i++) {
        const mockError = new NetworkMonitoringError(
          `Component error ${i}`,
          ErrorCategory.NETWORK_TOOL,
          ErrorSeverity.MEDIUM,
          'TestComponent'
        );

        await errorHandler.handleError(mockError);
      }

      const systemHealth = errorHandler.getSystemHealth();
      const componentHealth = systemHealth.component_health.find(c => c.component === 'TestComponent');
      
      expect(componentHealth).toBeDefined();
      if (componentHealth) {
        expect(componentHealth.status).toBe('degraded');
        expect(componentHealth.consecutive_failures).toBe(3);
      }
    });
  });

  describe('Error Statistics', () => {
    it('should provide comprehensive error statistics', async () => {
      // Generate errors of different categories and severities
      const errors = [
        new NetworkMonitoringError('Error 1', ErrorCategory.NETWORK_TOOL, ErrorSeverity.HIGH, 'Component1'),
        new NetworkMonitoringError('Error 2', ErrorCategory.DNS_SERVER, ErrorSeverity.MEDIUM, 'Component2'),
        new NetworkMonitoringError('Error 3', ErrorCategory.TEMPORARY_FAILURE, ErrorSeverity.LOW, 'Component3')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const stats = errorHandler.getErrorStatistics();
      expect(stats.total_errors).toBe(3);
      expect(stats.active_errors).toBe(3);
      expect(stats.errors_by_category[ErrorCategory.NETWORK_TOOL]).toBe(1);
      expect(stats.errors_by_severity[ErrorSeverity.HIGH]).toBe(1);
    });
  });
});