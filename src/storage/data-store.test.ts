/**
 * Tests for DataStore class
 */

import { DataStore, TimeRange } from './data-store';
import { PingResult, DNSResult } from '../types/results';
import { Logger } from '../types';
import fs from 'fs';
import path from 'path';

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('DataStore', () => {
  let dataStore: DataStore;
  let testDataDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test database
    testDataDir = path.join(__dirname, '../../test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    dataStore = new DataStore(mockLogger, testDataDir, 7); // 7 days retention for testing
    await dataStore.initialize();
  });

  afterEach(async () => {
    await dataStore.close();
    
    // Clean up test database
    const dbPath = path.join(testDataDir, 'network_monitoring.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to SQLite database');
      expect(mockLogger.info).toHaveBeenCalledWith('Database initialized successfully');
    });

    it('should create required tables', async () => {
      const stats = await dataStore.getStats();
      expect(stats.ping_count).toBe(0);
      expect(stats.dns_count).toBe(0);
    });
  });

  describe('Ping Data Storage', () => {
    it('should store ping results correctly', async () => {
      const pingResult: PingResult = {
        timestamp: new Date(),
        target_name: 'test-target',
        target_address: '8.8.8.8',
        response_time_ms: 25.5,
        packet_loss_percent: 0,
        success: true
      };

      await dataStore.storePingResult(pingResult);
      
      const stats = await dataStore.getStats();
      expect(stats.ping_count).toBe(1);
    });

    it('should retrieve ping history correctly', async () => {
      const now = new Date();
      const pingResult: PingResult = {
        timestamp: now,
        target_name: 'test-target',
        target_address: '8.8.8.8',
        response_time_ms: 25.5,
        packet_loss_percent: 0,
        success: true
      };

      await dataStore.storePingResult(pingResult);

      const timeRange: TimeRange = {
        start: new Date(now.getTime() - 3600000), // 1 hour ago
        end: new Date(now.getTime() + 3600000)    // 1 hour from now
      };

      const history = await dataStore.getPingHistory('test-target', timeRange);
      expect(history.data).toHaveLength(1);
      expect(history.data[0]?.target_name).toBe('test-target');
      expect(history.data[0]?.response_time_ms).toBe(25.5);
    });
  });

  describe('DNS Data Storage', () => {
    it('should store DNS results correctly', async () => {
      const dnsResult: DNSResult = {
        timestamp: new Date(),
        server_name: 'test-dns',
        server_ip: '8.8.8.8',
        domain: 'example.com',
        query_type: 'A',
        response_time_ms: 15.2,
        success: true,
        resolved_address: '93.184.216.34'
      };

      await dataStore.storeDnsResult(dnsResult);
      
      const stats = await dataStore.getStats();
      expect(stats.dns_count).toBe(1);
    });

    it('should retrieve DNS history correctly', async () => {
      const now = new Date();
      const dnsResult: DNSResult = {
        timestamp: now,
        server_name: 'test-dns',
        server_ip: '8.8.8.8',
        domain: 'example.com',
        query_type: 'A',
        response_time_ms: 15.2,
        success: true,
        resolved_address: '93.184.216.34'
      };

      await dataStore.storeDnsResult(dnsResult);

      const timeRange: TimeRange = {
        start: new Date(now.getTime() - 3600000), // 1 hour ago
        end: new Date(now.getTime() + 3600000)    // 1 hour from now
      };

      const history = await dataStore.getDnsHistory('test-dns', timeRange);
      expect(history.data).toHaveLength(1);
      expect(history.data[0]?.server_name).toBe('test-dns');
      expect(history.data[0]?.response_time_ms).toBe(15.2);
    });
  });

  describe('Data Aggregation', () => {
    beforeEach(async () => {
      // Add some test data for aggregation
      const baseTime = new Date('2024-01-01T12:00:00Z');
      
      for (let i = 0; i < 10; i++) {
        const pingResult: PingResult = {
          timestamp: new Date(baseTime.getTime() + (i * 60000)), // 1 minute intervals
          target_name: 'test-target',
          target_address: '8.8.8.8',
          response_time_ms: i % 5 === 0 ? null : 20 + (i * 2), // Some null response times for failures
          packet_loss_percent: i % 3 === 0 ? 10 : 0, // Some packet loss
          success: i % 5 !== 0 // Some failures
        };
        await dataStore.storePingResult(pingResult);
      }
    });

    it('should aggregate ping data correctly', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01T11:00:00Z'),
        end: new Date('2024-01-01T13:00:00Z')
      };

      const aggregated = await dataStore.getAggregatedPingData('test-target', timeRange, 60); // 60 minute intervals
      expect(aggregated).toHaveLength(1);
      
      const data = aggregated[0];
      expect(data?.total_count).toBe(8); // 8 results with non-null response times
      expect(data?.min_response_time).toBe(22); // First successful result (i=1)
      expect(data?.max_response_time).toBe(38); // Last result (i=9)
    });

    it('should get ping summary correctly', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01T11:00:00Z'),
        end: new Date('2024-01-01T13:00:00Z')
      };

      const summary = await dataStore.getPingSummary('test-target', timeRange);
      expect(summary.total_tests).toBe(10);
      expect(summary.successful_tests).toBe(8); // 8 out of 10 successful
      expect(summary.success_rate).toBe(0.8);
    });
  });

  describe('Available Targets', () => {
    it('should return available targets correctly', async () => {
      // Add some test data
      await dataStore.storePingResult({
        timestamp: new Date(),
        target_name: 'ping-target-1',
        target_address: '8.8.8.8',
        response_time_ms: 25,
        packet_loss_percent: 0,
        success: true
      });

      await dataStore.storeDnsResult({
        timestamp: new Date(),
        server_name: 'dns-server-1',
        server_ip: '8.8.8.8',
        domain: 'example.com',
        query_type: 'A',
        response_time_ms: 15,
        success: true
      });

      const targets = await dataStore.getAvailableTargets();
      expect(targets.ping_targets).toContain('ping-target-1');
      expect(targets.dns_servers).toContain('dns-server-1');
    });
  });
});