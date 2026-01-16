/**
 * Express.js API server for dashboard data
 * Provides REST endpoints for historical data retrieval and configuration management
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server as WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { DataStore, TimeRange } from '../storage/data-store';
import { ConfigManager } from '../config/config-manager';
import { Logger } from '../types';
import { 
  DashboardData, 
  PingTargetData, 
  DNSTargetData, 
  SystemStatus, 
  TimeSeriesData, 
  GraphConfig, 
  APIResponse 
} from '../types/dashboard';
import { NetworkMonitorConfig } from '../types/config';

export interface APIServerConfig {
  port: number;
  host: string;
  staticPath?: string;
  enableCors?: boolean;
}

export class APIServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer | null = null;
  private dataStore: DataStore;
  private configManager: ConfigManager;
  private logger: Logger;
  private config: APIServerConfig;
  private startTime: Date;

  constructor(
    dataStore: DataStore,
    configManager: ConfigManager,
    logger: Logger,
    config: APIServerConfig
  ) {
    this.app = express();
    this.dataStore = dataStore;
    this.configManager = configManager;
    this.logger = logger;
    this.config = config;
    this.startTime = new Date();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable CORS if configured
    if (this.config.enableCors) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
          return;
        }
        next();
      });
    }

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files for dashboard at root
    if (this.config.staticPath) {
      this.app.use(express.static(this.config.staticPath));
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.debug(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('API Error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      } as APIResponse);
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', this.handleHealthCheck.bind(this));

    // Dashboard data endpoints
    this.app.get('/api/dashboard', this.handleGetDashboardData.bind(this));
    this.app.get('/api/dashboard/ping/:targetName', this.handleGetPingData.bind(this));
    this.app.get('/api/dashboard/dns/:serverName', this.handleGetDnsData.bind(this));
    this.app.get('/api/dashboard/targets', this.handleGetTargets.bind(this));

    // Historical data endpoints
    this.app.get('/api/history/ping/:targetName', this.handleGetPingHistory.bind(this));
    this.app.get('/api/history/dns/:serverName', this.handleGetDnsHistory.bind(this));
    this.app.get('/api/history/aggregated/ping/:targetName', this.handleGetAggregatedPingData.bind(this));
    this.app.get('/api/history/aggregated/dns/:serverName', this.handleGetAggregatedDnsData.bind(this));
    this.app.get('/api/history/aggregated/dns/:serverName/:queryType', this.handleGetAggregatedDnsDataByType.bind(this));

    // Configuration endpoints
    this.app.get('/api/config', this.handleGetConfig.bind(this));
    this.app.post('/api/config', this.handleUpdateConfig.bind(this));
    this.app.post('/api/config/validate', this.handleValidateConfig.bind(this));
    this.app.post('/api/config/reset', this.handleResetConfig.bind(this));

    // System status endpoints
    this.app.get('/api/system/status', this.handleGetSystemStatus.bind(this));
    this.app.get('/api/system/stats', this.handleGetSystemStats.bind(this));

    // Root serves index.html
    // (handled by static middleware above)

    // 404 handler - only for API routes
    this.app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        timestamp: new Date()
      } as APIResponse);
    });
  }

  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      
      res.json({
        success: true,
        data: {
          status: 'healthy',
          uptime,
          timestamp: new Date(),
          version: '1.1.0'
        },
        timestamp: new Date()
      } as APIResponse);
    } catch (error) {
      this.logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const config = this.configManager.getCurrentConfig();
      if (!config) {
        throw new Error('No configuration loaded');
      }

      const targets = await this.dataStore.getAvailableTargets();
      const dashboardData: DashboardData = {
        ping_targets: [],
        dns_targets: [],
        system_status: await this.getSystemStatus(),
        last_updated: new Date()
      };

      // Get ping target data
      for (const targetName of targets.ping_targets) {
        const pingData = await this.getPingTargetData(targetName);
        if (pingData) {
          dashboardData.ping_targets.push(pingData);
        }
      }

      // Get DNS target data
      for (const serverName of targets.dns_servers) {
        const dnsData = await this.getDnsTargetData(serverName);
        if (dnsData) {
          dashboardData.dns_targets.push(dnsData);
        }
      }

      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date()
      } as APIResponse<DashboardData>);

    } catch (error) {
      this.logger.error('Failed to get dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard data',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetPingData(req: Request, res: Response): Promise<void> {
    try {
      const { targetName } = req.params;
      if (!targetName) {
        res.status(400).json({
          success: false,
          error: 'Target name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      const pingData = await this.getPingTargetData(targetName);
      
      if (!pingData) {
        res.status(404).json({
          success: false,
          error: 'Ping target not found',
          timestamp: new Date()
        } as APIResponse);
        return;
      }

      res.json({
        success: true,
        data: pingData,
        timestamp: new Date()
      } as APIResponse<PingTargetData>);

    } catch (error) {
      this.logger.error('Failed to get ping data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve ping data',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetDnsData(req: Request, res: Response): Promise<void> {
    try {
      const { serverName } = req.params;
      if (!serverName) {
        res.status(400).json({
          success: false,
          error: 'Server name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      const dnsData = await this.getDnsTargetData(serverName);
      
      if (!dnsData) {
        res.status(404).json({
          success: false,
          error: 'DNS server not found',
          timestamp: new Date()
        } as APIResponse);
        return;
      }

      res.json({
        success: true,
        data: dnsData,
        timestamp: new Date()
      } as APIResponse<DNSTargetData>);

    } catch (error) {
      this.logger.error('Failed to get DNS data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve DNS data',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetTargets(req: Request, res: Response): Promise<void> {
    try {
      const targets = await this.dataStore.getAvailableTargets();
      
      res.json({
        success: true,
        data: targets,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get targets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve targets',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetPingHistory(req: Request, res: Response): Promise<void> {
    try {
      const { targetName } = req.params;
      if (!targetName) {
        res.status(400).json({
          success: false,
          error: 'Target name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      const { start, end, limit } = req.query;

      const timeRange = this.parseTimeRange(start as string, end as string);
      const maxLimit = Math.min(parseInt(limit as string) || 1000, 10000);

      const history = await this.dataStore.getPingHistory(targetName, timeRange, maxLimit);

      res.json({
        success: true,
        data: history,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get ping history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve ping history',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetDnsHistory(req: Request, res: Response): Promise<void> {
    try {
      const { serverName } = req.params;
      if (!serverName) {
        res.status(400).json({
          success: false,
          error: 'Server name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      const { start, end, limit } = req.query;

      const timeRange = this.parseTimeRange(start as string, end as string);
      const maxLimit = Math.min(parseInt(limit as string) || 1000, 10000);

      const history = await this.dataStore.getDnsHistory(serverName, timeRange, maxLimit);

      res.json({
        success: true,
        data: history,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get DNS history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve DNS history',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetAggregatedPingData(req: Request, res: Response): Promise<void> {
    try {
      const { targetName } = req.params;
      if (!targetName) {
        res.status(400).json({
          success: false,
          error: 'Target name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      const { start, end, interval } = req.query;

      const timeRange = this.parseTimeRange(start as string, end as string);
      const intervalMinutes = Math.max(parseInt(interval as string) || 5, 1);

      const aggregatedData = await this.dataStore.getAggregatedPingData(
        targetName, 
        timeRange, 
        intervalMinutes
      );

      res.json({
        success: true,
        data: aggregatedData,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get aggregated ping data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve aggregated ping data',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetAggregatedDnsData(req: Request, res: Response): Promise<void> {
    try {
      const { serverName } = req.params;
      if (!serverName) {
        res.status(400).json({
          success: false,
          error: 'Server name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      const { start, end, interval } = req.query;

      const timeRange = this.parseTimeRange(start as string, end as string);
      const intervalMinutes = Math.max(parseInt(interval as string) || 5, 1);

      const aggregatedData = await this.dataStore.getAggregatedDnsData(
        serverName, 
        timeRange, 
        intervalMinutes
      );

      res.json({
        success: true,
        data: aggregatedData,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get aggregated DNS data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve aggregated DNS data',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetAggregatedDnsDataByType(req: Request, res: Response): Promise<void> {
    try {
      const { serverName, queryType } = req.params;
      if (!serverName) {
        res.status(400).json({
          success: false,
          error: 'Server name is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      if (!queryType) {
        res.status(400).json({
          success: false,
          error: 'Query type is required',
          timestamp: new Date()
        } as APIResponse);
        return;
      }
      
      // Validate query type
      const validTypes = ['A', 'AAAA', 'PTR'];
      if (!validTypes.includes(queryType.toUpperCase())) {
        res.status(400).json({
          success: false,
          error: 'Invalid query type. Must be A, AAAA, or PTR',
          timestamp: new Date()
        } as APIResponse);
        return;
      }

      const { start, end, interval } = req.query;

      const timeRange = this.parseTimeRange(start as string, end as string);
      const intervalMinutes = Math.max(parseInt(interval as string) || 5, 1);

      const aggregatedData = await this.dataStore.getAggregatedDnsDataByType(
        serverName,
        queryType.toUpperCase(),
        timeRange, 
        intervalMinutes
      );

      res.json({
        success: true,
        data: aggregatedData,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get aggregated DNS data by type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve aggregated DNS data by type',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = this.configManager.getCurrentConfig();
      
      if (!config) {
        throw new Error('No configuration loaded');
      }

      res.json({
        success: true,
        data: config,
        timestamp: new Date()
      } as APIResponse<NetworkMonitorConfig>);

    } catch (error) {
      this.logger.error('Failed to get configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve configuration',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleUpdateConfig(req: Request, res: Response): Promise<void> {
    try {
      const newConfig = req.body;
      
      // Validate the configuration
      const updatedConfig = await this.configManager.updateConfig(newConfig);

      res.json({
        success: true,
        data: updatedConfig,
        timestamp: new Date()
      } as APIResponse<NetworkMonitorConfig>);

    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      res.status(400).json({
        success: false,
        error: `Configuration update failed: ${error}`,
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleValidateConfig(req: Request, res: Response): Promise<void> {
    try {
      const configToValidate = req.body;
      
      // Validate without saving
      const validatedConfig = this.configManager.validateConfig(configToValidate);

      res.json({
        success: true,
        data: {
          valid: true,
          config: validatedConfig
        },
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      res.status(400).json({
        success: false,
        error: `Configuration validation failed: ${error}`,
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleResetConfig(req: Request, res: Response): Promise<void> {
    try {
      const defaultConfig = this.configManager.getDefaultConfig();
      const resetConfig = await this.configManager.updateConfig(defaultConfig);

      res.json({
        success: true,
        data: resetConfig,
        timestamp: new Date()
      } as APIResponse<NetworkMonitorConfig>);

    } catch (error) {
      this.logger.error('Failed to reset configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset configuration',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const systemStatus = await this.getSystemStatus();

      res.json({
        success: true,
        data: systemStatus,
        timestamp: new Date()
      } as APIResponse<SystemStatus>);

    } catch (error) {
      this.logger.error('Failed to get system status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system status',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private async handleGetSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.dataStore.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      } as APIResponse);

    } catch (error) {
      this.logger.error('Failed to get system stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system stats',
        timestamp: new Date()
      } as APIResponse);
    }
  }

  private parseTimeRange(start?: string, end?: string): TimeRange {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago

    return {
      start: start ? new Date(start) : defaultStart,
      end: end ? new Date(end) : now
    };
  }

  private async getPingTargetData(targetName: string, intervalMinutes: number = 15): Promise<PingTargetData | null> {
    try {
      const recentData = await this.dataStore.getRecentPingData(targetName, 60);
      
      if (recentData.length === 0) {
        return null;
      }

      const latest = recentData[0];
      if (!latest) {
        return null;
      }

      const timeRange = {
        start: new Date(Date.now() - (24 * 60 * 60 * 1000)), // 24 hours
        end: new Date()
      };

      const summary = await this.dataStore.getPingSummary(targetName, timeRange);
      // Use the provided interval parameter
      const history = await this.dataStore.getAggregatedPingData(targetName, timeRange, intervalMinutes);

      const timeSeriesData: TimeSeriesData[] = history.map(point => ({
        timestamp: point.timestamp,
        value: point.avg_response_time,
        min_value: point.min_response_time || undefined,
        max_value: point.max_response_time || undefined,
        avg_value: point.avg_response_time || undefined,
        packet_loss: point.total_count > 0 ? ((point.total_count - point.success_count) / point.total_count) * 100 : 0,
        success: point.success_rate > 0.5
      }));

      return {
        name: targetName,
        address: latest.target_address,
        current_status: this.determineStatus(latest.success, latest.response_time_ms, latest.packet_loss_percent),
        current_response_time: latest.response_time_ms,
        current_packet_loss: latest.packet_loss_percent,
        history: timeSeriesData,
        uptime_percentage: summary.success_rate * 100,
        last_success: latest.success ? latest.timestamp : new Date(0)
      };

    } catch (error) {
      this.logger.error(`Failed to get ping target data for ${targetName}:`, error);
      return null;
    }
  }

  private async getDnsTargetData(serverName: string): Promise<DNSTargetData | null> {
    try {
      const recentData = await this.dataStore.getRecentDnsData(serverName, 60);
      
      if (recentData.length === 0) {
        return null;
      }

      const latest = recentData[0];
      if (!latest) {
        return null;
      }

      const timeRange = {
        start: new Date(Date.now() - (24 * 60 * 60 * 1000)), // 24 hours
        end: new Date()
      };

      const summary = await this.dataStore.getDnsSummary(serverName, timeRange);
      // Use 15 minutes as default interval for dashboard overview
      const history = await this.dataStore.getAggregatedDnsData(serverName, timeRange, 15);

      const timeSeriesData: TimeSeriesData[] = history.map(point => ({
        timestamp: point.timestamp,
        value: point.avg_response_time,
        min_value: point.min_response_time || undefined,
        max_value: point.max_response_time || undefined,
        avg_value: point.avg_response_time || undefined,
        success: point.success_rate > 0.5
      }));

      // Get unique test domains from recent data
      const testDomains = [...new Set(recentData.map(d => d.domain))];

      return {
        name: serverName,
        server_ip: latest.server_ip,
        test_domains: testDomains,
        current_status: this.determineDnsStatus(latest.success, latest.response_time_ms),
        current_response_time: latest.response_time_ms,
        current_success_rate: summary.success_rate * 100,
        history: timeSeriesData,
        uptime_percentage: summary.success_rate * 100,
        last_success: latest.success ? latest.timestamp : new Date(0)
      };

    } catch (error) {
      this.logger.error(`Failed to get DNS target data for ${serverName}:`, error);
      return null;
    }
  }

  private async getSystemStatus(): Promise<SystemStatus> {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const targets = await this.dataStore.getAvailableTargets();
    const totalTargets = targets.ping_targets.length + targets.dns_servers.length;

    // For now, assume all targets are healthy (would need monitoring state in real implementation)
    const healthyTargets = totalTargets;
    const failedTargets = 0;

    return {
      addon_version: '1.1.0',
      uptime,
      total_targets: totalTargets,
      healthy_targets: healthyTargets,
      failed_targets: failedTargets,
      last_restart: this.startTime,
      memory_usage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpu_usage: process.cpuUsage().user / 1000000 // Convert to seconds
    };
  }

  private determineStatus(success: boolean, responseTime: number | null, packetLoss: number): 'online' | 'offline' | 'degraded' {
    if (!success) {
      return 'offline';
    }
    
    if (packetLoss > 5 || (responseTime && responseTime > 1000)) {
      return 'degraded';
    }
    
    return 'online';
  }

  private determineDnsStatus(success: boolean, responseTime: number | null): 'available' | 'unavailable' | 'slow' {
    if (!success) {
      return 'unavailable';
    }
    
    if (responseTime && responseTime > 500) {
      return 'slow';
    }
    
    return 'available';
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        
        // Setup WebSocket server for real-time updates
        this.wss = new WebSocketServer({ server: this.server });
        this.setupWebSocketHandlers();

        this.server.listen(this.config.port, this.config.host, () => {
          this.logger.info(`API server started on ${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('Server error:', error);
          reject(error);
        });

      } catch (error) {
        this.logger.error('Failed to start API server:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      if (this.server) {
        this.server.close(() => {
          this.logger.info('API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws) => {
      this.logger.debug('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.logger.debug('WebSocket client disconnected');
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date()
      }));
    });
  }

  private handleWebSocketMessage(ws: any, data: any): void {
    switch (data.type) {
      case 'subscribe':
        // Handle subscription to real-time updates
        this.logger.debug('Client subscribed to real-time updates');
        break;
      
      case 'unsubscribe':
        // Handle unsubscription
        this.logger.debug('Client unsubscribed from real-time updates');
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcastUpdate(data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'update',
      data,
      timestamp: new Date()
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  /**
   * Broadcast custom update to all connected clients
   */
  broadcastCustomUpdate(data: any): void {
    this.broadcastUpdate(data);
  }
}