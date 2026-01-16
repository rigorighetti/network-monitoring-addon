/**
 * Alert and notification interfaces
 */

export interface Alert {
  id: string;
  type: 'connectivity' | 'dns' | 'performance' | 'recovery';
  severity: 'info' | 'warning' | 'error' | 'critical';
  target_name: string;
  target_type: 'ping' | 'dns';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  target_type: 'ping' | 'dns';
  condition: AlertCondition;
  threshold_value: number;
  consecutive_failures: number;
  enabled: boolean;
}

export interface AlertCondition {
  metric: 'response_time' | 'packet_loss' | 'success_rate' | 'availability';
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  value: number;
}

export interface NotificationConfig {
  service: string; // Home Assistant notification service
  title_template: string;
  message_template: string;
  enabled: boolean;
}

export interface AlertManagerState {
  active_alerts: Alert[];
  alert_rules: AlertRule[];
  notification_configs: NotificationConfig[];
  last_check: Date;
}