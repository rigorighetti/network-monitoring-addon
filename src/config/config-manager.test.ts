/**
 * Tests for ConfigManager class
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import { NetworkMonitorConfig } from '../types';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempConfigPath: string;

  beforeEach(() => {
    tempConfigPath = '/tmp/test-config.json';
    configManager = new ConfigManager(tempConfigPath);
    jest.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should validate a correct configuration', () => {
      const validConfig = {
        ping_targets: [
          {
            name: 'Test Target',
            address: '8.8.8.8',
            interval: 60,
            enabled: true
          }
        ],
        dns_targets: [
          {
            name: 'Test DNS',
            server_ip: '8.8.8.8',
            test_domains: ['google.com'],
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

      expect(() => configManager.validateConfig(validConfig)).not.toThrow();
    });

    it('should reject invalid ping target configurations', () => {
      const invalidConfigs = [
        // Missing name
        {
          ping_targets: [{ address: '8.8.8.8', interval: 60, enabled: true }],
          dns_targets: [],
          alert_thresholds: {},
          data_retention_days: 30
        },
        // Invalid interval
        {
          ping_targets: [{ name: 'Test', address: '8.8.8.8', interval: 20, enabled: true }],
          dns_targets: [],
          alert_thresholds: {},
          data_retention_days: 30
        },
        // Invalid enabled type
        {
          ping_targets: [{ name: 'Test', address: '8.8.8.8', interval: 60, enabled: 'yes' }],
          dns_targets: [],
          alert_thresholds: {},
          data_retention_days: 30
        }
      ];

      invalidConfigs.forEach(config => {
        expect(() => configManager.validateConfig(config)).toThrow();
      });
    });

    it('should reject invalid DNS target configurations', () => {
      const invalidConfigs = [
        // Missing server_ip
        {
          ping_targets: [],
          dns_targets: [{ name: 'Test', test_domains: ['google.com'], interval: 120, enabled: true }],
          alert_thresholds: {},
          data_retention_days: 30
        },
        // Empty test_domains
        {
          ping_targets: [],
          dns_targets: [{ name: 'Test', server_ip: '8.8.8.8', test_domains: [], interval: 120, enabled: true }],
          alert_thresholds: {},
          data_retention_days: 30
        },
        // Invalid interval
        {
          ping_targets: [],
          dns_targets: [{ name: 'Test', server_ip: '8.8.8.8', test_domains: ['google.com'], interval: 700, enabled: true }],
          alert_thresholds: {},
          data_retention_days: 30
        }
      ];

      invalidConfigs.forEach(config => {
        expect(() => configManager.validateConfig(config)).toThrow();
      });
    });

    it('should validate interval ranges correctly', () => {
      expect(configManager.validateIntervalConfig(30)).toBe(true);
      expect(configManager.validateIntervalConfig(300)).toBe(true);
      expect(configManager.validateIntervalConfig(600)).toBe(true);
      expect(configManager.validateIntervalConfig(29)).toBe(false);
      expect(configManager.validateIntervalConfig(601)).toBe(false);
      expect(configManager.validateIntervalConfig('60')).toBe(false);
    });

    it('should validate alert thresholds correctly', () => {
      const validConfig = {
        ping_targets: [],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 1000,
          ping_loss_percent: 50.0,
          dns_timeout_ms: 2000,
          consecutive_failures: 5
        },
        data_retention_days: 30
      };

      expect(() => configManager.validateConfig(validConfig)).not.toThrow();

      const invalidConfig = {
        ping_targets: [],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 50, // Too low
          ping_loss_percent: 150.0, // Too high
          dns_timeout_ms: 50000, // Too high
          consecutive_failures: 0 // Too low
        },
        data_retention_days: 30
      };

      expect(() => configManager.validateConfig(invalidConfig)).toThrow();
    });
  });

  describe('Default Configuration', () => {
    it('should provide a valid default configuration', () => {
      const defaultConfig = configManager.getDefaultConfig();
      
      expect(defaultConfig.ping_targets).toHaveLength(3);
      expect(defaultConfig.dns_targets).toHaveLength(2);
      expect(defaultConfig.alert_thresholds).toBeDefined();
      expect(defaultConfig.data_retention_days).toBe(30);
      
      // Validate that default config passes validation
      expect(() => configManager.validateConfig(defaultConfig)).not.toThrow();
    });

    it('should have reasonable default values', () => {
      const defaultConfig = configManager.getDefaultConfig();
      
      // Check ping targets
      expect(defaultConfig.ping_targets).toHaveLength(3);
      expect(defaultConfig.ping_targets[0]?.name).toBe('Google DNS');
      expect(defaultConfig.ping_targets[0]?.address).toBe('8.8.8.8');
      expect(defaultConfig.ping_targets[0]?.interval).toBe(60);
      expect(defaultConfig.ping_targets[0]?.enabled).toBe(true);
      
      // Check DNS targets
      expect(defaultConfig.dns_targets).toHaveLength(2);
      expect(defaultConfig.dns_targets[0]?.name).toBe('Local DNS');
      expect(defaultConfig.dns_targets[0]?.server_ip).toBe('192.168.1.1');
      expect(defaultConfig.dns_targets[0]?.test_domains).toContain('google.com');
      
      // Check alert thresholds
      expect(defaultConfig.alert_thresholds.ping_timeout_ms).toBe(5000);
      expect(defaultConfig.alert_thresholds.ping_loss_percent).toBe(10.0);
      expect(defaultConfig.alert_thresholds.dns_timeout_ms).toBe(3000);
      expect(defaultConfig.alert_thresholds.consecutive_failures).toBe(3);
    });
  });

  describe('Configuration Loading and Saving', () => {
    it('should create default config when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const config = await configManager.loadConfig();
      
      expect(config).toBeDefined();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should load existing configuration file', async () => {
      const testConfig = {
        ping_targets: [
          { name: 'Test', address: '1.1.1.1', interval: 60, enabled: true }
        ],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 5000,
          ping_loss_percent: 10.0,
          dns_timeout_ms: 3000,
          consecutive_failures: 3
        },
        data_retention_days: 30
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(testConfig));

      const config = await configManager.loadConfig();
      
      expect(config.ping_targets).toHaveLength(1);
      expect(config.ping_targets[0]?.name).toBe('Test');
    });

    it('should save configuration with backup', async () => {
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [
          { name: 'Test', address: '1.1.1.1', interval: 60, enabled: true }
        ],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 5000,
          ping_loss_percent: 10.0,
          dns_timeout_ms: 3000,
          consecutive_failures: 3
        },
        data_retention_days: 30
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.saveConfig(testConfig);
      
      expect(mockFs.copyFile).toHaveBeenCalled(); // Backup created
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle configuration update', async () => {
      const initialConfig: NetworkMonitorConfig = {
        ping_targets: [
          { name: 'Test', address: '1.1.1.1', interval: 60, enabled: true }
        ],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 5000,
          ping_loss_percent: 10.0,
          dns_timeout_ms: 3000,
          consecutive_failures: 3
        },
        data_retention_days: 30
      };

      // Load initial config
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(initialConfig));
      await configManager.loadConfig();

      // Update config
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const updatedConfig = await configManager.updateConfig({
        data_retention_days: 60
      });

      expect(updatedConfig.data_retention_days).toBe(60);
      expect(updatedConfig.ping_targets).toHaveLength(1); // Original data preserved
    });
  });

  describe('Error Handling', () => {
    it('should throw detailed validation errors', () => {
      const invalidConfig = {
        ping_targets: [
          { name: '', address: '', interval: 10, enabled: 'invalid' }
        ],
        dns_targets: [],
        alert_thresholds: {},
        data_retention_days: 30
      };

      expect(() => configManager.validateConfig(invalidConfig)).toThrow(/Configuration validation failed/);
    });

    it('should handle file system errors gracefully', async () => {
      // Mock file exists but reading fails
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockRejectedValue(new Error('Cannot read file'));

      await expect(configManager.loadConfig()).rejects.toThrow(/Configuration loading failed/);
    });

    it('should handle JSON parsing errors', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(configManager.loadConfig()).rejects.toThrow(/Configuration loading failed/);
    });
  });

  describe('Backup and Restore', () => {
    it('should create backup successfully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);

      await configManager.createBackup();
      
      expect(mockFs.copyFile).toHaveBeenCalledWith(tempConfigPath, tempConfigPath + '.backup');
    });

    it('should restore from backup', async () => {
      const backupConfig = {
        ping_targets: [
          { name: 'Backup', address: '1.1.1.1', interval: 60, enabled: true }
        ],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 5000,
          ping_loss_percent: 10.0,
          dns_timeout_ms: 3000,
          consecutive_failures: 3
        },
        data_retention_days: 30
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(backupConfig));
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const restoredConfig = await configManager.restoreFromBackup();
      
      expect(restoredConfig.ping_targets[0]?.name).toBe('Backup');
    });

    it('should handle missing backup file', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(configManager.restoreFromBackup()).rejects.toThrow(/No backup file found/);
    });
  });
});