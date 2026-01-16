/**
 * Configuration manager for the Network Monitoring Add-on
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { NetworkMonitorConfig, PingTarget, DNSTarget } from '../types';
import { Logger } from '../utils/logger';

export interface ConfigValidationError {
  field: string;
  message: string;
  value?: any;
}

export class ConfigManager extends EventEmitter {
  private logger: Logger;
  private configPath: string;
  private backupPath: string;
  private currentConfig: NetworkMonitorConfig | null = null;
  private configWatcher: fs.FileHandle | null = null;

  constructor(configPath?: string) {
    super();
    this.logger = new Logger('ConfigManager');
    this.configPath = configPath || process.env.CONFIG_PATH || '/data/config.json';
    this.backupPath = this.configPath + '.backup';
  }

  async loadConfig(): Promise<NetworkMonitorConfig> {
    this.logger.info('Loading configuration...');
    
    try {
      // Check if config file exists
      const configExists = await this.fileExists(this.configPath);
      
      if (!configExists) {
        this.logger.info('Config file not found, creating default configuration');
        const defaultConfig = this.getDefaultConfig();
        await this.saveConfig(defaultConfig);
        return defaultConfig;
      }

      // Read and parse config file
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Validate configuration
      const validatedConfig = this.validateConfig(parsedConfig);
      this.currentConfig = validatedConfig;
      this.logger.info('Configuration loaded and validated successfully');
      
      return validatedConfig;
      
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  async saveConfig(config: NetworkMonitorConfig): Promise<void> {
    this.logger.info('Saving configuration...');
    
    try {
      // Validate before saving
      const validatedConfig = this.validateConfig(config);
      
      // Create backup of existing config if it exists
      if (await this.fileExists(this.configPath)) {
        await this.createBackup();
      }
      
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Write config file
      const configJson = JSON.stringify(validatedConfig, null, 2);
      await fs.writeFile(this.configPath, configJson, 'utf-8');
      
      this.currentConfig = validatedConfig;
      this.logger.info('Configuration saved successfully');
      
      // Emit config change event
      this.emit('configChanged', validatedConfig);
      
    } catch (error) {
      this.logger.error('Failed to save configuration:', error);
      throw new Error(`Configuration saving failed: ${error}`);
    }
  }

  async updateConfig(partialConfig: Partial<NetworkMonitorConfig>): Promise<NetworkMonitorConfig> {
    this.logger.info('Updating configuration...');
    
    if (!this.currentConfig) {
      throw new Error('No current configuration loaded. Call loadConfig() first.');
    }

    // Merge with current config
    const updatedConfig: NetworkMonitorConfig = {
      ...this.currentConfig,
      ...partialConfig,
      // Handle nested objects properly
      alert_thresholds: {
        ...this.currentConfig.alert_thresholds,
        ...(partialConfig.alert_thresholds || {})
      }
    };

    // Save the updated config
    await this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  getCurrentConfig(): NetworkMonitorConfig | null {
    return this.currentConfig;
  }

  async createBackup(): Promise<void> {
    try {
      if (await this.fileExists(this.configPath)) {
        await fs.copyFile(this.configPath, this.backupPath);
        this.logger.info('Configuration backup created');
      }
    } catch (error) {
      this.logger.warn('Failed to create configuration backup:', error);
    }
  }

  async restoreFromBackup(): Promise<NetworkMonitorConfig> {
    this.logger.info('Restoring configuration from backup...');
    
    try {
      if (!(await this.fileExists(this.backupPath))) {
        throw new Error('No backup file found');
      }

      const backupData = await fs.readFile(this.backupPath, 'utf-8');
      const backupConfig = JSON.parse(backupData);
      const validatedConfig = this.validateConfig(backupConfig);
      
      await this.saveConfig(validatedConfig);
      this.logger.info('Configuration restored from backup successfully');
      
      return validatedConfig;
      
    } catch (error) {
      this.logger.error('Failed to restore from backup:', error);
      throw new Error(`Backup restoration failed: ${error}`);
    }
  }

  validateConfig(config: any): NetworkMonitorConfig {
    const errors: ConfigValidationError[] = [];

    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    // Validate ping targets
    if (!Array.isArray(config.ping_targets)) {
      errors.push({
        field: 'ping_targets',
        message: 'ping_targets must be an array',
        value: config.ping_targets
      });
    } else {
      const validatedPingTargets: PingTarget[] = [];
      
      config.ping_targets.forEach((target: any, index: number) => {
        const targetErrors = this.validatePingTarget(target, index);
        errors.push(...targetErrors);
        
        if (targetErrors.length === 0) {
          validatedPingTargets.push({
            name: target.name,
            address: target.address,
            interval: target.interval,
            enabled: target.enabled
          });
        }
      });
    }

    // Validate DNS targets
    if (!Array.isArray(config.dns_targets)) {
      errors.push({
        field: 'dns_targets',
        message: 'dns_targets must be an array',
        value: config.dns_targets
      });
    } else {
      const validatedDnsTargets: DNSTarget[] = [];
      
      config.dns_targets.forEach((target: any, index: number) => {
        const targetErrors = this.validateDNSTarget(target, index);
        errors.push(...targetErrors);
        
        if (targetErrors.length === 0) {
          validatedDnsTargets.push({
            name: target.name,
            server_ip: target.server_ip,
            test_domains: target.test_domains,
            interval: target.interval,
            enabled: target.enabled
          });
        }
      });
    }

    // Validate alert thresholds
    const alertThresholdErrors = this.validateAlertThresholds(config.alert_thresholds);
    errors.push(...alertThresholdErrors);

    // Validate data retention
    const dataRetentionErrors = this.validateDataRetention(config.data_retention_days);
    errors.push(...dataRetentionErrors);

    // If there are validation errors, throw with detailed information
    if (errors.length > 0) {
      const errorMessage = errors.map(err => `${err.field}: ${err.message}`).join('; ');
      throw new Error(`Configuration validation failed: ${errorMessage}`);
    }

    // Return validated config
    return {
      ping_targets: config.ping_targets.map((target: any) => ({
        name: target.name,
        address: target.address,
        interval: target.interval,
        enabled: target.enabled
      })),
      dns_targets: config.dns_targets.map((target: any) => ({
        name: target.name,
        server_ip: target.server_ip,
        test_domains: target.test_domains,
        interval: target.interval,
        enabled: target.enabled
      })),
      alert_thresholds: {
        ping_timeout_ms: config.alert_thresholds?.ping_timeout_ms || 5000,
        ping_loss_percent: config.alert_thresholds?.ping_loss_percent || 10.0,
        dns_timeout_ms: config.alert_thresholds?.dns_timeout_ms || 3000,
        consecutive_failures: config.alert_thresholds?.consecutive_failures || 3
      },
      data_retention_days: config.data_retention_days || 30
    };
  }

  private validatePingTarget(target: any, index: number): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    const prefix = `ping_targets[${index}]`;

    if (!target.name || typeof target.name !== 'string' || target.name.trim() === '') {
      errors.push({
        field: `${prefix}.name`,
        message: 'name must be a non-empty string',
        value: target.name
      });
    }

    if (!target.address || typeof target.address !== 'string' || target.address.trim() === '') {
      errors.push({
        field: `${prefix}.address`,
        message: 'address must be a non-empty string',
        value: target.address
      });
    }

    if (!this.isValidInterval(target.interval)) {
      errors.push({
        field: `${prefix}.interval`,
        message: 'interval must be a number between 1 and 600 seconds',
        value: target.interval
      });
    }

    if (typeof target.enabled !== 'boolean') {
      errors.push({
        field: `${prefix}.enabled`,
        message: 'enabled must be a boolean',
        value: target.enabled
      });
    }

    return errors;
  }

  private validateDNSTarget(target: any, index: number): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    const prefix = `dns_targets[${index}]`;

    if (!target.name || typeof target.name !== 'string' || target.name.trim() === '') {
      errors.push({
        field: `${prefix}.name`,
        message: 'name must be a non-empty string',
        value: target.name
      });
    }

    if (!target.server_ip || typeof target.server_ip !== 'string' || target.server_ip.trim() === '') {
      errors.push({
        field: `${prefix}.server_ip`,
        message: 'server_ip must be a non-empty string',
        value: target.server_ip
      });
    }

    if (!Array.isArray(target.test_domains) || target.test_domains.length === 0) {
      errors.push({
        field: `${prefix}.test_domains`,
        message: 'test_domains must be a non-empty array',
        value: target.test_domains
      });
    } else {
      target.test_domains.forEach((domain: any, domainIndex: number) => {
        if (!domain || typeof domain !== 'string' || domain.trim() === '') {
          errors.push({
            field: `${prefix}.test_domains[${domainIndex}]`,
            message: 'domain must be a non-empty string',
            value: domain
          });
        }
      });
    }

    if (!this.isValidInterval(target.interval)) {
      errors.push({
        field: `${prefix}.interval`,
        message: 'interval must be a number between 1 and 600 seconds',
        value: target.interval
      });
    }

    if (typeof target.enabled !== 'boolean') {
      errors.push({
        field: `${prefix}.enabled`,
        message: 'enabled must be a boolean',
        value: target.enabled
      });
    }

    return errors;
  }

  private validateAlertThresholds(thresholds: any): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    if (thresholds) {
      if (thresholds.ping_timeout_ms !== undefined) {
        if (typeof thresholds.ping_timeout_ms !== 'number' || thresholds.ping_timeout_ms < 100 || thresholds.ping_timeout_ms > 30000) {
          errors.push({
            field: 'alert_thresholds.ping_timeout_ms',
            message: 'ping_timeout_ms must be a number between 100 and 30000',
            value: thresholds.ping_timeout_ms
          });
        }
      }

      if (thresholds.ping_loss_percent !== undefined) {
        if (typeof thresholds.ping_loss_percent !== 'number' || thresholds.ping_loss_percent < 0 || thresholds.ping_loss_percent > 100) {
          errors.push({
            field: 'alert_thresholds.ping_loss_percent',
            message: 'ping_loss_percent must be a number between 0 and 100',
            value: thresholds.ping_loss_percent
          });
        }
      }

      if (thresholds.dns_timeout_ms !== undefined) {
        if (typeof thresholds.dns_timeout_ms !== 'number' || thresholds.dns_timeout_ms < 100 || thresholds.dns_timeout_ms > 30000) {
          errors.push({
            field: 'alert_thresholds.dns_timeout_ms',
            message: 'dns_timeout_ms must be a number between 100 and 30000',
            value: thresholds.dns_timeout_ms
          });
        }
      }

      if (thresholds.consecutive_failures !== undefined) {
        if (typeof thresholds.consecutive_failures !== 'number' || thresholds.consecutive_failures < 1 || thresholds.consecutive_failures > 100) {
          errors.push({
            field: 'alert_thresholds.consecutive_failures',
            message: 'consecutive_failures must be a number between 1 and 100',
            value: thresholds.consecutive_failures
          });
        }
      }
    }

    return errors;
  }

  private validateDataRetention(dataRetentionDays: any): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    if (dataRetentionDays !== undefined) {
      if (typeof dataRetentionDays !== 'number' || dataRetentionDays < 1 || dataRetentionDays > 365) {
        errors.push({
          field: 'data_retention_days',
          message: 'data_retention_days must be a number between 1 and 365',
          value: dataRetentionDays
        });
      }
    }

    return errors;
  }

  private isValidInterval(interval: any): boolean {
    return typeof interval === 'number' && interval >= 1 && interval <= 600;
  }

  getDefaultConfig(): NetworkMonitorConfig {
    return {
      ping_targets: [
        {
          name: 'Google DNS',
          address: '8.8.8.8',
          interval: 60,
          enabled: true
        },
        {
          name: 'Cloudflare DNS',
          address: '1.1.1.1',
          interval: 60,
          enabled: true
        },
        {
          name: 'Local Gateway',
          address: '192.168.1.1',
          interval: 30,
          enabled: true
        }
      ],
      dns_targets: [
        {
          name: 'Local DNS',
          server_ip: '192.168.1.1',
          test_domains: ['google.com', 'github.com', 'cloudflare.com'],
          interval: 120,
          enabled: true
        },
        {
          name: 'Google DNS',
          server_ip: '8.8.8.8',
          test_domains: ['google.com', 'example.com'],
          interval: 120,
          enabled: true
        }
      ],
      alert_thresholds: {
        ping_timeout_ms: 5000,
        ping_loss_percent: 10.0,
        dns_timeout_ms: 3000,
        consecutive_failures: 3
      },
      data_retention_days: 30
    };
  }

  async startConfigWatcher(): Promise<void> {
    if (this.configWatcher) {
      this.logger.warn('Config watcher already started');
      return;
    }

    try {
      // Use fs.watch for file system events
      const watcher = fs.watch(this.configPath, { persistent: false });
      
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          this.logger.info('Configuration file changed, reloading...');
          try {
            const newConfig = await this.loadConfig();
            this.emit('configReloaded', newConfig);
          } catch (error) {
            this.logger.error('Failed to reload configuration after file change:', error);
            this.emit('configError', error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to start config watcher:', error);
      throw error;
    }
  }

  async stopConfigWatcher(): Promise<void> {
    if (this.configWatcher) {
      await this.configWatcher.close();
      this.configWatcher = null;
      this.logger.info('Config watcher stopped');
    }
  }

  // Utility methods for specific validation
  validatePingTargetConfig(target: Partial<PingTarget>): ConfigValidationError[] {
    return this.validatePingTarget(target, 0);
  }

  validateDNSTargetConfig(target: Partial<DNSTarget>): ConfigValidationError[] {
    return this.validateDNSTarget(target, 0);
  }

  validateIntervalConfig(interval: any): boolean {
    return this.isValidInterval(interval);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}