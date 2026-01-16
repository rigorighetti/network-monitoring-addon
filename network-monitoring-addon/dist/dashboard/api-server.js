"use strict";
/**
 * Express.js API server for dashboard data
 * Provides REST endpoints for historical data retrieval and configuration management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIServer = void 0;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const http_1 = require("http");
class APIServer {
    constructor(dataStore, configManager, logger, config) {
        this.wss = null;
        this.app = (0, express_1.default)();
        this.dataStore = dataStore;
        this.configManager = configManager;
        this.logger = logger;
        this.config = config;
        this.startTime = new Date();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        // Enable CORS if configured
        if (this.config.enableCors) {
            this.app.use((req, res, next) => {
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
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Serve static files for dashboard at root
        if (this.config.staticPath) {
            this.app.use(express_1.default.static(this.config.staticPath));
        }
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.debug(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            this.logger.error('API Error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                timestamp: new Date()
            });
        });
    }
    setupRoutes() {
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
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'API endpoint not found',
                timestamp: new Date()
            });
        });
    }
    async handleHealthCheck(req, res) {
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
            });
        }
        catch (error) {
            this.logger.error('Health check failed:', error);
            res.status(500).json({
                success: false,
                error: 'Health check failed',
                timestamp: new Date()
            });
        }
    }
    async handleGetDashboardData(req, res) {
        try {
            const config = this.configManager.getCurrentConfig();
            if (!config) {
                throw new Error('No configuration loaded');
            }
            const targets = await this.dataStore.getAvailableTargets();
            const dashboardData = {
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
            });
        }
        catch (error) {
            this.logger.error('Failed to get dashboard data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve dashboard data',
                timestamp: new Date()
            });
        }
    }
    async handleGetPingData(req, res) {
        try {
            const { targetName } = req.params;
            if (!targetName) {
                res.status(400).json({
                    success: false,
                    error: 'Target name is required',
                    timestamp: new Date()
                });
                return;
            }
            const pingData = await this.getPingTargetData(targetName);
            if (!pingData) {
                res.status(404).json({
                    success: false,
                    error: 'Ping target not found',
                    timestamp: new Date()
                });
                return;
            }
            res.json({
                success: true,
                data: pingData,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get ping data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve ping data',
                timestamp: new Date()
            });
        }
    }
    async handleGetDnsData(req, res) {
        try {
            const { serverName } = req.params;
            if (!serverName) {
                res.status(400).json({
                    success: false,
                    error: 'Server name is required',
                    timestamp: new Date()
                });
                return;
            }
            const dnsData = await this.getDnsTargetData(serverName);
            if (!dnsData) {
                res.status(404).json({
                    success: false,
                    error: 'DNS server not found',
                    timestamp: new Date()
                });
                return;
            }
            res.json({
                success: true,
                data: dnsData,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get DNS data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve DNS data',
                timestamp: new Date()
            });
        }
    }
    async handleGetTargets(req, res) {
        try {
            const targets = await this.dataStore.getAvailableTargets();
            res.json({
                success: true,
                data: targets,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get targets:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve targets',
                timestamp: new Date()
            });
        }
    }
    async handleGetPingHistory(req, res) {
        try {
            const { targetName } = req.params;
            if (!targetName) {
                res.status(400).json({
                    success: false,
                    error: 'Target name is required',
                    timestamp: new Date()
                });
                return;
            }
            const { start, end, limit } = req.query;
            const timeRange = this.parseTimeRange(start, end);
            const maxLimit = Math.min(parseInt(limit) || 1000, 10000);
            const history = await this.dataStore.getPingHistory(targetName, timeRange, maxLimit);
            res.json({
                success: true,
                data: history,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get ping history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve ping history',
                timestamp: new Date()
            });
        }
    }
    async handleGetDnsHistory(req, res) {
        try {
            const { serverName } = req.params;
            if (!serverName) {
                res.status(400).json({
                    success: false,
                    error: 'Server name is required',
                    timestamp: new Date()
                });
                return;
            }
            const { start, end, limit } = req.query;
            const timeRange = this.parseTimeRange(start, end);
            const maxLimit = Math.min(parseInt(limit) || 1000, 10000);
            const history = await this.dataStore.getDnsHistory(serverName, timeRange, maxLimit);
            res.json({
                success: true,
                data: history,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get DNS history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve DNS history',
                timestamp: new Date()
            });
        }
    }
    async handleGetAggregatedPingData(req, res) {
        try {
            const { targetName } = req.params;
            if (!targetName) {
                res.status(400).json({
                    success: false,
                    error: 'Target name is required',
                    timestamp: new Date()
                });
                return;
            }
            const { start, end, interval } = req.query;
            const timeRange = this.parseTimeRange(start, end);
            const intervalMinutes = Math.max(parseInt(interval) || 5, 1);
            const aggregatedData = await this.dataStore.getAggregatedPingData(targetName, timeRange, intervalMinutes);
            res.json({
                success: true,
                data: aggregatedData,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get aggregated ping data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve aggregated ping data',
                timestamp: new Date()
            });
        }
    }
    async handleGetAggregatedDnsData(req, res) {
        try {
            const { serverName } = req.params;
            if (!serverName) {
                res.status(400).json({
                    success: false,
                    error: 'Server name is required',
                    timestamp: new Date()
                });
                return;
            }
            const { start, end, interval } = req.query;
            const timeRange = this.parseTimeRange(start, end);
            const intervalMinutes = Math.max(parseInt(interval) || 5, 1);
            const aggregatedData = await this.dataStore.getAggregatedDnsData(serverName, timeRange, intervalMinutes);
            res.json({
                success: true,
                data: aggregatedData,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get aggregated DNS data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve aggregated DNS data',
                timestamp: new Date()
            });
        }
    }
    async handleGetAggregatedDnsDataByType(req, res) {
        try {
            const { serverName, queryType } = req.params;
            if (!serverName) {
                res.status(400).json({
                    success: false,
                    error: 'Server name is required',
                    timestamp: new Date()
                });
                return;
            }
            if (!queryType) {
                res.status(400).json({
                    success: false,
                    error: 'Query type is required',
                    timestamp: new Date()
                });
                return;
            }
            // Validate query type
            const validTypes = ['A', 'AAAA', 'PTR'];
            if (!validTypes.includes(queryType.toUpperCase())) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query type. Must be A, AAAA, or PTR',
                    timestamp: new Date()
                });
                return;
            }
            const { start, end, interval } = req.query;
            const timeRange = this.parseTimeRange(start, end);
            const intervalMinutes = Math.max(parseInt(interval) || 5, 1);
            const aggregatedData = await this.dataStore.getAggregatedDnsDataByType(serverName, queryType.toUpperCase(), timeRange, intervalMinutes);
            res.json({
                success: true,
                data: aggregatedData,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get aggregated DNS data by type:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve aggregated DNS data by type',
                timestamp: new Date()
            });
        }
    }
    async handleGetConfig(req, res) {
        try {
            const config = this.configManager.getCurrentConfig();
            if (!config) {
                throw new Error('No configuration loaded');
            }
            res.json({
                success: true,
                data: config,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get configuration:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve configuration',
                timestamp: new Date()
            });
        }
    }
    async handleUpdateConfig(req, res) {
        try {
            const newConfig = req.body;
            // Validate the configuration
            const updatedConfig = await this.configManager.updateConfig(newConfig);
            res.json({
                success: true,
                data: updatedConfig,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to update configuration:', error);
            res.status(400).json({
                success: false,
                error: `Configuration update failed: ${error}`,
                timestamp: new Date()
            });
        }
    }
    async handleValidateConfig(req, res) {
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
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: `Configuration validation failed: ${error}`,
                timestamp: new Date()
            });
        }
    }
    async handleResetConfig(req, res) {
        try {
            const defaultConfig = this.configManager.getDefaultConfig();
            const resetConfig = await this.configManager.updateConfig(defaultConfig);
            res.json({
                success: true,
                data: resetConfig,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to reset configuration:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset configuration',
                timestamp: new Date()
            });
        }
    }
    async handleGetSystemStatus(req, res) {
        try {
            const systemStatus = await this.getSystemStatus();
            res.json({
                success: true,
                data: systemStatus,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get system status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve system status',
                timestamp: new Date()
            });
        }
    }
    async handleGetSystemStats(req, res) {
        try {
            const stats = await this.dataStore.getStats();
            res.json({
                success: true,
                data: stats,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to get system stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve system stats',
                timestamp: new Date()
            });
        }
    }
    parseTimeRange(start, end) {
        const now = new Date();
        const defaultStart = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
        return {
            start: start ? new Date(start) : defaultStart,
            end: end ? new Date(end) : now
        };
    }
    async getPingTargetData(targetName, intervalMinutes = 15) {
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
            const timeSeriesData = history.map(point => ({
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
        }
        catch (error) {
            this.logger.error(`Failed to get ping target data for ${targetName}:`, error);
            return null;
        }
    }
    async getDnsTargetData(serverName) {
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
            const timeSeriesData = history.map(point => ({
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
        }
        catch (error) {
            this.logger.error(`Failed to get DNS target data for ${serverName}:`, error);
            return null;
        }
    }
    async getSystemStatus() {
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
    determineStatus(success, responseTime, packetLoss) {
        if (!success) {
            return 'offline';
        }
        if (packetLoss > 5 || (responseTime && responseTime > 1000)) {
            return 'degraded';
        }
        return 'online';
    }
    determineDnsStatus(success, responseTime) {
        if (!success) {
            return 'unavailable';
        }
        if (responseTime && responseTime > 500) {
            return 'slow';
        }
        return 'available';
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = (0, http_1.createServer)(this.app);
                // Setup WebSocket server for real-time updates
                this.wss = new ws_1.Server({ server: this.server });
                this.setupWebSocketHandlers();
                this.server.listen(this.config.port, this.config.host, () => {
                    this.logger.info(`API server started on ${this.config.host}:${this.config.port}`);
                    resolve();
                });
                this.server.on('error', (error) => {
                    this.logger.error('Server error:', error);
                    reject(error);
                });
            }
            catch (error) {
                this.logger.error('Failed to start API server:', error);
                reject(error);
            }
        });
    }
    async stop() {
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
            }
            else {
                resolve();
            }
        });
    }
    setupWebSocketHandlers() {
        if (!this.wss)
            return;
        this.wss.on('connection', (ws) => {
            this.logger.debug('WebSocket client connected');
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleWebSocketMessage(ws, data);
                }
                catch (error) {
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
    handleWebSocketMessage(ws, data) {
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
    broadcastUpdate(data) {
        if (!this.wss)
            return;
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
    broadcastCustomUpdate(data) {
        this.broadcastUpdate(data);
    }
}
exports.APIServer = APIServer;
//# sourceMappingURL=api-server.js.map