/**
 * Sensor data formatting utilities for Home Assistant integration
 */
import { PingResult, DNSResult, PingSensorState, DNSSensorState, SensorAttributes, HomeAssistantSensor } from '../types';
export declare class SensorFormatter {
    private logger;
    constructor();
    /**
     * Format ping sensor state for Home Assistant
     */
    formatPingSensorState(result: PingResult, sensorState: PingSensorState): {
        state: string;
        attributes: SensorAttributes;
    };
    /**
     * Format DNS sensor state for Home Assistant
     */
    formatDNSSensorState(result: DNSResult, sensorState: DNSSensorState): {
        state: string;
        attributes: SensorAttributes;
    };
    /**
     * Format sensor for Home Assistant discovery
     */
    formatSensorForDiscovery(sensor: HomeAssistantSensor): Record<string, any>;
    /**
     * Get appropriate icon for ping sensor state
     */
    private getPingIcon;
    /**
     * Get appropriate icon for DNS sensor state
     */
    private getDNSIcon;
    /**
     * Determine if ping sensor is available
     */
    private isPingSensorAvailable;
    /**
     * Determine if DNS sensor is available
     */
    private isDNSSensorAvailable;
    /**
     * Get performance status for ping sensor
     */
    private getPingPerformanceStatus;
    /**
     * Get performance status for DNS sensor
     */
    private getDNSPerformanceStatus;
    /**
     * Validate sensor attributes for Home Assistant compatibility
     */
    validateSensorAttributes(attributes: SensorAttributes): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Check if device class is valid for Home Assistant
     */
    private isValidDeviceClass;
    /**
     * Format sensor state value for Home Assistant
     */
    formatStateValue(value: any): string | number;
    /**
     * Create comprehensive sensor attributes with monitoring metrics
     */
    createComprehensiveAttributes(baseAttributes: SensorAttributes, additionalMetrics?: Record<string, any>): SensorAttributes;
}
//# sourceMappingURL=sensor-formatter.d.ts.map