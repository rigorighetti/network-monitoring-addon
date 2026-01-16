/**
 * DNS monitoring component for continuous DNS resolution testing
 */

import { promises as dns } from 'dns';
import { EventEmitter } from 'events';
import { DNSTarget, DNSResult } from '../types';
import { logger } from '../utils/logger';
import { ErrorHandler, NetworkMonitoringError, ErrorCategory, ErrorSeverity } from '../error-handling';
import { DNSScheduler } from './scheduler';

export class DNSMonitor extends EventEmitter {
  private targets: Map<string, DNSTarget> = new Map();
  private scheduler: DNSScheduler;
  private isRunning = false;
  private errorHandler: ErrorHandler;
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(errorHandler?: ErrorHandler) {
    super();
    this.errorHandler = errorHandler || new ErrorHandler();
    this.scheduler = new DNSScheduler();

    // Listen to scheduler events
    this.scheduler.on('task:execute', (event) => {
      if (event.type === 'dns') {
        this.executeDNSTests(event.target as DNSTarget);
      }
    });

    this.scheduler.on('task:error', (event) => {
      logger.error(`Scheduler error for DNS task ${event.taskId}:`, event.error);
    });
  }

  /**
   * Start continuous monitoring for all configured targets
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('DNSMonitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting DNS monitoring with scheduler');

    // Start the scheduler with current targets
    this.scheduler.updateTargets(Array.from(this.targets.values()));
    this.scheduler.start();
  }

  /**
   * Stop all monitoring activities
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping DNS monitoring');
    this.isRunning = false;

    // Stop the scheduler
    this.scheduler.stop();
  }

  /**
   * Update monitoring targets without restart
   */
  updateTargets(targets: DNSTarget[]): void {
    logger.info(`Updating DNS targets: ${targets.length} targets`);

    // Update targets map
    this.targets.clear();
    for (const target of targets) {
      this.targets.set(target.name, target);
    }

    // Update scheduler with new targets
    this.scheduler.updateTargets(targets);
  }

