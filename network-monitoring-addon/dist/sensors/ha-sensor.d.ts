/**
 * Home Assistant sensor component for network monitoring
 */
import { EventEmitter } from 'events';
import { SensorFormatter } from './sensor-formatter';
import { PingTarget, DNSTarget, PingResult, DNSResult, HomeAssistantSensor, PingSensorState, DNSSensorState, SensorAttributes } from '../types';
export interface HASensorConfig {
    homeAssistantUrl?: string | undefined;
    accessToken?: string | undefined;
    deviceName?: string | undefined;
}
export declare class HASensor extends EventEmitter {
    private logger;
    private config;
    private sensors;
    private deviceName;
    private formatter;
    constructor(config?: HASensorConfig);
    /**
     * Create a ping monitoring sensor for a target
     */
    create_ping_sensor(target: PingTarget): Promise<string>;
    /**
     * Create a DNS monitoring sensor for a server
     */
    create_dns_sensor(target: DNSTarget): Promise<string>;
    /**
     * Update sensor state with new monitoring data
     */
    update_sensor_state(sensorId: string, state: string | number, attributes: Record<string, any>): Promise<void>;
    /**
     * Update ping sensor with ping result
     */
    updatePingSensor(sensorId: string, result: PingResult, sensorState: PingSensorState): Promise<void>;
    /**
     * Update DNS sensor with DNS result
     */
    updateDNSSensor(sensorId: string, result: DNSResult, sensorState: DNSSensorState): Promise<void>;
    /**
     * Get sensor by entity ID
     */
    getSensor(entityId: string): HomeAssistantSensor | undefined;
    /**
     * Get all sensors
     */
    getAllSensors(): HomeAssistantSensor[];
    /**
     * Remove a sensor
     */
    removeSensor(entityId: string): Promise<boolean>;
    /**
     * Register sensors with Home Assistant (discovery)
     */
    registerSensors(): Promise<void>;
    /**
     * Register individual sensor with Home Assistant
     */
    private registerSensorWithHA;
    /**
     * Sanitize entity name for Home Assistant compatibility
     */
    private sanitizeEntityName;
    /**
     * Get sensor statistics
     */
    getStats(): {
        total: number;
        ping: number;
        dns: number;
    };
    /**
     * Validate sensor attributes using the formatter
     */
    validateSensorAttributes(attributes: SensorAttributes): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Get the sensor formatter instance
     */
    getFormatter(): SensorFormatter;
}
//# sourceMappingURL=ha-sensor.d.ts.map