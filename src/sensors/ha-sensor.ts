/**
 * Home Assistant sensor component for network monitoring
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { SensorFormatter } from './sensor-formatter';
import { 
  PingTarget, 
  DNSTarget, 
  PingResult, 
  DNSResult,
  HomeAssistantSensor,
  PingSensorState,
  DNSSensorState,
  SensorUpdate,
  SensorAttributes
} from '../types';

export interface HASensorConfig {
  homeAssistantUrl?: string | undefined;
  accessToken?: string | undefined;
  deviceName?: string | undefined;
}

export class HASensor extends EventEmitter {
  private logger: Logger;
  private config: HASensorConfig;
  private sensors: Map<string, HomeAssistantSensor> = new Map();
  private deviceName: string;
  private formatter: SensorFormatter;

  constructor(config: HASensorConfig = {}) {
    super();
    this.logger = new Logger('HASensor');
    this.config = config;
    this.deviceName = config.deviceName || 'network_monitor';
    this.formatter = new SensorFormatter();
  }

  /**
   * Create a ping monitoring sensor for a target
   */
  async create_ping_sensor(target: PingTarget): Promise<string> {
    const entityId = `sensor.${this.deviceName}_ping_${this.sanitizeEntityName(target.name)}`;
    
    const sensor: HomeAssistantSensor = {
      entity_id: entityId,
      state: 'unknown',
      attributes: {
        friendly_name: `Ping ${target.name}`,
        device_class: 'connectivity',
        icon: 'mdi:network-outline',
        target_address: target.address,
        target_name: target.name,
        interval: target.interval,
        unit_of_measurement: 'ms',
        state_class: 'measurement'
      },
      last_changed: new Date(),
      last_updated: new Date()
    };

    this.sensors.set(entityId, sensor);
    this.logger.info(`Created ping sensor: ${entityId} for target ${target.name}`);
    
    // Emit sensor creation event
    this.emit('sensor_created', { type: 'ping', entity_id: entityId, target });
    
    return entityId;
  }

  /**
   * Create a DNS monitoring sensor for a server
   */
  async create_dns_sensor(target: DNSTarget): Promise<string> {
    const entityId = `sensor.${this.deviceName}_dns_${this.sanitizeEntityName(target.name)}`;
    
    const sensor: HomeAssistantSensor = {
      entity_id: entityId,
      state: 'unknown',
      attributes: {
        friendly_name: `DNS ${target.name}`,
        device_class: 'connectivity',
        icon: 'mdi:dns',
        server_ip: target.server_ip,
        server_name: target.name,
        test_domains: target.test_domains,
        interval: target.interval,
        unit_of_measurement: 'ms',
        state_class: 'measurement'
      },
      last_changed: new Date(),
      last_updated: new Date()
    };

    this.sensors.set(entityId, sensor);
    this.logger.info(`Created DNS sensor: ${entityId} for server ${target.name}`);
    
    // Emit sensor creation event
    this.emit('sensor_created', { type: 'dns', entity_id: entityId, target });
    
    return entityId;
  }

  /**
   * Update sensor state with new monitoring data
   */
  async update_sensor_state(sensorId: string, state: string | number, attributes: Record<string, any>): Promise<void> {
    const sensor = this.sensors.get(sensorId);
    if (!sensor) {
      this.logger.warn(`Sensor ${sensorId} not found`);
      return;
    }

    const previousState = sensor.state;
    const now = new Date();

    // Update sensor
    sensor.state = state;
    sensor.attributes = { ...sensor.attributes, ...attributes };
    sensor.last_updated = now;
    
    // Update last_changed only if state actually changed
    if (previousState !== state) {
      sensor.last_changed = now;
    }

    this.sensors.set(sensorId, sensor);
    
    // Create sensor update event
    const update: SensorUpdate = {
      entity_id: sensorId,
      state,
      attributes
    };

    this.logger.debug(`Updated sensor ${sensorId}: ${previousState} -> ${state}`);
    
    // Emit sensor update event
    this.emit('sensor_updated', update);
  }

  /**
   * Update ping sensor with ping result
   */
  async updatePingSensor(sensorId: string, result: PingResult, sensorState: PingSensorState): Promise<void> {
    const formatted = this.formatter.formatPingSensorState(result, sensorState);
    await this.update_sensor_state(sensorId, formatted.state, formatted.attributes);
  }

  /**
   * Update DNS sensor with DNS result
   */
  async updateDNSSensor(sensorId: string, result: DNSResult, sensorState: DNSSensorState): Promise<void> {
    const formatted = this.formatter.formatDNSSensorState(result, sensorState);
    await this.update_sensor_state(sensorId, formatted.state, formatted.attributes);
  }

  /**
   * Get sensor by entity ID
   */
  getSensor(entityId: string): HomeAssistantSensor | undefined {
    return this.sensors.get(entityId);
  }

  /**
   * Get all sensors
   */
  getAllSensors(): HomeAssistantSensor[] {
    return Array.from(this.sensors.values());
  }

  /**
   * Remove a sensor
   */
  async removeSensor(entityId: string): Promise<boolean> {
    const removed = this.sensors.delete(entityId);
    if (removed) {
      this.logger.info(`Removed sensor: ${entityId}`);
      this.emit('sensor_removed', { entity_id: entityId });
    }
    return removed;
  }

  /**
   * Register sensors with Home Assistant (discovery)
   */
  async registerSensors(): Promise<void> {
    this.logger.info('Registering sensors with Home Assistant...');
    
    for (const sensor of this.sensors.values()) {
      try {
        await this.registerSensorWithHA(sensor);
      } catch (error) {
        this.logger.error(`Failed to register sensor ${sensor.entity_id}:`, error);
      }
    }
    
    this.logger.info(`Registered ${this.sensors.size} sensors with Home Assistant`);
  }

  /**
   * Register individual sensor with Home Assistant
   */
  private async registerSensorWithHA(sensor: HomeAssistantSensor): Promise<void> {
    // In a real implementation, this would make HTTP calls to Home Assistant's API
    // For now, we'll just log the registration
    this.logger.debug(`Registering sensor with HA: ${sensor.entity_id}`);
    
    // Format sensor for Home Assistant discovery
    const discoveryConfig = this.formatter.formatSensorForDiscovery(sensor);
    
    // Emit registration event for external handling with discovery config
    this.emit('sensor_registration', { sensor, discoveryConfig });
  }

  /**
   * Sanitize entity name for Home Assistant compatibility
   */
  private sanitizeEntityName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Get sensor statistics
   */
  getStats(): { total: number; ping: number; dns: number } {
    let ping = 0;
    let dns = 0;

    for (const sensor of this.sensors.values()) {
      if (sensor.entity_id.includes('_ping_')) {
        ping++;
      } else if (sensor.entity_id.includes('_dns_')) {
        dns++;
      }
    }

    return {
      total: this.sensors.size,
      ping,
      dns
    };
  }

  /**
   * Validate sensor attributes using the formatter
   */
  validateSensorAttributes(attributes: SensorAttributes): { valid: boolean; errors: string[] } {
    return this.formatter.validateSensorAttributes(attributes);
  }

  /**
   * Get the sensor formatter instance
   */
  getFormatter(): SensorFormatter {
    return this.formatter;
  }
}