  /**
   * Get current targets
   */
  getTargets(): DNSTarget[] {
    return Array.from(this.targets.values());
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus(): ReturnType<DNSScheduler['getStatus']> {
    return this.scheduler.getStatus();
  }

  /**
   * Execute DNS tests for all domains in a target (called by scheduler)
   */
  public async executeDNSTests(target: DNSTarget): Promise<void> {
    for (const domain of target.test_domains) {
      // Test forward DNS lookup (A record) - perform 3 attempts to measure variation
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          await this.executeDNSQuery(target, domain, 'A');
          // Random delay between attempts to avoid overwhelming the DNS server
          if (attempt < 2) {
            const randomDelay = Math.floor(Math.random() * (3000 - 500 + 1)) + 500;
            await new Promise(resolve => setTimeout(resolve, randomDelay));
          }
        }
      } catch (error) {
        // Log but don't propagate - continue with other tests
        logger.error(`Failed to execute A record query for ${domain}:`, error);
      }
      
      try {
        // Test AAAA record for IPv6 - single attempt
        await this.executeDNSQuery(target, domain, 'AAAA');
      } catch (error) {
        // Log but don't propagate - continue with other tests
        logger.error(`Failed to execute AAAA record query for ${domain}:`, error);
      }
      
      // Test reverse DNS lookup if we got an IP from forward lookup - single attempt
      try {
        const addresses = await this.resolveWithServer(target.server_ip, domain, 'A');
        if (addresses.length > 0 && addresses[0]) {
          await this.executeReverseDNSQuery(target, addresses[0]);
        }
      } catch {
        // Ignore errors for reverse lookup setup
      }
    }
  }

  /**
   * Execute a single DNS query
   */
  private async executeDNSQuery(target: DNSTarget, domain: string, queryType: string): Promise<void> {
    try {
      const result = await this.performDNSQuery(target, domain, queryType);
      
      // Reset consecutive failures on success
      if (result.success) {
        const key = `${target.name}:${domain}:${queryType}`;
        this.consecutiveFailures.set(key, 0);
      } else {
        const key = `${target.name}:${domain}:${queryType}`;
        const failures = (this.consecutiveFailures.get(key) || 0) + 1;
        this.consecutiveFailures.set(key, failures);
        
        // Handle consecutive DNS failures
        if (failures >= 3) {
          await this.errorHandler.handleDNSServerUnreachable(
            target.server_ip,
            domain,
            new Error(`${failures} consecutive DNS query failures for ${queryType} record`),
            failures
          );
        }
      }
      
      this.emit('result', result);
      logger.debug(`DNS ${queryType} query for ${domain} via ${target.server_ip}: ${result.success ? `${result.response_time_ms}ms` : 'failed'}`);
    } catch (error) {
      const key = `${target.name}:${domain}:${queryType}`;
      const failures = (this.consecutiveFailures.get(key) || 0) + 1;
      this.consecutiveFailures.set(key, failures);
      
      // Handle DNS server unreachability
      await this.errorHandler.handleDNSServerUnreachable(
        target.server_ip,
        domain,
        error instanceof Error ? error : new Error('Unknown DNS error'),
        failures
      );
      
      const result: DNSResult = {
        timestamp: new Date(),
        server_name: target.name,
        server_ip: target.server_ip,
        domain,
        query_type: queryType,
        response_time_ms: null,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('result', result);
      logger.error(`DNS ${queryType} query failed for ${domain} via ${target.server_ip}: ${result.error_message}`);
    }
  }

  /**
   * Execute a reverse DNS query
   */
  private async executeReverseDNSQuery(target: DNSTarget, ipAddress: string): Promise<void> {
    try {
      const result = await this.performReverseDNSQuery(target, ipAddress);
      
      // Reset consecutive failures on success
      if (result.success) {
        const key = `${target.name}:${ipAddress}:PTR`;
        this.consecutiveFailures.set(key, 0);
      } else {
        const key = `${target.name}:${ipAddress}:PTR`;
        const failures = (this.consecutiveFailures.get(key) || 0) + 1;
        this.consecutiveFailures.set(key, failures);
        
        // Handle consecutive reverse DNS failures
        if (failures >= 5) { // Higher threshold for reverse DNS as it's less critical
          await this.errorHandler.handleDNSServerUnreachable(
            target.server_ip,
            ipAddress,
            new Error(`${failures} consecutive reverse DNS failures`),
            failures
          );
        }
      }
      
      this.emit('result', result);
      logger.debug(`Reverse DNS query for ${ipAddress} via ${target.server_ip}: ${result.success ? `${result.response_time_ms}ms` : 'failed'}`);
    } catch (error) {
      const key = `${target.name}:${ipAddress}:PTR`;
      const failures = (this.consecutiveFailures.get(key) || 0) + 1;
      this.consecutiveFailures.set(key, failures);
      
      // Handle reverse DNS errors with lower severity
      await this.errorHandler.handleTemporaryFailure(
        'reverse_dns_query',
        ipAddress,
        error instanceof Error ? error : new Error('Unknown reverse DNS error'),
        'DNSMonitor',
        failures
      );
      
      const result: DNSResult = {
        timestamp: new Date(),
        server_name: target.name,
        server_ip: target.server_ip,
        domain: ipAddress,
        query_type: 'PTR',
        response_time_ms: null,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('result', result);
      logger.error(`Reverse DNS query failed for ${ipAddress} via ${target.server_ip}: ${result.error_message}`);
    }
  }

  /**
   * Perform the actual DNS query
   */
  private async performDNSQuery(target: DNSTarget, domain: string, queryType: string): Promise<DNSResult> {
    const startTime = Date.now();
    
    try {
      let addresses: string[] = [];
      
      if (queryType === 'A') {
        addresses = await this.resolveWithServer(target.server_ip, domain, 'A');
      } else if (queryType === 'AAAA') {
        addresses = await this.resolveWithServer(target.server_ip, domain, 'AAAA');
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        timestamp: new Date(),
        server_name: target.name,
        server_ip: target.server_ip,
        domain,
        query_type: queryType,
        response_time_ms: responseTime,
        success: addresses.length > 0,
        ...(addresses.length > 0 && { resolved_address: addresses[0] }),
        ...(addresses.length === 0 && { error_message: 'No records found' })
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        timestamp: new Date(),
        server_name: target.name,
        server_ip: target.server_ip,
        domain,
        query_type: queryType,
        response_time_ms: responseTime,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform reverse DNS query
   */
  private async performReverseDNSQuery(target: DNSTarget, ipAddress: string): Promise<DNSResult> {
    const startTime = Date.now();
    
    try {
      // Set DNS server for reverse lookup
      dns.setServers([target.server_ip]);
      
      const hostnames = await dns.reverse(ipAddress);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        timestamp: new Date(),
        server_name: target.name,
        server_ip: target.server_ip,
        domain: ipAddress,
        query_type: 'PTR',
        response_time_ms: responseTime,
        success: hostnames.length > 0,
        ...(hostnames.length > 0 && { resolved_address: hostnames[0] }),
        ...(hostnames.length === 0 && { error_message: 'No PTR records found' })
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        timestamp: new Date(),
        server_name: target.name,
        server_ip: target.server_ip,
        domain: ipAddress,
        query_type: 'PTR',
        response_time_ms: responseTime,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resolve domain using specific DNS server
   */
  private async resolveWithServer(serverIP: string, domain: string, recordType: 'A' | 'AAAA'): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        // Set DNS server
        dns.setServers([serverIP]);
      } catch (setServerError) {
        reject(new NetworkMonitoringError(
          `Failed to set DNS server ${serverIP}: ${setServerError instanceof Error ? setServerError.message : 'Unknown error'}`,
          ErrorCategory.DNS_SERVER,
          ErrorSeverity.HIGH,
          'DNSMonitor',
          serverIP,
          { domain, recordType, originalError: setServerError instanceof Error ? setServerError.message : 'Unknown' }
        ));
        return;
      }
      
      // Set timeout for DNS query (5 seconds with retry capability)
      const timeout = setTimeout(() => {
        reject(new NetworkMonitoringError(
          `DNS query timed out after 5 seconds for ${domain} (${recordType})`,
          ErrorCategory.TEMPORARY_FAILURE,
          ErrorSeverity.MEDIUM,
          'DNSMonitor',
          serverIP,
          { domain, recordType, timeout_seconds: 5 }
        ));
      }, 5000);
      
      const resolveFunction = recordType === 'A' ? dns.resolve4 : dns.resolve6;
      
      resolveFunction(domain)
        .then((addresses) => {
          clearTimeout(timeout);
          resolve(addresses);
        })
        .catch((error) => {
          clearTimeout(timeout);
          
          // Categorize DNS errors
          let errorCategory = ErrorCategory.DNS_SERVER;
          let errorSeverity = ErrorSeverity.MEDIUM;
          
          if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            errorCategory = ErrorCategory.TEMPORARY_FAILURE;
            errorSeverity = ErrorSeverity.LOW;
          } else if (error.code === 'ETIMEOUT' || error.code === 'ECONNREFUSED') {
            errorCategory = ErrorCategory.DNS_SERVER;
            errorSeverity = ErrorSeverity.HIGH;
          }
          
          reject(new NetworkMonitoringError(
            `DNS resolution failed for ${domain} (${recordType}): ${error.message}`,
            errorCategory,
            errorSeverity,
            'DNSMonitor',
            serverIP,
            { 
              domain, 
              recordType, 
              errorCode: error.code,
              originalError: error.message 
            }
          ));
        });
    });
  }
}