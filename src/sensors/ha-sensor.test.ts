/**
 * Tests for HASensor class integration with SensorFormatter
 */

import { HASensor } from './ha-sensor';
import { PingTarget, DNSTarget, PingResult, DNSResult, PingSensorState, DNSSensorState } from '../types';

describe('HASensor Integration', () => {
  let haSensor: HASensor;

  beforeEach(() => {
    haSensor = new HASensor({ deviceName: 'test_monitor' });
  });

  describe('Sensor Creation', () => {
    it('should create ping sensor with proper formatting', async () => {
      const target: PingTarget = {
        name: 'google',
        address: '8.8.8.8',
        interval: 60,
        enabled: true
      };

      const entityId = await haSensor.create_ping_sensor(target);

      expect(entityId).toBe('sensor.test_monitor_ping_google');
      
      const sensor = haSensor.getSensor(entityId);
      expect(sensor).toBeDefined();
      expect(sensor!.attributes.friendly_name).toBe('Ping google');
      expect(sensor!.attributes.device_class).toBe('connectivity');
      expect(sensor!.attributes.icon).toBe('mdi:network-outline');
    });

    it('should create DNS sensor with proper formatting', async () => {
      const target: DNSTarget = {
        name: 'cloudflare',
        server_ip: '1.1.1.1',
        test_domains: ['example.com'],
        interval: 60,
        enabled: true
      };

      const entityId = await haSensor.create_dns_sensor(target);

      expect(entityId).toBe('sensor.test_monitor_dns_cloudflare');
      
      const sensor = haSensor.getSensor(entityId);
      expect(sensor).toBeDefined();
      expect(sensor!.attributes.friendly_name).toBe('DNS cloudflare');
      expect(sensor!.attributes.device_class).toBe('connectivity');
      expect(sensor!.attributes.icon).toBe('mdi:dns');
    });
  });

  describe('Sensor Updates with Formatter', () => {
    it('should update ping sensor using formatter', async () => {
      const target: PingTarget = {
        name: 'test-target',
        address: '8.8.8.8',
        interval: 60,
        enabled: true
      };

      const entityId = await haSensor.create_ping_sensor(target);

      const result: PingResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        target_name: 'test-target',
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

      await haSensor.updatePingSensor(entityId, result, sensorState);

      const sensor = haSensor.getSensor(entityId);
      expect(sensor).toBeDefined();
      expect(sensor!.state).toBe('25.5');
      expect(sensor!.attributes.status).toBe('online');
      expect(sensor!.attributes.response_time).toBe(25.5);
      expect(sensor!.attributes.packet_loss).toBe(0);
      expect(sensor!.attributes.success).toBe(true);
      expect(sensor!.attributes.available).toBe(true);
      expect(sensor!.attributes.monitoring_type).toBe('ping');
      expect(sensor!.attributes.performance_status).toBe('excellent');
      expect(sensor!.attributes.unit_of_measurement).toBe('ms');
      expect(sensor!.attributes.state_class).toBe('measurement');
    });

    it('should update DNS sensor using formatter', async () => {
      const target: DNSTarget = {
        name: 'test-dns',
        server_ip: '1.1.1.1',
        test_domains: ['example.com'],
        interval: 60,
        enabled: true
      };

      const entityId = await haSensor.create_dns_sensor(target);

      const result: DNSResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        server_name: 'test-dns',
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

      await haSensor.updateDNSSensor(entityId, result, sensorState);

      const sensor = haSensor.getSensor(entityId);
      expect(sensor).toBeDefined();
      expect(sensor!.state).toBe('15');
      expect(sensor!.attributes.status).toBe('available');
      expect(sensor!.attributes.response_time).toBe(15);
      expect(sensor!.attributes.success_rate).toBe(98.5);
      expect(sensor!.attributes.success).toBe(true);
      expect(sensor!.attributes.resolved_address).toBe('93.184.216.34');
      expect(sensor!.attributes.available).toBe(true);
      expect(sensor!.attributes.monitoring_type).toBe('dns');
      expect(sensor!.attributes.performance_status).toBe('excellent');
      expect(sensor!.attributes.unit_of_measurement).toBe('ms');
      expect(sensor!.attributes.state_class).toBe('measurement');
    });

    it('should handle failed ping sensor updates', async () => {
      const target: PingTarget = {
        name: 'failed-target',
        address: '192.168.1.999',
        interval: 60,
        enabled: true
      };

      const entityId = await haSensor.create_ping_sensor(target);

      const result: PingResult = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        target_name: 'failed-target',
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

      await haSensor.updatePingSensor(entityId, result, sensorState);

      const sensor = haSensor.getSensor(entityId);
      expect(sensor).toBeDefined();
      expect(sensor!.state).toBe('offline');
      expect(sensor!.attributes.status).toBe('offline');
      expect(sensor!.attributes.response_time).toBe(null);
      expect(sensor!.attributes.packet_loss).toBe(100);
      expect(sensor!.attributes.success).toBe(false);
      expect(sensor!.attributes.error_message).toBe('Host unreachable');
      expect(sensor!.attributes.performance_status).toBe('failed');
      // Note: unit_of_measurement and state_class remain from sensor creation
      // This is correct behavior as the sensor retains its configuration
    });
  });

  describe('Sensor Registration with Discovery', () => {
    it('should emit registration event with discovery config', async () => {
      const target: PingTarget = {
        name: 'test-ping',
        address: '8.8.8.8',
        interval: 60,
        enabled: true
      };

      await haSensor.create_ping_sensor(target);

      const registrationPromise = new Promise((resolve) => {
        haSensor.once('sensor_registration', resolve);
      });

      await haSensor.registerSensors();

      const registrationEvent = await registrationPromise as any;
      
      expect(registrationEvent).toHaveProperty('sensor');
      expect(registrationEvent).toHaveProperty('discoveryConfig');
      expect(registrationEvent.discoveryConfig).toHaveProperty('name');
      expect(registrationEvent.discoveryConfig).toHaveProperty('unique_id');
      expect(registrationEvent.discoveryConfig).toHaveProperty('device');
      expect(registrationEvent.discoveryConfig.device.identifiers).toEqual(['network_monitor']);
    });
  });

  describe('Sensor Attribute Validation', () => {
    it('should validate sensor attributes using formatter', () => {
      const validAttributes = {
        friendly_name: 'Test Sensor',
        device_class: 'connectivity',
        unit_of_measurement: 'ms',
        icon: 'mdi:network-outline',
        state_class: 'measurement' as const
      };

      const validation = haSensor.validateSensorAttributes(validAttributes);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid attributes using formatter', () => {
      const invalidAttributes = {
        friendly_name: 'Test Sensor',
        device_class: 'invalid_class',
        icon: 'invalid-icon'
      };

      const validation = haSensor.validateSensorAttributes(invalidAttributes);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Formatter Access', () => {
    it('should provide access to formatter instance', () => {
      const formatter = haSensor.getFormatter();
      expect(formatter).toBeDefined();
      expect(typeof formatter.formatPingSensorState).toBe('function');
      expect(typeof formatter.formatDNSSensorState).toBe('function');
    });
  });

  describe('Entity Name Sanitization', () => {
    it('should sanitize entity names properly', async () => {
      const target: PingTarget = {
        name: 'Test Target With Spaces & Special-Chars!',
        address: '8.8.8.8',
        interval: 60,
        enabled: true
      };

      const entityId = await haSensor.create_ping_sensor(target);
      expect(entityId).toBe('sensor.test_monitor_ping_test_target_with_spaces_special_chars');
    });
  });

  describe('Sensor Statistics', () => {
    it('should track sensor statistics correctly', async () => {
      const pingTarget: PingTarget = {
        name: 'ping-test',
        address: '8.8.8.8',
        interval: 60,
        enabled: true
      };

      const dnsTarget: DNSTarget = {
        name: 'dns-test',
        server_ip: '1.1.1.1',
        test_domains: ['example.com'],
        interval: 60,
        enabled: true
      };

      await haSensor.create_ping_sensor(pingTarget);
      await haSensor.create_dns_sensor(dnsTarget);

      const stats = haSensor.getStats();
      expect(stats.total).toBe(2);
      expect(stats.ping).toBe(1);
      expect(stats.dns).toBe(1);
    });
  });
});