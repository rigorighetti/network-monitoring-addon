/**
 * Integration tests for monitoring components
 */

import { PingMonitor, DNSMonitor, StateManager } from './index';
import { PingTarget, DNSTarget } from '../types';

describe('Monitoring Integration', () => {
  let pingMonitor: PingMonitor;
  let dnsMonitor: DNSMonitor;
  let stateManager: StateManager;

  beforeEach(() => {
    pingMonitor = new PingMonitor();
    dnsMonitor = new DNSMonitor();
    stateManager = new StateManager();
  });

  afterEach(() => {
    pingMonitor.stop();
    dnsMonitor.stop();
  });

  describe('PingMonitor', () => {
    it('should initialize with empty targets', () => {
      expect(pingMonitor.getTargets()).toEqual([]);
    });

    it('should update targets correctly', () => {
      const targets: PingTarget[] = [
        {
          name: 'test-target',
          address: '8.8.8.8',
          interval: 60,
          enabled: true
        }
      ];

      pingMonitor.updateTargets(targets);
      expect(pingMonitor.getTargets()).toEqual(targets);
    });

    it('should emit result events when monitoring', (done) => {
      const target: PingTarget = {
        name: 'test-ping',
        address: '127.0.0.1',
        interval: 1,
        enabled: true
      };

      pingMonitor.updateTargets([target]);
      
      pingMonitor.once('result', (result) => {
        expect(result.target_name).toBe('test-ping');
        expect(result.target_address).toBe('127.0.0.1');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.packet_loss_percent).toBe('number');
        done();
      });

      pingMonitor.start();
    }, 10000);
  });

  describe('DNSMonitor', () => {
    it('should initialize with empty targets', () => {
      expect(dnsMonitor.getTargets()).toEqual([]);
    });

    it('should update targets correctly', () => {
      const targets: DNSTarget[] = [
        {
          name: 'test-dns',
          server_ip: '8.8.8.8',
          test_domains: ['google.com'],
          interval: 60,
          enabled: true
        }
      ];

      dnsMonitor.updateTargets(targets);
      expect(dnsMonitor.getTargets()).toEqual(targets);
    });

    it('should emit result events when monitoring', (done) => {
      const target: DNSTarget = {
        name: 'test-dns',
        server_ip: '8.8.8.8',
        test_domains: ['google.com'],
        interval: 1,
        enabled: true
      };

      dnsMonitor.updateTargets([target]);
      
      dnsMonitor.once('result', (result) => {
        expect(result.server_name).toBe('test-dns');
        expect(result.server_ip).toBe('8.8.8.8');
        expect(result.domain).toBe('google.com');
        expect(typeof result.success).toBe('boolean');
        done();
      });

      dnsMonitor.start();
    }, 10000);
  });

  describe('StateManager', () => {
    it('should initialize with empty states', () => {
      expect(stateManager.getAllStates()).toEqual([]);
    });

    it('should process ping results and update state', () => {
      const pingResult = {
        timestamp: new Date(),
        target_name: 'test-target',
        target_address: '8.8.8.8',
        response_time_ms: 50,
        packet_loss_percent: 0,
        success: true
      };

      stateManager.processPingResult(pingResult);
      
      const state = stateManager.getState('test-target', 'ping');
      expect(state).toBeDefined();
      expect(state?.status).toBe('online');
      expect(state?.consecutive_failures).toBe(0);
    });

    it('should process DNS results and update state', () => {
      const dnsResult = {
        timestamp: new Date(),
        server_name: 'test-dns',
        server_ip: '8.8.8.8',
        domain: 'google.com',
        query_type: 'A',
        response_time_ms: 30,
        success: true,
        resolved_address: '142.250.191.14'
      };

      stateManager.processDNSResult(dnsResult);
      
      const state = stateManager.getState('test-dns', 'dns');
      expect(state).toBeDefined();
      expect(state?.status).toBe('available');
      expect(state?.consecutive_failures).toBe(0);
    });

    it('should emit state change events', (done) => {
      const pingResult = {
        timestamp: new Date(),
        target_name: 'test-target',
        target_address: '8.8.8.8',
        response_time_ms: null,
        packet_loss_percent: 100,
        success: false,
        error_message: 'Request timeout'
      };

      stateManager.once('stateChange', (event) => {
        expect(event.target_name).toBe('test-target');
        expect(event.target_type).toBe('ping');
        expect(event.new_status).toBe('offline');
        done();
      });

      // Process multiple failures to trigger state change
      for (let i = 0; i < 3; i++) {
        stateManager.processPingResult(pingResult);
      }
    });

    it('should track overall health status', () => {
      // Initially healthy
      expect(stateManager.getOverallHealth()).toBe('healthy');

      // Add a successful ping
      stateManager.processPingResult({
        timestamp: new Date(),
        target_name: 'good-target',
        target_address: '8.8.8.8',
        response_time_ms: 50,
        packet_loss_percent: 0,
        success: true
      });

      expect(stateManager.getOverallHealth()).toBe('healthy');

      // Add a failed target
      for (let i = 0; i < 3; i++) {
        stateManager.processPingResult({
          timestamp: new Date(),
          target_name: 'bad-target',
          target_address: '192.0.2.1',
          response_time_ms: null,
          packet_loss_percent: 100,
          success: false
        });
      }

      expect(stateManager.getOverallHealth()).toBe('degraded');
    });
  });

  describe('Component Integration', () => {
    it('should integrate ping monitor with state manager', (done) => {
      const target: PingTarget = {
        name: 'integration-test',
        address: '127.0.0.1',
        interval: 1,
        enabled: true
      };

      pingMonitor.updateTargets([target]);
      
      pingMonitor.on('result', (result) => {
        stateManager.processPingResult(result);
        
        const state = stateManager.getState('integration-test', 'ping');
        expect(state).toBeDefined();
        expect(state?.target_name).toBe('integration-test');
        
        done();
      });

      pingMonitor.start();
    }, 10000);
  });
});