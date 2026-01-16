/**
 * Dashboard and API interfaces
 */

export interface DashboardData {
  ping_targets: PingTargetData[];
  dns_targets: DNSTargetData[];
  system_status: SystemStatus;
  last_updated: Date;
}

export interface PingTargetData {
  name: string;
  address: string;
  current_status: 'online' | 'offline' | 'degraded';
  current_response_time: number | null;
  current_packet_loss: number;
  history: TimeSeriesData[];
  uptime_percentage: number;
  last_success: Date;
}

export interface DNSTargetData {
  name: string;
  server_ip: string;
  test_domains: string[];
  current_status: 'available' | 'unavailable' | 'slow';
  current_response_time: number | null;
  current_success_rate: number;
  history: TimeSeriesData[];
  uptime_percentage: number;
  last_success: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number | null;
  min_value?: number | undefined;
  max_value?: number | undefined;
  avg_value?: number | undefined;
  packet_loss?: number;
  success: boolean;
}

export interface SystemStatus {
  addon_version: string;
  uptime: number; // seconds
  total_targets: number;
  healthy_targets: number;
  failed_targets: number;
  last_restart: Date;
  memory_usage?: number;
  cpu_usage?: number;
}

export interface GraphConfig {
  time_range: '1h' | '6h' | '24h' | '7d' | '30d';
  show_min_max: boolean;
  show_packet_loss: boolean;
  show_events: boolean;
  auto_refresh: boolean;
  refresh_interval: number; // seconds
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}