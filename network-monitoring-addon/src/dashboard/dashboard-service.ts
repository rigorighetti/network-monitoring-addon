/**
 * Dashboard service integration
 * Coordinates API server, real-time service, and static file serving
 */

import path from 'path';
import { APIServer, APIServerConfig } from './api-server';
import { RealtimeService } from './realtime-service';
import { DataStore } from '../storage/data-store';
import { ConfigManager } from '../config/config-manager';
import { Logger } from '../types';
import { PingResult, DNSResult } from '../types/results';

export interface DashboardServiceConfig {
  port: number;
  host: string;
  enableCors: boolean;
  staticPath?: string;
}

export class DashboardService {
  private apiServer: APIServer;
  private realtimeService: RealtimeService;
  private dataStore: DataStore;
  private configManager: ConfigManager;
  private logger: Logger;
  private config: DashboardServiceConfig;
  private isRunning: boolean = false;

  constructor(
    dataStore: DataStore,
    configManager: ConfigManager,
    logger: Logger,
    config: DashboardServiceConfig
  ) {
    this.dataStore = dataStore;
    this.configManager = configManager;
    this.logger = logger;
    this.config = config;

    // Set up static path if not provided
    if (!this.config.staticPath) {
      this.config.staticPath = path.join(__dirname, 'static');
    }

    // Create API server
    const apiConfig: APIServerConfig = {
      port: this.config.port,
      host: this.config.host,
      staticPath: this.config.staticPath,
      enableCors: this.config.enableCors
    };

    this.apiServer = new APIServer(
      this.dataStore,
      this.configManager,
      this.logger,
      apiConfig
    );

    // Create real-time service
    this.realtimeService = new RealtimeService(
      this.dataStore,
      this.apiServer,
      this.logger
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for configuration changes
    this.configManager.on('configChanged', (newConfig) => {
      this.logger.info('Configuration changed, notifying clients');
      this.apiServer.broadcastCustomUpdate({
        type: 'system',
        target: 'config',
        data: {
          type: 'config_changed',
          config: newConfig
        },
        timestamp: new Date()
      });
    });

    // Listen for real-time service events
    this.realtimeService.on('pingUpdate', (update) => {
      this.logger.debug(`Ping update for ${update.target}`);
    });

    this.realtimeService.on('dnsUpdate', (update) => {
      this.logger.debug(`DNS update for ${update.target}`);
    });

    this.realtimeService.on('systemUpdate', (update) => {
      this.logger.debug('System update broadcasted');
    });
  }

  /**
   * Start the dashboard service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Dashboard service already running');
      return;
    }

    try {
      this.logger.info('Starting dashboard service...');

      // Start API server
      await this.apiServer.start();

      // Start real-time service
      this.realtimeService.start();

      this.isRunning = true;
      this.logger.info(`Dashboard service started on http://${this.config.host}:${this.config.port}`);

    } catch (error) {
      this.logger.error('Failed to start dashboard service:', error);
      throw error;
    }
  }

  /**
   * Stop the dashboard service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.info('Stopping dashboard service...');

      // Stop real-time service
      this.realtimeService.stop();

      // Stop API server
      await this.apiServer.stop();

      this.isRunning = false;
      this.logger.info('Dashboard service stopped');

    } catch (error) {
      this.logger.error('Error stopping dashboard service:', error);
      throw error;
    }
  }

  /**
   * Handle new ping result for real-time updates
   */
  async handlePingResult(result: PingResult): Promise<void> {
    if (this.isRunning) {
      await this.realtimeService.handlePingResult(result);
    }
  }

  /**
   * Handle new DNS result for real-time updates
   */
  async handleDnsResult(result: DNSResult): Promise<void> {
    if (this.isRunning) {
      await this.realtimeService.handleDnsResult(result);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    port: number;
    host: string;
    connections: number;
  } {
    return {
      running: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      connections: this.realtimeService.getConnectionCount()
    };
  }

  /**
   * Get dashboard URL
   */
  getDashboardUrl(): string {
    const protocol = this.config.host === 'localhost' ? 'http' : 'https';
    return `${protocol}://${this.config.host}:${this.config.port}/dashboard`;
  }

  /**
   * Get API base URL
   */
  getApiUrl(): string {
    const protocol = this.config.host === 'localhost' ? 'http' : 'https';
    return `${protocol}://${this.config.host}:${this.config.port}/api`;
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcastUpdate(data: any): void {
    if (this.isRunning) {
      this.apiServer.broadcastCustomUpdate(data);
    }
  }

  /**
   * Check if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isRunning) {
        return false;
      }

      // Basic health checks
      const status = this.getStatus();
      return status.running;

    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }
}