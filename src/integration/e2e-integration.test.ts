/**
 * End-to-end integration tests for the Network Monitoring Add-on
 * Tests complete monitoring workflows, HA sensor integration, dashboard data flow, and configuration persistence
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NetworkMonitorApp } from '../app';
import { ConfigManager } from '../config/config-manager';
import { DataStore } from '../storage/data-store';
import { HASensor } from '../sensors/ha-sensor';
import { PingMonitor, DNSMonitor, StateManager } from '../monitoring';
import { AlertManager } from '../alerts/alert-manager';
import { DashboardService } from '../dashboard/dashboard-service';
import { Logger } from '../utils/logger';
import { 
  NetworkMonitorConfig, 
  PingTarget, 
  DNSTarget, 
  PingResult, 
  DNSResult,
  HomeAssistantSensor 
} from '../types';

// Test configuration
const TEST_CONFIG_DIR = '/tmp/network-monitor-test';
const TEST_DB_PATH = path.join(TEST_CONFIG_DIR, 'test.db');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');

describe('End-to-End Integration Tests', () => {
  let app: NetworkMonitorApp;
  let configManager: ConfigManager;
  let dataStore: DataStore;
  let haSensor: HASensor;
  let pingMonitor: PingMonitor;
  let dnsMonitor: DNSMonitor;
  let stateManager: StateManager;
  let alertManager: AlertManager;
  let dashboardService: DashboardService;
  let logger: Logger;

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    
    // Initialize logger
    logger = new Logger('E2ETest');
  });

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
      await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    } catch (error) {
      // Directory might not exist, ignore
    }

    // Initialize components
    configManager = new ConfigManager(TEST_CONFIG_PATH);
    dataStore = new DataStore(logger, TEST_CONFIG_DIR);
    haSensor = new HASensor({ deviceName: 'test_monitor' });
    pingMonitor = new PingMonitor();
    dnsMonitor = new DNSMonitor();
    stateManager = new StateManager();
    
    // Initialize alert manager with default thresholds
    const defaultThresholds = {
      ping_timeout_ms: 5000,
      ping_loss_percent: 10.0,
      dns_timeout_ms: 3000,
      consecutive_failures: 3
    };
    alertManager = new AlertManager(defaultThresholds);
    
    // Initialize dashboard service with required parameters
    const dashboardConfig = {
      port: 3000,
      host: 'localhost',
      enableCors: true
    };
    dashboardService = new DashboardService(dataStore, configManager, logger, dashboardConfig);
    
    // Initialize data store
    await dataStore.initialize();
  });

  afterEach(async () => {
    // Clean up components
    if (pingMonitor) {
      pingMonitor.stop();
    }
    if (dnsMonitor) {
      dnsMonitor.stop();
    }
    if (dataStore) {
      await dataStore.close();
    }
    
    // Clean up test files
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Monitoring Workflow', () => {
    it('should execute complete ping monitoring workflow', async () => {
      // Test configuration
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [
          {
            name: 'test-target',
            address: '127.0.0.1',
            interval: 30, // Minimum allowed interval
            enabled: true
          }
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

      // Save configuration
      await configManager.saveConfig(testConfig);

      // Create sensor for target
      const sensorId = await haSensor.create_ping_sensor(testConfig.ping_targets[0]!);
      expect(sensorId).toBe('sensor.test_monitor_ping_test_target');

      // Set up monitoring
      pingMonitor.updateTargets(testConfig.ping_targets);

      // Set up event handlers to track workflow
      const results: PingResult[] = [];
      const sensorUpdates: any[] = [];
      const stateChanges: any[] = [];

      pingMonitor.on('result', (result: PingResult) => {
        results.push(result);
        
        // Process result through state manager
        stateManager.processPingResult(result);
        
        // Store result in database
        dataStore.storePingResult(result);
        
        // Update sensor
        const state = stateManager.getState(result.target_name, 'ping');
        if (state) {
          haSensor.updatePingSensor(sensorId, result, {
            state: state.status as any,
            response_time: result.response_time_ms,
            packet_loss: result.packet_loss_percent,
            last_success: state.last_success,
            consecutive_failures: state.consecutive_failures
          });
        }
      });

      haSensor.on('sensor_updated', (update) => {
        sensorUpdates.push(update);
      });

      stateManager.on('stateChange', (change) => {
        stateChanges.push(change);
      });

      // Start monitoring
      pingMonitor.start();

      // Wait for at least one result (interval is 30s, so wait 35s to be safe)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 35000);

        pingMonitor.once('result', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Stop monitoring
      pingMonitor.stop();

      // Verify workflow completion
      expect(results.length).toBeGreaterThan(0);
      expect(sensorUpdates.length).toBeGreaterThan(0);
      
      const result = results[0]!;
      expect(result.target_name).toBe('test-target');
      expect(result.target_address).toBe('127.0.0.1');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.packet_loss_percent).toBe('number');

      // Verify sensor was updated
      const sensor = haSensor.getSensor(sensorId);
      expect(sensor).toBeDefined();
      expect(sensor!.attributes.target_name).toBe('test-target');

      // Verify state was tracked
      const state = stateManager.getState('test-target', 'ping');
      expect(state).toBeDefined();
      expect(state!.target_name).toBe('test-target');

      // Verify data was stored (wait a bit for async storage)
      await new Promise(resolve => setTimeout(resolve, 100));
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };
      const historicalData = await dataStore.getPingHistory('test-target', timeRange);
      expect(historicalData.data.length).toBeGreaterThan(0);
    }, 40000); // 40 second timeout for 30 second interval

    it('should execute complete DNS monitoring workflow', async () => {
      // Test configuration
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [],
        dns_targets: [
          {
            name: 'test-dns',
            server_ip: '8.8.8.8',
            test_domains: ['google.com'],
            interval: 30, // Minimum allowed interval
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

      // Save configuration
      await configManager.saveConfig(testConfig);

      // Create sensor for target
      const sensorId = await haSensor.create_dns_sensor(testConfig.dns_targets[0]!);
      expect(sensorId).toBe('sensor.test_monitor_dns_test_dns');

      // Set up monitoring
      dnsMonitor.updateTargets(testConfig.dns_targets);

      // Set up event handlers to track workflow
      const results: DNSResult[] = [];
      const sensorUpdates: any[] = [];

      dnsMonitor.on('result', (result: DNSResult) => {
        results.push(result);
        
        // Process result through state manager
        stateManager.processDNSResult(result);
        
        // Store result in database
        dataStore.storeDnsResult(result);
        
        // Update sensor
        const state = stateManager.getState(result.server_name, 'dns');
        if (state) {
          haSensor.updateDNSSensor(sensorId, result, {
            state: state.status as any,
            response_time: result.response_time_ms,
            success_rate: state.current_success_rate || 0,
            last_success: state.last_success,
            consecutive_failures: state.consecutive_failures
          });
        }
      });

      haSensor.on('sensor_updated', (update) => {
        sensorUpdates.push(update);
      });

      // Start monitoring
      dnsMonitor.start();

      // Wait for at least one result (interval is 30s, so wait 35s to be safe)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 35000);

        dnsMonitor.once('result', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Stop monitoring
      dnsMonitor.stop();

      // Verify workflow completion
      expect(results.length).toBeGreaterThan(0);
      expect(sensorUpdates.length).toBeGreaterThan(0);
      
      const result = results[0]!;
      expect(result.server_name).toBe('test-dns');
      expect(result.server_ip).toBe('8.8.8.8');
      expect(result.domain).toBe('google.com');
      expect(typeof result.success).toBe('boolean');

      // Verify sensor was updated
      const sensor = haSensor.getSensor(sensorId);
      expect(sensor).toBeDefined();
      expect(sensor!.attributes.server_name).toBe('test-dns');

      // Verify state was tracked
      const state = stateManager.getState('test-dns', 'dns');
      expect(state).toBeDefined();
      expect(state!.target_name).toBe('test-dns');

      // Verify data was stored (wait a bit for async storage)
      await new Promise(resolve => setTimeout(resolve, 100));
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };
      const historicalData = await dataStore.getDnsHistory('test-dns', timeRange);
      expect(historicalData.data.length).toBeGreaterThan(0);
    }, 40000); // 40 second timeout for 30 second interval
  });

  describe('Home Assistant Sensor Integration', () => {
    it('should create and manage ping sensors end-to-end', async () => {
      const targets: PingTarget[] = [
        {
          name: 'target-1',
          address: '8.8.8.8',
          interval: 60,
          enabled: true
        },
        {
          name: 'target-2',
          address: '1.1.1.1',
          interval: 30,
          enabled: true
        }
      ];

      // Track sensor creation events
      const createdSensors: any[] = [];
      haSensor.on('sensor_created', (event) => {
        createdSensors.push(event);
      });

      // Create sensors for all targets
      const sensorIds: string[] = [];
      for (const target of targets) {
        const sensorId = await haSensor.create_ping_sensor(target);
        sensorIds.push(sensorId);
      }

      // Verify sensors were created
      expect(sensorIds.length).toBe(2);
      expect(createdSensors.length).toBe(2);
      expect(sensorIds[0]).toBe('sensor.test_monitor_ping_target_1');
      expect(sensorIds[1]).toBe('sensor.test_monitor_ping_target_2');

      // Verify sensor properties
      const sensor1 = haSensor.getSensor(sensorIds[0]!);
      const sensor2 = haSensor.getSensor(sensorIds[1]!);

      expect(sensor1).toBeDefined();
      expect(sensor1!.attributes.friendly_name).toBe('Ping target-1');
      expect(sensor1!.attributes.target_address).toBe('8.8.8.8');
      expect(sensor1!.attributes.interval).toBe(60);

      expect(sensor2).toBeDefined();
      expect(sensor2!.attributes.friendly_name).toBe('Ping target-2');
      expect(sensor2!.attributes.target_address).toBe('1.1.1.1');
      expect(sensor2!.attributes.interval).toBe(30);

      // Test sensor updates
      const sensorUpdates: any[] = [];
      haSensor.on('sensor_updated', (update) => {
        sensorUpdates.push(update);
      });

      // Simulate ping results and update sensors
      const pingResult1: PingResult = {
        timestamp: new Date(),
        target_name: 'target-1',
        target_address: '8.8.8.8',
        response_time_ms: 25.5,
        packet_loss_percent: 0,
        success: true
      };

      const pingResult2: PingResult = {
        timestamp: new Date(),
        target_name: 'target-2',
        target_address: '1.1.1.1',
        response_time_ms: null,
        packet_loss_percent: 100,
        success: false,
        error_message: 'Request timeout'
      };

      // Update sensors with results
      await haSensor.updatePingSensor(sensorIds[0]!, pingResult1, {
        state: 'online',
        response_time: 25.5,
        packet_loss: 0,
        last_success: new Date(),
        consecutive_failures: 0
      });

      await haSensor.updatePingSensor(sensorIds[1]!, pingResult2, {
        state: 'offline',
        response_time: null,
        packet_loss: 100,
        last_success: new Date(Date.now() - 300000), // 5 minutes ago
        consecutive_failures: 3
      });

      // Verify sensor updates
      expect(sensorUpdates.length).toBe(2);
      
      const updatedSensor1 = haSensor.getSensor(sensorIds[0]!);
      const updatedSensor2 = haSensor.getSensor(sensorIds[1]!);

      // State is the response time for successful pings, status is in attributes
      expect(updatedSensor1!.state).toBe('25.5');
      expect(updatedSensor1!.attributes.status).toBe('online');
      expect(updatedSensor1!.attributes.response_time).toBe(25.5);
      expect(updatedSensor1!.attributes.packet_loss).toBe(0);

      // State is the status string for failed pings
      expect(updatedSensor2!.state).toBe('offline');
      expect(updatedSensor2!.attributes.status).toBe('offline');
      expect(updatedSensor2!.attributes.response_time).toBeNull();
      expect(updatedSensor2!.attributes.packet_loss).toBe(100);
      expect(updatedSensor2!.attributes.consecutive_failures).toBe(3);

      // Test sensor removal
      const removed = await haSensor.removeSensor(sensorIds[0]!);
      expect(removed).toBe(true);
      expect(haSensor.getSensor(sensorIds[0]!)).toBeUndefined();
      expect(haSensor.getSensor(sensorIds[1]!)).toBeDefined();

      // Verify sensor statistics
      const stats = haSensor.getStats();
      expect(stats.total).toBe(1);
      expect(stats.ping).toBe(1);
      expect(stats.dns).toBe(0);
    });

    it('should create and manage DNS sensors end-to-end', async () => {
      const targets: DNSTarget[] = [
        {
          name: 'local-dns',
          server_ip: '192.168.1.1',
          test_domains: ['google.com', 'github.com'],
          interval: 120,
          enabled: true
        },
        {
          name: 'google-dns',
          server_ip: '8.8.8.8',
          test_domains: ['example.com'],
          interval: 60,
          enabled: true
        }
      ];

      // Track sensor creation events
      const createdSensors: any[] = [];
      haSensor.on('sensor_created', (event) => {
        createdSensors.push(event);
      });

      // Create sensors for all targets
      const sensorIds: string[] = [];
      for (const target of targets) {
        const sensorId = await haSensor.create_dns_sensor(target);
        sensorIds.push(sensorId);
      }

      // Verify sensors were created
      expect(sensorIds.length).toBe(2);
      expect(createdSensors.length).toBe(2);
      expect(sensorIds[0]).toBe('sensor.test_monitor_dns_local_dns');
      expect(sensorIds[1]).toBe('sensor.test_monitor_dns_google_dns');

      // Verify sensor properties
      const sensor1 = haSensor.getSensor(sensorIds[0]!);
      const sensor2 = haSensor.getSensor(sensorIds[1]!);

      expect(sensor1).toBeDefined();
      expect(sensor1!.attributes.friendly_name).toBe('DNS local-dns');
      expect(sensor1!.attributes.server_ip).toBe('192.168.1.1');
      expect(sensor1!.attributes.test_domains).toEqual(['google.com', 'github.com']);

      expect(sensor2).toBeDefined();
      expect(sensor2!.attributes.friendly_name).toBe('DNS google-dns');
      expect(sensor2!.attributes.server_ip).toBe('8.8.8.8');
      expect(sensor2!.attributes.test_domains).toEqual(['example.com']);

      // Test sensor updates with DNS results
      const dnsResult1: DNSResult = {
        timestamp: new Date(),
        server_name: 'local-dns',
        server_ip: '192.168.1.1',
        domain: 'google.com',
        query_type: 'A',
        response_time_ms: 15.2,
        success: true,
        resolved_address: '142.250.191.14'
      };

      const dnsResult2: DNSResult = {
        timestamp: new Date(),
        server_name: 'google-dns',
        server_ip: '8.8.8.8',
        domain: 'example.com',
        query_type: 'A',
        response_time_ms: null,
        success: false,
        error_message: 'DNS server timeout'
      };

      // Update sensors with results
      await haSensor.updateDNSSensor(sensorIds[0]!, dnsResult1, {
        state: 'available',
        response_time: 15.2,
        success_rate: 0.95,
        last_success: new Date(),
        consecutive_failures: 0
      });

      await haSensor.updateDNSSensor(sensorIds[1]!, dnsResult2, {
        state: 'unavailable',
        response_time: null,
        success_rate: 0.2,
        last_success: new Date(Date.now() - 600000), // 10 minutes ago
        consecutive_failures: 5
      });

      // Verify sensor updates
      const updatedSensor1 = haSensor.getSensor(sensorIds[0]!);
      const updatedSensor2 = haSensor.getSensor(sensorIds[1]!);

      // State is the response time for successful DNS queries, status is in attributes
      expect(updatedSensor1!.state).toBe('15.2');
      expect(updatedSensor1!.attributes.status).toBe('available');
      expect(updatedSensor1!.attributes.response_time).toBe(15.2);
      expect(updatedSensor1!.attributes.success_rate).toBe(0.95);

      // State is the status string for failed DNS queries
      expect(updatedSensor2!.state).toBe('unavailable');
      expect(updatedSensor2!.attributes.status).toBe('unavailable');
      expect(updatedSensor2!.attributes.response_time).toBeNull();
      expect(updatedSensor2!.attributes.success_rate).toBe(0.2);
      expect(updatedSensor2!.attributes.consecutive_failures).toBe(5);

      // Verify sensor statistics
      const stats = haSensor.getStats();
      expect(stats.total).toBe(2);
      expect(stats.ping).toBe(0);
      expect(stats.dns).toBe(2);
    });
  });

  describe('Dashboard Data Flow and Visualization', () => {
    it('should provide data flow from monitoring to dashboard', async () => {
      // Store test data
      const now = new Date();
      const testPingResults: PingResult[] = [
        {
          timestamp: new Date(now.getTime() - 300000), // 5 minutes ago
          target_name: 'test-target',
          target_address: '8.8.8.8',
          response_time_ms: 25.5,
          packet_loss_percent: 0,
          success: true
        },
        {
          timestamp: new Date(now.getTime() - 240000), // 4 minutes ago
          target_name: 'test-target',
          target_address: '8.8.8.8',
          response_time_ms: 30.2,
          packet_loss_percent: 0,
          success: true
        },
        {
          timestamp: new Date(now.getTime() - 180000), // 3 minutes ago
          target_name: 'test-target',
          target_address: '8.8.8.8',
          response_time_ms: null,
          packet_loss_percent: 100,
          success: false,
          error_message: 'Request timeout'
        }
      ];

      const testDnsResults: DNSResult[] = [
        {
          timestamp: new Date(now.getTime() - 300000),
          server_name: 'test-dns',
          server_ip: '8.8.8.8',
          domain: 'google.com',
          query_type: 'A',
          response_time_ms: 15.2,
          success: true,
          resolved_address: '142.250.191.14'
        },
        {
          timestamp: new Date(now.getTime() - 240000),
          server_name: 'test-dns',
          server_ip: '8.8.8.8',
          domain: 'google.com',
          query_type: 'A',
          response_time_ms: 18.7,
          success: true,
          resolved_address: '142.250.191.14'
        }
      ];

      // Store all test data
      for (const result of testPingResults) {
        await dataStore.storePingResult(result);
      }
      for (const result of testDnsResults) {
        await dataStore.storeDnsResult(result);
      }

      // Wait for data to be stored
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test dashboard data retrieval
      const timeRange = {
        start: new Date(now.getTime() - 600000), // 10 minutes ago
        end: now
      };

      // Get historical data for dashboard
      const pingHistory = await dataStore.getPingHistory('test-target', timeRange);
      const dnsHistory = await dataStore.getDnsHistory('test-dns', timeRange);

      // Verify data retrieval
      expect(pingHistory.data.length).toBe(3);
      expect(dnsHistory.data.length).toBe(2);

      // Verify data structure for dashboard
      expect(pingHistory.data[0]).toHaveProperty('timestamp');
      expect(pingHistory.data[0]).toHaveProperty('response_time_ms');
      expect(pingHistory.data[0]).toHaveProperty('packet_loss_percent');
      expect(pingHistory.data[0]).toHaveProperty('success');

      expect(dnsHistory.data[0]).toHaveProperty('timestamp');
      expect(dnsHistory.data[0]).toHaveProperty('response_time_ms');
      expect(dnsHistory.data[0]).toHaveProperty('success');
      expect(dnsHistory.data[0]).toHaveProperty('resolved_address');

      // Test aggregated data for dashboard graphs
      const aggregatedPingData = await dataStore.getAggregatedPingData('test-target', timeRange, 1);
      const aggregatedDnsData = await dataStore.getAggregatedDnsData('test-dns', timeRange, 1);

      expect(aggregatedPingData.length).toBeGreaterThan(0);
      expect(aggregatedDnsData.length).toBeGreaterThan(0);

      // Verify aggregated data structure
      if (aggregatedPingData.length > 0) {
        expect(aggregatedPingData[0]).toHaveProperty('timestamp');
        expect(aggregatedPingData[0]).toHaveProperty('min_response_time');
        expect(aggregatedPingData[0]).toHaveProperty('max_response_time');
        expect(aggregatedPingData[0]).toHaveProperty('avg_response_time');
        expect(aggregatedPingData[0]).toHaveProperty('success_rate');
      }

      // Test summary statistics for dashboard
      const pingSummary = await dataStore.getPingSummary('test-target', timeRange);
      const dnsSummary = await dataStore.getDnsSummary('test-dns', timeRange);

      expect(pingSummary.total_tests).toBe(3);
      expect(pingSummary.successful_tests).toBe(2);
      expect(pingSummary.success_rate).toBeCloseTo(0.67, 1);
      expect(pingSummary.avg_response_time).toBeCloseTo(27.85, 1);

      expect(dnsSummary.total_tests).toBe(2);
      expect(dnsSummary.successful_tests).toBe(2);
      expect(dnsSummary.success_rate).toBe(1.0);
      expect(dnsSummary.avg_response_time).toBeCloseTo(16.95, 1);

      // Test available targets for dashboard selection
      const availableTargets = await dataStore.getAvailableTargets();
      expect(availableTargets.ping_targets).toContain('test-target');
      expect(availableTargets.dns_servers).toContain('test-dns');

      // Test recent data for real-time dashboard updates
      const recentPingData = await dataStore.getRecentPingData('test-target', 10);
      const recentDnsData = await dataStore.getRecentDnsData('test-dns', 10);

      expect(recentPingData.length).toBe(3);
      expect(recentDnsData.length).toBe(2);

      // Verify data is sorted by timestamp (most recent first)
      if (recentPingData.length >= 2) {
        expect(recentPingData[0]!.timestamp.getTime()).toBeGreaterThanOrEqual(recentPingData[1]!.timestamp.getTime());
      }
      if (recentDnsData.length >= 2) {
        expect(recentDnsData[0]!.timestamp.getTime()).toBeGreaterThanOrEqual(recentDnsData[1]!.timestamp.getTime());
      }
    });

    it('should handle dashboard service integration', async () => {
      // Test dashboard service initialization
      expect(dashboardService).toBeDefined();

      // Store some test data first
      const now = new Date();
      const testResult: PingResult = {
        timestamp: now,
        target_name: 'dashboard-test',
        target_address: '1.1.1.1',
        response_time_ms: 45.3,
        packet_loss_percent: 0,
        success: true
      };

      await dataStore.storePingResult(testResult);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test dashboard data retrieval through service
      const timeRange = {
        start: new Date(now.getTime() - 300000),
        end: new Date(now.getTime() + 60000)
      };

      const dashboardData = await dataStore.getPingHistory('dashboard-test', timeRange);
      expect(dashboardData.data.length).toBe(1);
      expect(dashboardData.data[0]!.target_name).toBe('dashboard-test');
      expect(dashboardData.data[0]!.response_time_ms).toBe(45.3);
    });
  });

  describe('Configuration Persistence and Reload', () => {
    it('should persist and reload configuration correctly', async () => {
      const originalConfig: NetworkMonitorConfig = {
        ping_targets: [
          {
            name: 'original-target',
            address: '8.8.8.8',
            interval: 60,
            enabled: true
          }
        ],
        dns_targets: [
          {
            name: 'original-dns',
            server_ip: '1.1.1.1',
            test_domains: ['example.com'],
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

      // Save original configuration
      await configManager.saveConfig(originalConfig);

      // Verify configuration file was created
      const configExists = await fs.access(TEST_CONFIG_PATH).then(() => true).catch(() => false);
      expect(configExists).toBe(true);

      // Read and verify configuration content
      const configContent = await fs.readFile(TEST_CONFIG_PATH, 'utf-8');
      const parsedConfig = JSON.parse(configContent);
      expect(parsedConfig.ping_targets).toHaveLength(1);
      expect(parsedConfig.ping_targets[0].name).toBe('original-target');
      expect(parsedConfig.dns_targets).toHaveLength(1);
      expect(parsedConfig.dns_targets[0].name).toBe('original-dns');

      // Create new config manager instance to test loading
      const newConfigManager = new ConfigManager(TEST_CONFIG_PATH);
      const loadedConfig = await newConfigManager.loadConfig();

      // Verify loaded configuration matches original
      expect(loadedConfig.ping_targets).toHaveLength(1);
      expect(loadedConfig.ping_targets[0]!.name).toBe('original-target');
      expect(loadedConfig.ping_targets[0]!.address).toBe('8.8.8.8');
      expect(loadedConfig.ping_targets[0]!.interval).toBe(60);
      expect(loadedConfig.ping_targets[0]!.enabled).toBe(true);

      expect(loadedConfig.dns_targets).toHaveLength(1);
      expect(loadedConfig.dns_targets[0]!.name).toBe('original-dns');
      expect(loadedConfig.dns_targets[0]!.server_ip).toBe('1.1.1.1');
      expect(loadedConfig.dns_targets[0]!.test_domains).toEqual(['example.com']);

      expect(loadedConfig.alert_thresholds.ping_timeout_ms).toBe(5000);
      expect(loadedConfig.alert_thresholds.consecutive_failures).toBe(3);
      expect(loadedConfig.data_retention_days).toBe(30);

      // Test configuration update
      const updatedConfig = await newConfigManager.updateConfig({
        ping_targets: [
          ...loadedConfig.ping_targets,
          {
            name: 'new-target',
            address: '1.1.1.1',
            interval: 30,
            enabled: true
          }
        ]
      });

      expect(updatedConfig.ping_targets).toHaveLength(2);
      expect(updatedConfig.ping_targets[1]!.name).toBe('new-target');

      // Verify updated configuration was persisted
      const updatedConfigContent = await fs.readFile(TEST_CONFIG_PATH, 'utf-8');
      const updatedParsedConfig = JSON.parse(updatedConfigContent);
      expect(updatedParsedConfig.ping_targets).toHaveLength(2);
      expect(updatedParsedConfig.ping_targets[1].name).toBe('new-target');

      // Test configuration backup and restore
      await newConfigManager.createBackup();
      const backupExists = await fs.access(TEST_CONFIG_PATH + '.backup').then(() => true).catch(() => false);
      expect(backupExists).toBe(true);

      // Corrupt the main config file
      await fs.writeFile(TEST_CONFIG_PATH, 'invalid json', 'utf-8');

      // Restore from backup
      const restoredConfig = await newConfigManager.restoreFromBackup();
      expect(restoredConfig.ping_targets).toHaveLength(2);
      expect(restoredConfig.ping_targets[1]!.name).toBe('new-target');
    });

    it('should handle configuration validation during persistence', async () => {
      const invalidConfig = {
        ping_targets: [
          {
            name: '', // Invalid: empty name
            address: '8.8.8.8',
            interval: 60,
            enabled: true
          }
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

      // Attempt to save invalid configuration
      await expect(configManager.saveConfig(invalidConfig as any)).rejects.toThrow();

      // Verify no config file was created
      const configExists = await fs.access(TEST_CONFIG_PATH).then(() => true).catch(() => false);
      expect(configExists).toBe(false);

      // Test with valid configuration
      const validConfig: NetworkMonitorConfig = {
        ping_targets: [
          {
            name: 'valid-target',
            address: '8.8.8.8',
            interval: 60,
            enabled: true
          }
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

      // Should save successfully
      await expect(configManager.saveConfig(validConfig)).resolves.not.toThrow();

      // Verify config file was created
      const configExistsAfter = await fs.access(TEST_CONFIG_PATH).then(() => true).catch(() => false);
      expect(configExistsAfter).toBe(true);
    });

    it('should handle configuration hot-reload', async () => {
      const initialConfig: NetworkMonitorConfig = {
        ping_targets: [
          {
            name: 'initial-target',
            address: '8.8.8.8',
            interval: 60,
            enabled: true
          }
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

      // Save initial configuration
      await configManager.saveConfig(initialConfig);

      // Track configuration change events
      const configChanges: NetworkMonitorConfig[] = [];
      configManager.on('configChanged', (config) => {
        configChanges.push(config);
      });

      // Update configuration
      const updatedConfig = await configManager.updateConfig({
        ping_targets: [
          ...initialConfig.ping_targets,
          {
            name: 'hot-reload-target',
            address: '1.1.1.1',
            interval: 30,
            enabled: true
          }
        ]
      });

      // Verify configuration was updated
      expect(updatedConfig.ping_targets).toHaveLength(2);
      expect(updatedConfig.ping_targets[1]!.name).toBe('hot-reload-target');

      // Verify configuration change event was emitted
      expect(configChanges).toHaveLength(1);
      expect(configChanges[0]!.ping_targets).toHaveLength(2);
      expect(configChanges[0]!.ping_targets[1]!.name).toBe('hot-reload-target');

      // Verify current configuration is updated
      const currentConfig = configManager.getCurrentConfig();
      expect(currentConfig).not.toBeNull();
      expect(currentConfig!.ping_targets).toHaveLength(2);
      expect(currentConfig!.ping_targets[1]!.name).toBe('hot-reload-target');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create data store with invalid path
      const invalidDataStore = new DataStore(logger, '/invalid/path/that/does/not/exist');

      // Should handle initialization error
      await expect(invalidDataStore.initialize()).rejects.toThrow();
    });

    it('should handle configuration file corruption', async () => {
      // Create corrupted config file
      await fs.writeFile(TEST_CONFIG_PATH, 'invalid json content', 'utf-8');

      // Should handle loading error gracefully
      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('should handle missing configuration file', async () => {
      // Ensure config file doesn't exist
      try {
        await fs.unlink(TEST_CONFIG_PATH);
      } catch {
        // File might not exist, ignore
      }

      // Should create default configuration
      const config = await configManager.loadConfig();
      expect(config).toBeDefined();
      expect(config.ping_targets).toHaveLength(3); // Default config has 3 ping targets
      expect(config.dns_targets).toHaveLength(2); // Default config has 2 DNS targets

      // Verify default config file was created
      const configExists = await fs.access(TEST_CONFIG_PATH).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
    });
  });

  describe('System Integration', () => {
    it('should integrate all components in a complete workflow', async () => {
      // Complete system integration test
      const testConfig: NetworkMonitorConfig = {
        ping_targets: [
          {
            name: 'system-test-ping',
            address: '127.0.0.1',
            interval: 30, // Minimum allowed interval
            enabled: true
          }
        ],
        dns_targets: [
          {
            name: 'system-test-dns',
            server_ip: '8.8.8.8',
            test_domains: ['google.com'],
            interval: 30, // Minimum allowed interval
            enabled: true
          }
        ],
        alert_thresholds: {
          ping_timeout_ms: 5000,
          ping_loss_percent: 10.0,
          dns_timeout_ms: 3000,
          consecutive_failures: 2
        },
        data_retention_days: 30
      };

      // 1. Save configuration
      await configManager.saveConfig(testConfig);

      // 2. Create sensors
      const pingSensorId = await haSensor.create_ping_sensor(testConfig.ping_targets[0]!);
      const dnsSensorId = await haSensor.create_dns_sensor(testConfig.dns_targets[0]!);

      // 3. Set up monitoring
      pingMonitor.updateTargets(testConfig.ping_targets);
      dnsMonitor.updateTargets(testConfig.dns_targets);

      // 4. Track all events
      const allEvents: any[] = [];
      
      pingMonitor.on('result', (result) => {
        allEvents.push({ type: 'ping_result', data: result });
        stateManager.processPingResult(result);
        dataStore.storePingResult(result);
      });

      dnsMonitor.on('result', (result) => {
        allEvents.push({ type: 'dns_result', data: result });
        stateManager.processDNSResult(result);
        dataStore.storeDnsResult(result);
      });

      stateManager.on('stateChange', (change) => {
        allEvents.push({ type: 'state_change', data: change });
      });

      haSensor.on('sensor_updated', (update) => {
        allEvents.push({ type: 'sensor_update', data: update });
      });

      // 5. Start monitoring
      pingMonitor.start();
      dnsMonitor.start();

      // 6. Wait for results
      await new Promise<void>((resolve) => {
        let pingReceived = false;
        let dnsReceived = false;

        const checkComplete = () => {
          if (pingReceived && dnsReceived) {
            resolve();
          }
        };

        const timeout = setTimeout(() => {
          resolve(); // Resolve anyway after timeout
        }, 35000); // Wait 35s for 30s interval

        pingMonitor.once('result', () => {
          pingReceived = true;
          clearTimeout(timeout);
          checkComplete();
        });

        dnsMonitor.once('result', () => {
          dnsReceived = true;
          clearTimeout(timeout);
          checkComplete();
        });
      });

      // 7. Stop monitoring
      pingMonitor.stop();
      dnsMonitor.stop();

      // 8. Verify system integration
      expect(allEvents.length).toBeGreaterThan(0);

      // Check that we have both ping and DNS results
      const pingResults = allEvents.filter(e => e.type === 'ping_result');
      const dnsResults = allEvents.filter(e => e.type === 'dns_result');

      expect(pingResults.length).toBeGreaterThan(0);
      // DNS might not always succeed in test environment, so we don't require it

      // Verify sensors exist
      expect(haSensor.getSensor(pingSensorId)).toBeDefined();
      expect(haSensor.getSensor(dnsSensorId)).toBeDefined();

      // Verify state tracking
      const pingState = stateManager.getState('system-test-ping', 'ping');
      expect(pingState).toBeDefined();

      // Verify data storage (wait for async operations)
      await new Promise(resolve => setTimeout(resolve, 200));
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };
      const storedPingData = await dataStore.getPingHistory('system-test-ping', timeRange);
      expect(storedPingData.data.length).toBeGreaterThan(0);

      // Verify overall system health
      const overallHealth = stateManager.getOverallHealth();
      expect(['healthy', 'degraded', 'critical']).toContain(overallHealth);

      // Verify configuration persistence
      const currentConfig = configManager.getCurrentConfig();
      expect(currentConfig).not.toBeNull();
      expect(currentConfig!.ping_targets[0]!.name).toBe('system-test-ping');
      expect(currentConfig!.dns_targets[0]!.name).toBe('system-test-dns');
    }, 40000); // 40 second timeout for 30 second interval
  });
});