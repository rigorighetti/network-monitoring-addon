/**
 * Result interfaces for monitoring operations
 */
export interface PingResult {
    timestamp: Date;
    target_name: string;
    target_address: string;
    response_time_ms: number | null;
    packet_loss_percent: number;
    success: boolean;
    error_message?: string;
}
export interface DNSResult {
    timestamp: Date;
    server_name: string;
    server_ip: string;
    domain: string;
    query_type: string;
    response_time_ms: number | null;
    success: boolean;
    resolved_address?: string;
    error_message?: string;
}
export interface MonitoringStatus {
    target_name: string;
    target_type: 'ping' | 'dns';
    status: 'online' | 'offline' | 'degraded' | 'available' | 'unavailable' | 'slow';
    last_success: Date;
    consecutive_failures: number;
    current_response_time?: number;
    current_packet_loss?: number;
    current_success_rate?: number;
}
//# sourceMappingURL=results.d.ts.map