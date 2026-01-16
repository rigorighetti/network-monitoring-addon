"use strict";
/**
 * Real-time data streaming service for live dashboard updates
 * Manages WebSocket connections and broadcasts monitoring data updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const events_1 = require("events");
class RealtimeService extends events_1.EventEmitter {
    constructor(dataStore, apiServer, logger) {
        super();
        this.updateInterval = null;
        this.isRunning = false;
        this.dataStore = dataStore;
        this.apiServer = apiServer;
        this.logger = logger;
    }
    /**
     * Start the real-time service
     */
    start() {
        if (this.isRunning) {
            this.logger.warn('Real-time service already running');
            return;
        }
        this.logger.info('Starting real-time service...');
        this.isRunning = true;
        // Set up periodic updates every 30 seconds
        this.updateInterval = setInterval(() => {
            this.broadcastSystemUpdate();
        }, 30000);
        this.logger.info('Real-time service started');
    }
    /**
     * Stop the real-time service
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.logger.info('Stopping real-time service...');
        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.logger.info('Real-time service stopped');
    }
    /**
     * Handle new ping result and broadcast update
     */
    async handlePingResult(result) {
        if (!this.isRunning)
            return;
        try {
            // Get recent data for context
            const recentData = await this.dataStore.getRecentPingData(result.target_name, 5);
            const update = {
                type: 'ping',
                target: result.target_name,
                data: {
                    latest_result: result,
                    recent_results: recentData.slice(0, 10), // Last 10 results
                    current_status: this.determinePingStatus(result),
                    trend: this.calculatePingTrend(recentData)
                },
                timestamp: new Date()
            };
            this.broadcastUpdate(update);
            this.emit('pingUpdate', update);
        }
        catch (error) {
            this.logger.error('Failed to handle ping result for real-time update:', error);
        }
    }
    /**
     * Handle new DNS result and broadcast update
     */
    async handleDnsResult(result) {
        if (!this.isRunning)
            return;
        try {
            // Get recent data for context
            const recentData = await this.dataStore.getRecentDnsData(result.server_name, 5);
            const update = {
                type: 'dns',
                target: result.server_name,
                data: {
                    latest_result: result,
                    recent_results: recentData.slice(0, 10), // Last 10 results
                    current_status: this.determineDnsStatus(result),
                    trend: this.calculateDnsTrend(recentData)
                },
                timestamp: new Date()
            };
            this.broadcastUpdate(update);
            this.emit('dnsUpdate', update);
        }
        catch (error) {
            this.logger.error('Failed to handle DNS result for real-time update:', error);
        }
    }
    /**
     * Broadcast system-wide update
     */
    async broadcastSystemUpdate() {
        try {
            const targets = await this.dataStore.getAvailableTargets();
            const stats = await this.dataStore.getStats();
            const systemUpdate = {
                type: 'system',
                target: 'system',
                data: {
                    targets,
                    stats,
                    timestamp: new Date(),
                    uptime: process.uptime(),
                    memory_usage: process.memoryUsage()
                },
                timestamp: new Date()
            };
            this.broadcastUpdate(systemUpdate);
            this.emit('systemUpdate', systemUpdate);
        }
        catch (error) {
            this.logger.error('Failed to broadcast system update:', error);
        }
    }
    /**
     * Broadcast update to all connected WebSocket clients
     */
    broadcastUpdate(update) {
        try {
            this.apiServer.broadcastCustomUpdate(update);
        }
        catch (error) {
            this.logger.error('Failed to broadcast update:', error);
        }
    }
    /**
     * Determine ping status from result
     */
    determinePingStatus(result) {
        if (!result.success) {
            return 'offline';
        }
        if (result.packet_loss_percent > 5 || (result.response_time_ms && result.response_time_ms > 1000)) {
            return 'degraded';
        }
        return 'online';
    }
    /**
     * Determine DNS status from result
     */
    determineDnsStatus(result) {
        if (!result.success) {
            return 'unavailable';
        }
        if (result.response_time_ms && result.response_time_ms > 500) {
            return 'slow';
        }
        return 'available';
    }
    /**
     * Calculate ping trend from recent results
     */
    calculatePingTrend(recentData) {
        if (recentData.length < 3) {
            return 'stable';
        }
        const recent = recentData.slice(0, 3);
        const older = recentData.slice(3, 6);
        const recentAvg = this.calculateAverageResponseTime(recent);
        const olderAvg = this.calculateAverageResponseTime(older);
        if (recentAvg === null || olderAvg === null) {
            return 'stable';
        }
        const difference = recentAvg - olderAvg;
        const threshold = olderAvg * 0.1; // 10% threshold
        if (difference < -threshold) {
            return 'improving';
        }
        else if (difference > threshold) {
            return 'degrading';
        }
        else {
            return 'stable';
        }
    }
    /**
     * Calculate DNS trend from recent results
     */
    calculateDnsTrend(recentData) {
        if (recentData.length < 3) {
            return 'stable';
        }
        const recent = recentData.slice(0, 3);
        const older = recentData.slice(3, 6);
        const recentAvg = this.calculateAverageDnsResponseTime(recent);
        const olderAvg = this.calculateAverageDnsResponseTime(older);
        if (recentAvg === null || olderAvg === null) {
            return 'stable';
        }
        const difference = recentAvg - olderAvg;
        const threshold = olderAvg * 0.1; // 10% threshold
        if (difference < -threshold) {
            return 'improving';
        }
        else if (difference > threshold) {
            return 'degrading';
        }
        else {
            return 'stable';
        }
    }
    /**
     * Calculate average response time from ping results
     */
    calculateAverageResponseTime(results) {
        const validResults = results.filter(r => r.success && r.response_time_ms !== null);
        if (validResults.length === 0) {
            return null;
        }
        const sum = validResults.reduce((acc, r) => acc + (r.response_time_ms || 0), 0);
        return sum / validResults.length;
    }
    /**
     * Calculate average response time from DNS results
     */
    calculateAverageDnsResponseTime(results) {
        const validResults = results.filter(r => r.success && r.response_time_ms !== null);
        if (validResults.length === 0) {
            return null;
        }
        const sum = validResults.reduce((acc, r) => acc + (r.response_time_ms || 0), 0);
        return sum / validResults.length;
    }
    /**
     * Get current connection count
     */
    getConnectionCount() {
        // This would need to be implemented in the APIServer to track connections
        return 0; // Placeholder
    }
    /**
     * Send targeted update to specific clients
     */
    sendTargetedUpdate(targetName, update) {
        // This could be extended to send updates only to clients interested in specific targets
        this.broadcastUpdate(update);
    }
}
exports.RealtimeService = RealtimeService;
//# sourceMappingURL=realtime-service.js.map