/**
 * Tests for ConfigManager hot-reload functionality
 */

import * as fs from 'fs/promises';
import { ConfigManager } from './config-manager';
import { NetworkMonitorConfig } from '../types';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager Hot-Reload', () => {
  let configManager: ConfigManager;
  let tempConfigPath: string;

  beforeEach(() => {
    tempConfigPath = '/tmp/test-config.json';
    configManager = new ConfigManager(tempConfigPath);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await configManager.stopConfigWatcher();
  });

  describe('Configuration Persistence', () => {
    it('should persist configuration changes', async () => {
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

      mockFs.access.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.saveConfig(testConfig);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        tempConfigPath,
        expect.stringContaining('"name": "Test"'),
        'utf-8'
      );
    });

    it('should emit configChanged event when configuration is saved', async () => {
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 5000,
          ping_loss_percent: 10.0,
          dns_timeout_ms: 3000,
          consecutive_failures: 3
        },
        data_retention_days: 30
      };

      mockFs.access.mockRejectedValue(new Error('File not found')); // No existing file
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const configChangedSpy = jest.fn();
      configManager.on('configChanged', configChangedSpy);

      await configManager.saveConfig(testConfig);
      
      expect(configChangedSpy).toHaveBeenCalledWith(testConfig);
    });

    it('should update partial configuration correctly', async () => {
      const initialConfig: NetworkMonitorConfig = {
        ping_targets: [
          { name: 'Initial', address: '1.1.1.1', interval: 60, enabled: true }
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
        data_retention_days: 60,
        alert_thresholds: {
          ping_timeout_ms: 6000,
          ping_loss_percent: 15.0,
          dns_timeout_ms: 4000,
          consecutive_failures: 5
        }
      });

      expect(updatedConfig.data_retention_days).toBe(60);
      expect(updatedConfig.alert_thresholds.ping_timeout_ms).toBe(6000);
      expect(updatedConfig.alert_thresholds.ping_loss_percent).toBe(15.0);
      expect(updatedConfig.ping_targets).toHaveLength(1); // Original data preserved
      expect(updatedConfig.ping_targets[0]?.name).toBe('Initial');
    });
  });

  describe('Backup and Restore', () => {
    it('should create backup before saving new configuration', async () => {
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [],
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
      
      expect(mockFs.copyFile).toHaveBeenCalledWith(
        tempConfigPath,
        tempConfigPath + '.backup'
      );
    });

    it('should restore configuration from backup', async () => {
      const backupConfig: NetworkMonitorConfig = {
        ping_targets: [
          { name: 'Backup Target', address: '2.2.2.2', interval: 120, enabled: false }
        ],
        dns_targets: [],
        alert_thresholds: {
          ping_timeout_ms: 4000,
          ping_loss_percent: 20.0,
          dns_timeout_ms: 2000,
          consecutive_failures: 2
        },
        data_retention_days: 15
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(backupConfig));
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const restoredConfig = await configManager.restoreFromBackup();
      
      expect(restoredConfig.ping_targets[0]?.name).toBe('Backup Target');
      expect(restoredConfig.alert_thresholds.ping_timeout_ms).toBe(4000);
      expect(restoredConfig.data_retention_days).toBe(15);
    });

    it('should handle missing backup file gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(configManager.restoreFromBackup()).rejects.toThrow(/No backup file found/);
    });
  });

  describe('Configuration State Management', () => {
    it('should track current configuration state', async () => {
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [
          { name: 'State Test', address: '3.3.3.3', interval: 90, enabled: true }
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

      const loadedConfig = await configManager.loadConfig();
      const currentConfig = configManager.getCurrentConfig();
      
      expect(currentConfig).toEqual(loadedConfig);
      expect(currentConfig?.ping_targets[0]?.name).toBe('State Test');
    });

    it('should return null for current config before loading', () => {
      const currentConfig = configManager.getCurrentConfig();
      expect(currentConfig).toBeNull();
    });

    it('should throw error when updating config before loading', async () => {
      await expect(configManager.updateConfig({ data_retention_days: 60 }))
        .rejects.toThrow(/No current configuration loaded/);
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate configuration during hot-reload', async () => {
      const invalidConfig = {
        ping_targets: [
          { name: '', address: '', interval: 10, enabled: 'invalid' } // Invalid data
        ],
        dns_targets: [],
        alert_thresholds: {},
        data_retention_days: 30
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.loadConfig()).rejects.toThrow(/Configuration validation failed/);
    });

    it('should validate partial updates', async () => {
      const initialConfig: NetworkMonitorConfig = {
        ping_targets: [],
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
      mockFs.readFile.mockResolvedValue(JSON.stringify(initialConfig));
      await configManager.loadConfig();

      // Try to update with invalid data
      await expect(configManager.updateConfig({
        data_retention_days: 500 // Invalid - too high
      })).rejects.toThrow(/Configuration validation failed/);
    });
  });
});