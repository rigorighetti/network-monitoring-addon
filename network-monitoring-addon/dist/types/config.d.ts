/**
 * Configuration interfaces for the Network Monitoring Add-on
 */
export interface PingTarget {
    name: string;
    address: string;
    interval: number;
    enabled: boolean;
}
export interface DNSTarget {
    name: string;
    server_ip: string;
    test_domains: string[];
    interval: number;
    enabled: boolean;
}
export interface AlertThresholds {
    ping_timeout_ms: number;
    ping_loss_percent: number;
    dns_timeout_ms: number;
    consecutive_failures: number;
}
export interface NetworkMonitorConfig {
    ping_targets: PingTarget[];
    dns_targets: DNSTarget[];
    alert_thresholds: AlertThresholds;
    data_retention_days: number;
}
export interface HomeAssistantConfig {
    token: string;
    url: string;
}
export interface AddOnOptions extends NetworkMonitorConfig {
    log_level?: 'debug' | 'info' | 'warn' | 'error';
}
//# sourceMappingURL=config.d.ts.map