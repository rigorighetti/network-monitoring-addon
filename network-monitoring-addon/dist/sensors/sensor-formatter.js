"use strict";
/**
 * Sensor data formatting utilities for Home Assistant integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensorFormatter = void 0;
const logger_1 = require("../utils/logger");
class SensorFormatter {
    constructor() {
        this.logger = new logger_1.Logger('SensorFormatter');
    }
    /**
     * Format ping sensor state for Home Assistant
     */
    formatPingSensorState(result, sensorState) {
        // Determine the primary state value - use response time if available, otherwise status string
        const state = result.success && result.response_time_ms !== null
            ? result.response_time_ms.toString()
            : sensorState.state;
        const attributes = {
            friendly_name: `Ping ${result.target_name}`,
            device_class: 'connectivity',
            icon: this.getPingIcon(sensorState.state),
            // Core monitoring metrics
            status: sensorState.state,
            response_time: result.response_time_ms,
            packet_loss: result.packet_loss_percent,
            success: result.success,
            // Target information
            target_name: result.target_name,
            target_address: result.target_address,
            // Status tracking
            last_success: sensorState.last_success.toISOString(),
            consecutive_failures: sensorState.consecutive_failures,
            // Timestamps
            last_updated: result.timestamp.toISOString(),
            // Availability tracking
            available: this.isPingSensorAvailable(sensorState),
            // Additional context
            monitoring_type: 'ping'
        };
        // Add optional properties only if they have values
        if (result.success) {
            attributes.unit_of_measurement = 'ms';
            attributes.state_class = 'measurement';
        }
        // Add error information if present
        if (result.error_message) {
            attributes.error_message = result.error_message;
            attributes.last_error = result.timestamp.toISOString();
        }
        // Add performance indicators
        attributes.performance_status = this.getPingPerformanceStatus(result, sensorState);
        return { state, attributes };
    }
    /**
     * Format DNS sensor state for Home Assistant
     */
    formatDNSSensorState(result, sensorState) {
        // Determine the primary state value - use response time if available, otherwise status string
        const state = result.success && result.response_time_ms !== null
            ? result.response_time_ms.toString()
            : sensorState.state;
        const attributes = {
            friendly_name: `DNS ${result.server_name}`,
            device_class: 'connectivity',
            icon: this.getDNSIcon(sensorState.state),
            // Core monitoring metrics
            status: sensorState.state,
            response_time: result.response_time_ms,
            success_rate: sensorState.success_rate,
            success: result.success,
            // DNS-specific information
            server_name: result.server_name,
            server_ip: result.server_ip,
            domain: result.domain,
            query_type: result.query_type,
            // Status tracking
            last_success: sensorState.last_success.toISOString(),
            consecutive_failures: sensorState.consecutive_failures,
            // Timestamps
            last_updated: result.timestamp.toISOString(),
            // Availability tracking
            available: this.isDNSSensorAvailable(sensorState),
            // Additional context
            monitoring_type: 'dns'
        };
        // Add optional properties only if they have values
        if (result.success) {
            attributes.unit_of_measurement = 'ms';
            attributes.state_class = 'measurement';
        }
        // Add resolved address if present
        if (result.resolved_address) {
            attributes.resolved_address = result.resolved_address;
        }
        // Add error information if present
        if (result.error_message) {
            attributes.error_message = result.error_message;
            attributes.last_error = result.timestamp.toISOString();
        }
        // Add performance indicators
        attributes.performance_status = this.getDNSPerformanceStatus(result, sensorState);
        return { state, attributes };
    }
    /**
     * Format sensor for Home Assistant discovery
     */
    formatSensorForDiscovery(sensor) {
        const config = {
            name: sensor.attributes.friendly_name,
            unique_id: sensor.entity_id,
            state_topic: `homeassistant/sensor/${sensor.entity_id}/state`,
            json_attributes_topic: `homeassistant/sensor/${sensor.entity_id}/attributes`,
            device_class: sensor.attributes.device_class,
            unit_of_measurement: sensor.attributes.unit_of_measurement,
            icon: sensor.attributes.icon,
            state_class: sensor.attributes.state_class,
            availability_topic: `homeassistant/sensor/${sensor.entity_id}/availability`,
            device: {
                identifiers: ['network_monitor'],
                name: 'Network Monitor',
                model: 'Home Assistant Add-on',
                manufacturer: 'Network Monitoring Add-on'
            }
        };
        // Remove undefined values
        return Object.fromEntries(Object.entries(config).filter(([_, value]) => value !== undefined));
    }
    /**
     * Get appropriate icon for ping sensor state
     */
    getPingIcon(state) {
        switch (state) {
            case 'online':
                return 'mdi:network-outline';
            case 'degraded':
                return 'mdi:network-strength-2';
            case 'offline':
                return 'mdi:network-off-outline';
            default:
                return 'mdi:network-outline';
        }
    }
    /**
     * Get appropriate icon for DNS sensor state
     */
    getDNSIcon(state) {
        switch (state) {
            case 'available':
                return 'mdi:dns';
            case 'slow':
                return 'mdi:dns-outline';
            case 'unavailable':
                return 'mdi:dns-off-outline';
            default:
                return 'mdi:dns';
        }
    }
    /**
     * Determine if ping sensor is available
     */
    isPingSensorAvailable(sensorState) {
        // Consider sensor available if it's not completely offline
        // or if it hasn't failed too many times consecutively
        return sensorState.state !== 'offline' || sensorState.consecutive_failures < 5;
    }
    /**
     * Determine if DNS sensor is available
     */
    isDNSSensorAvailable(sensorState) {
        // Consider sensor available if it's not completely unavailable
        // or if it hasn't failed too many times consecutively
        return sensorState.state !== 'unavailable' || sensorState.consecutive_failures < 5;
    }
    /**
     * Get performance status for ping sensor
     */
    getPingPerformanceStatus(result, sensorState) {
        if (!result.success) {
            return 'failed';
        }
        if (result.response_time_ms === null) {
            return 'unknown';
        }
        if (result.response_time_ms < 50) {
            return 'excellent';
        }
        else if (result.response_time_ms < 100) {
            return 'good';
        }
        else if (result.response_time_ms < 200) {
            return 'fair';
        }
        else {
            return 'poor';
        }
    }
    /**
     * Get performance status for DNS sensor
     */
    getDNSPerformanceStatus(result, sensorState) {
        if (!result.success) {
            return 'failed';
        }
        if (result.response_time_ms === null) {
            return 'unknown';
        }
        if (result.response_time_ms < 20) {
            return 'excellent';
        }
        else if (result.response_time_ms < 50) {
            return 'good';
        }
        else if (result.response_time_ms < 100) {
            return 'fair';
        }
        else {
            return 'poor';
        }
    }
    /**
     * Validate sensor attributes for Home Assistant compatibility
     */
    validateSensorAttributes(attributes) {
        const errors = [];
        // Check required fields
        if (!attributes.friendly_name) {
            errors.push('friendly_name is required');
        }
        // Validate friendly_name format
        if (attributes.friendly_name && typeof attributes.friendly_name !== 'string') {
            errors.push('friendly_name must be a string');
        }
        // Validate device_class if present
        if (attributes.device_class && !this.isValidDeviceClass(attributes.device_class)) {
            errors.push(`Invalid device_class: ${attributes.device_class}`);
        }
        // Validate state_class if present
        if (attributes.state_class && !['measurement', 'total', 'total_increasing'].includes(attributes.state_class)) {
            errors.push(`Invalid state_class: ${attributes.state_class}`);
        }
        // Validate icon format if present
        if (attributes.icon && !attributes.icon.startsWith('mdi:')) {
            errors.push('Icon must start with "mdi:"');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    /**
     * Check if device class is valid for Home Assistant
     */
    isValidDeviceClass(deviceClass) {
        const validDeviceClasses = [
            'connectivity', 'battery', 'humidity', 'temperature', 'pressure',
            'signal_strength', 'timestamp', 'power', 'energy', 'current',
            'voltage', 'frequency', 'power_factor', 'apparent_power',
            'reactive_power', 'gas', 'water', 'weight', 'volume',
            'distance', 'speed', 'duration', 'data_rate', 'data_size'
        ];
        return validDeviceClasses.includes(deviceClass);
    }
    /**
     * Format sensor state value for Home Assistant
     */
    formatStateValue(value) {
        if (value === null || value === undefined) {
            return 'unknown';
        }
        if (typeof value === 'number') {
            // Round to 2 decimal places for numeric values
            return Math.round(value * 100) / 100;
        }
        return String(value);
    }
    /**
     * Create comprehensive sensor attributes with monitoring metrics
     */
    createComprehensiveAttributes(baseAttributes, additionalMetrics = {}) {
        return {
            ...baseAttributes,
            ...additionalMetrics,
            // Add standard monitoring metadata
            addon_version: '1.1.0',
            last_formatted: new Date().toISOString(),
            // Ensure required fields are present
            friendly_name: baseAttributes.friendly_name || 'Unknown Sensor',
            available: baseAttributes.available !== undefined ? baseAttributes.available : true
        };
    }
}
exports.SensorFormatter = SensorFormatter;
//# sourceMappingURL=sensor-formatter.js.map