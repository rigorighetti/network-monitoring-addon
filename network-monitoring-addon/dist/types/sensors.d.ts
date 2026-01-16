/**
 * Home Assistant sensor interfaces
 */
export interface PingSensorState {
    state: 'online' | 'offline' | 'degraded';
    response_time: number | null;
    packet_loss: number;
    last_success: Date;
    consecutive_failures: number;
}
export interface DNSSensorState {
    state: 'available' | 'unavailable' | 'slow';
    response_time: number | null;
    success_rate: number;
    last_success: Date;
    consecutive_failures: number;
}
export interface SensorAttributes {
    friendly_name: string;
    device_class?: string;
    unit_of_measurement?: string;
    icon?: string;
    state_class?: 'measurement' | 'total' | 'total_increasing';
    [key: string]: any;
}
export interface HomeAssistantSensor {
    entity_id: string;
    state: string | number;
    attributes: SensorAttributes;
    last_changed: Date;
    last_updated: Date;
}
export interface SensorUpdate {
    entity_id: string;
    state: string | number;
    attributes: Record<string, any>;
}
//# sourceMappingURL=sensors.d.ts.map