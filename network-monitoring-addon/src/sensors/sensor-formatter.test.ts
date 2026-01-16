/**
 * Tests for SensorFormatter class
 */

import { SensorFormatter } from './sensor-formatter';
import { PingResult, DNSResult, PingSensorState, DNSSensorState, SensorAttributes, HomeAssistantSensor } from '../types';

describe('SensorFormatter', () => {
  let formatter: SensorFormatter;

  beforeEach(() => {
    formatter = new SensorFormatter();
  });

  describe('Ping Sensor Formatting', () => {
    it('should format successful ping sensor state correctly', () => {
      const result: PingResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        target_name: 'google',
        target_address: '8.8.8.8',
        response_time_ms: 25.5,
        packet_loss_percent: 0,
        success: true
      };

      const sensorState: PingSensorState = {
        state: 'online',
        response_time: 25.5,
        packet_loss: 0,
        last_success: new Date('2024-01-01T12:00:00Z'),
        consecutive_failures: 0
      };

      const formatted = formatter.formatPingSensorState(result, sensorState);

      expect(formatted.state).toBe('25.5');
      expect(formatted.attributes).toMatchObject({
        friendly_name: 'Ping google',
        device_class: 'connectivity',
        unit_of_measurement: 'ms',
        icon: 'mdi:network-outline',
        state_class: 'measurement',
        status: 'online',
        response_time: 25.5,
        packet_loss: 0,
        success: true,
        target_name: 'google',
        target_address: '8.8.8.8',
        consecutive_failures: 0,
        available: true,
        monitoring_type: 'ping',
        performance_status: 'excellent'
      });
    });

    it('should format failed ping sensor state correctly', () => {
      const result: PingResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        target_name: 'unreachable',
        target_address: '192.168.1.999',
        response_time_ms: null,
        packet_loss_percent: 100,
        success: false,
        error_message: 'Host unreachable'
      };

      const sensorState: PingSensorState = {
        state: 'offline',
        response_time: null,
        packet_loss: 100,
        last_success: new Date('2024-01-01T11:00:00Z'),
        consecutive_failures: 3
      };

      const formatted = formatter.formatPingSensorState(result, sensorState);

      expect(formatted.state).toBe('offline');
      expect(formatted.attributes).toMatchObject({
        status: 'offline',
        response_time: null,
        packet_loss: 100,
        success: false,
        consecutive_failures: 3,
        error_message: 'Host unreachable',
        performance_status: 'failed',
        available: true // Still available since consecutive_failures < 5
      });
      expect(formatted.attributes.unit_of_measurement).toBeUndefined();
      expect(formatted.attributes.state_class).toBeUndefined();
    });

    it('should format degraded ping sensor state correctly', () => {
      const result: PingResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        target_name: 'slow-server',
        target_address: '10.0.0.1',
        response_time_ms: 250,
        packet_loss_percent: 5,
        success: true
      };

      const sensorState: PingSensorState = {
        state: 'degraded',
        response_time: 250,
        packet_loss: 5,
        last_success: new Date('2024-01-01T12:00:00Z'),
        consecutive_failures: 0
      };

      const formatted = formatter.formatPingSensorState(result, sensorState);

      expect(formatted.state).toBe('250');
      expect(formatted.attributes).toMatchObject({
        status: 'degraded',
        icon: 'mdi:network-strength-2',
        performance_status: 'poor'
      });
    });
  });

  describe('DNS Sensor Formatting', () => {
    it('should format successful DNS sensor state correctly', () => {
      const result: DNSResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        server_name: 'cloudflare',
        server_ip: '1.1.1.1',
        domain: 'example.com',
        query_type: 'A',
        response_time_ms: 15,
        success: true,
        resolved_address: '93.184.216.34'
      };

      const sensorState: DNSSensorState = {
        state: 'available',
        response_time: 15,
        success_rate: 98.5,
        last_success: new Date('2024-01-01T12:00:00Z'),
        consecutive_failures: 0
      };

      const formatted = formatter.formatDNSSensorState(result, sensorState);

      expect(formatted.state).toBe('15');
      expect(formatted.attributes).toMatchObject({
        friendly_name: 'DNS cloudflare',
        device_class: 'connectivity',
        unit_of_measurement: 'ms',
        icon: 'mdi:dns',
        state_class: 'measurement',
        status: 'available',
        response_time: 15,
        success_rate: 98.5,
        success: true,
        server_name: 'cloudflare',
        server_ip: '1.1.1.1',
        domain: 'example.com',
        query_type: 'A',
        resolved_address: '93.184.216.34',
        consecutive_failures: 0,
        available: true,
        monitoring_type: 'dns',
        performance_status: 'excellent'
      });
    });

    it('should format failed DNS sensor state correctly', () => {
      const result: DNSResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        server_name: 'broken-dns',
        server_ip: '192.168.1.1',
        domain: 'nonexistent.invalid',
        query_type: 'A',
        response_time_ms: null,
        success: false,
        error_message: 'NXDOMAIN'
      };

      const sensorState: DNSSensorState = {
        state: 'unavailable',
        response_time: null,
        success_rate: 0,
        last_success: new Date('2024-01-01T10:00:00Z'),
        consecutive_failures: 5
      };

      const formatted = formatter.formatDNSSensorState(result, sensorState);

      expect(formatted.state).toBe('unavailable');
      expect(formatted.attributes).toMatchObject({
        status: 'unavailable',
        response_time: null,
        success_rate: 0,
        success: false,
        consecutive_failures: 5,
        error_message: 'NXDOMAIN',
        performance_status: 'failed',
        available: false // consecutive_failures >= 5
      });
    });

    it('should format slow DNS sensor state correctly', () => {
      const result: DNSResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        server_name: 'slow-dns',
        server_ip: '8.8.8.8',
        domain: 'example.com',
        query_type: 'A',
        response_time_ms: 150,
        success: true,
        resolved_address: '93.184.216.34'
      };

      const sensorState: DNSSensorState = {
        state: 'slow',
        response_time: 150,
        success_rate: 85,
        last_success: new Date('2024-01-01T12:00:00Z'),
        consecutive_failures: 0
      };

      const formatted = formatter.formatDNSSensorState(result, sensorState);

      expect(formatted.state).toBe('150');
      expect(formatted.attributes).toMatchObject({
        status: 'slow',
        icon: 'mdi:dns-outline',
        performance_status: 'poor'
      });
    });
  });

  describe('Home Assistant Discovery Formatting', () => {
    it('should format sensor for Home Assistant discovery correctly', () => {
      const sensor: HomeAssistantSensor = {
        entity_id: 'sensor.network_monitor_ping_google',
        state: '25',
        attributes: {
          friendly_name: 'Ping Google',
          device_class: 'connectivity',
          unit_of_measurement: 'ms',
          icon: 'mdi:network-outline',
          state_class: 'measurement' as const
        },
        last_changed: new Date(),
        last_updated: new Date()
      };

      const discovery = formatter.formatSensorForDiscovery(sensor);

      expect(discovery).toMatchObject({
        name: 'Ping Google',
        unique_id: 'sensor.network_monitor_ping_google',
        state_topic: 'homeassistant/sensor/sensor.network_monitor_ping_google/state',
        json_attributes_topic: 'homeassistant/sensor/sensor.network_monitor_ping_google/attributes',
        device_class: 'connectivity',
        unit_of_measurement: 'ms',
        icon: 'mdi:network-outline',
        state_class: 'measurement',
        availability_topic: 'homeassistant/sensor/sensor.network_monitor_ping_google/availability',
        device: {
          identifiers: ['network_monitor'],
          name: 'Network Monitor',
          model: 'Home Assistant Add-on',
          manufacturer: 'Network Monitoring Add-on'
        }
      });
    });

    it('should remove undefined values from discovery config', () => {
      const sensor: HomeAssistantSensor = {
        entity_id: 'sensor.test',
        state: 'offline',
        attributes: {
          friendly_name: 'Test Sensor',
          device_class: 'connectivity',
          icon: 'mdi:network-off-outline'
        },
        last_changed: new Date(),
        last_updated: new Date()
      };

      const discovery = formatter.formatSensorForDiscovery(sensor);

      expect(discovery).not.toHaveProperty('unit_of_measurement');
      expect(discovery).not.toHaveProperty('state_class');
      expect(discovery).toHaveProperty('device_class');
      expect(discovery).toHaveProperty('icon');
    });
  });

  describe('Sensor Attribute Validation', () => {
    it('should validate correct sensor attributes', () => {
      const attributes: SensorAttributes = {
        friendly_name: 'Test Sensor',
        device_class: 'connectivity',
        unit_of_measurement: 'ms',
        icon: 'mdi:network-outline',
        state_class: 'measurement' as const
      };

      const validation = formatter.validateSensorAttributes(attributes);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing friendly_name', () => {
      const attributes = {
        device_class: 'connectivity'
      } as any;

      const validation = formatter.validateSensorAttributes(attributes);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('friendly_name is required');
    });

    it('should detect invalid device_class', () => {
      const attributes = {
        friendly_name: 'Test',
        device_class: 'invalid_class'
      };

      const validation = formatter.validateSensorAttributes(attributes);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid device_class: invalid_class');
    });

    it('should detect invalid state_class', () => {
      const attributes: SensorAttributes = {
        friendly_name: 'Test',
        state_class: 'invalid_state_class' as any
      };

      const validation = formatter.validateSensorAttributes(attributes);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid state_class: invalid_state_class');
    });

    it('should detect invalid icon format', () => {
      const attributes: SensorAttributes = {
        friendly_name: 'Test',
        icon: 'invalid-icon'
      };

      const validation = formatter.validateSensorAttributes(attributes);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Icon must start with "mdi:"');
    });
  });

  describe('State Value Formatting', () => {
    it('should format numeric values correctly', () => {
      expect(formatter.formatStateValue(25.555)).toBe(25.56);
      expect(formatter.formatStateValue(100)).toBe(100);
      expect(formatter.formatStateValue(0.123)).toBe(0.12);
    });

    it('should handle null and undefined values', () => {
      expect(formatter.formatStateValue(null)).toBe('unknown');
      expect(formatter.formatStateValue(undefined)).toBe('unknown');
    });

    it('should convert non-numeric values to strings', () => {
      expect(formatter.formatStateValue('online')).toBe('online');
      expect(formatter.formatStateValue(true)).toBe('true');
    });
  });

  describe('Comprehensive Attributes Creation', () => {
    it('should create comprehensive attributes with additional metrics', () => {
      const baseAttributes: SensorAttributes = {
        friendly_name: 'Test Sensor',
        device_class: 'connectivity'
      };

      const additionalMetrics = {
        custom_metric: 'value',
        another_metric: 123
      };

      const comprehensive = formatter.createComprehensiveAttributes(baseAttributes, additionalMetrics);

      expect(comprehensive).toMatchObject({
        friendly_name: 'Test Sensor',
        device_class: 'connectivity',
        custom_metric: 'value',
        another_metric: 123,
        addon_version: '1.1.0',
        available: true
      });
      expect(comprehensive.last_formatted).toBeDefined();
    });

    it('should provide default friendly_name if missing', () => {
      const baseAttributes = {} as SensorAttributes;

      const comprehensive = formatter.createComprehensiveAttributes(baseAttributes);

      expect(comprehensive.friendly_name).toBe('Unknown Sensor');
    });
  });

  describe('Performance Status Classification', () => {
    it('should classify ping performance correctly', () => {
      // Test through formatPingSensorState since performance status is private
      const createPingTest = (responseTime: number) => {
        const result: PingResult = {
          timestamp: new Date(),
          target_name: 'test',
          target_address: '1.1.1.1',
          response_time_ms: responseTime,
          packet_loss_percent: 0,
          success: true
        };

        const sensorState: PingSensorState = {
          state: 'online',
          response_time: responseTime,
          packet_loss: 0,
          last_success: new Date(),
          consecutive_failures: 0
        };

        return formatter.formatPingSensorState(result, sensorState);
      };

      expect(createPingTest(25).attributes.performance_status).toBe('excellent');
      expect(createPingTest(75).attributes.performance_status).toBe('good');
      expect(createPingTest(150).attributes.performance_status).toBe('fair');
      expect(createPingTest(300).attributes.performance_status).toBe('poor');
    });

    it('should classify DNS performance correctly', () => {
      // Test through formatDNSSensorState since performance status is private
      const createDNSTest = (responseTime: number) => {
        const result: DNSResult = {
          timestamp: new Date(),
          server_name: 'test',
          server_ip: '1.1.1.1',
          domain: 'example.com',
          query_type: 'A',
          response_time_ms: responseTime,
          success: true
        };

        const sensorState: DNSSensorState = {
          state: 'available',
          response_time: responseTime,
          success_rate: 100,
          last_success: new Date(),
          consecutive_failures: 0
        };

        return formatter.formatDNSSensorState(result, sensorState);
      };

      expect(createDNSTest(10).attributes.performance_status).toBe('excellent');
      expect(createDNSTest(35).attributes.performance_status).toBe('good');
      expect(createDNSTest(75).attributes.performance_status).toBe('fair');
      expect(createDNSTest(150).attributes.performance_status).toBe('poor');
    });
  });

  describe('Availability Tracking', () => {
    it('should track ping sensor availability correctly', () => {
      const createPingTest = (state: 'online' | 'offline' | 'degraded', consecutiveFailures: number) => {
        const result: PingResult = {
          timestamp: new Date(),
          target_name: 'test',
          target_address: '1.1.1.1',
          response_time_ms: state === 'offline' ? null : 50,
          packet_loss_percent: state === 'offline' ? 100 : 0,
          success: state !== 'offline'
        };

        const sensorState: PingSensorState = {
          state,
          response_time: state === 'offline' ? null : 50,
          packet_loss: state === 'offline' ? 100 : 0,
          last_success: new Date(),
          consecutive_failures: consecutiveFailures
        };

        return formatter.formatPingSensorState(result, sensorState);
      };

      expect(createPingTest('online', 0).attributes.available).toBe(true);
      expect(createPingTest('degraded', 2).attributes.available).toBe(true);
      expect(createPingTest('offline', 3).attributes.available).toBe(true);
      expect(createPingTest('offline', 5).attributes.available).toBe(false);
    });

    it('should track DNS sensor availability correctly', () => {
      const createDNSTest = (state: 'available' | 'unavailable' | 'slow', consecutiveFailures: number) => {
        const result: DNSResult = {
          timestamp: new Date(),
          server_name: 'test',
          server_ip: '1.1.1.1',
          domain: 'example.com',
          query_type: 'A',
          response_time_ms: state === 'unavailable' ? null : 50,
          success: state !== 'unavailable'
        };

        const sensorState: DNSSensorState = {
          state,
          response_time: state === 'unavailable' ? null : 50,
          success_rate: state === 'unavailable' ? 0 : 90,
          last_success: new Date(),
          consecutive_failures: consecutiveFailures
        };

        return formatter.formatDNSSensorState(result, sensorState);
      };

      expect(createDNSTest('available', 0).attributes.available).toBe(true);
      expect(createDNSTest('slow', 2).attributes.available).toBe(true);
      expect(createDNSTest('unavailable', 3).attributes.available).toBe(true);
      expect(createDNSTest('unavailable', 5).attributes.available).toBe(false);
    });
  });
});