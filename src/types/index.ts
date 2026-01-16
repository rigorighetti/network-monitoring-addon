/**
 * Main types export file for the Network Monitoring Add-on
 */

// Configuration types
export * from './config';

// Result types
export * from './results';

// Sensor types
export * from './sensors';

// Alert types
export * from './alerts';

// Dashboard types
export * from './dashboard';

// Import specific types for use in interfaces
import { MonitoringStatus } from './results';

// Common utility types
export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes: number }>;
  close(): Promise<void>;
}

export interface MonitoringEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  updateConfig(config: any): Promise<void>;
  getStatus(): Promise<MonitoringStatus>;
}

export interface ComponentHealth {
  component: string;
  healthy: boolean;
  last_check: Date;
  error_message?: string;
}