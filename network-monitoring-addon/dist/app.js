"use strict";
/**
 * Main application class for the Network Monitoring Add-on
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkMonitorApp = void 0;
const path_1 = __importDefault(require("path"));
const logger_1 = require("./utils/logger");
const config_manager_1 = require("./config/config-manager");
const data_store_1 = require("./storage/data-store");
const coordinated_monitor_1 = require("./monitoring/coordinated-monitor");
const ha_sensor_1 = require("./sensors/ha-sensor");
const alert_manager_1 = require("./alerts/alert-manager");
const api_server_1 = require("./dashboard/api-server");
const error_handling_1 = require("./error-handling");
class NetworkMonitorApp {
    constructor() {
        this.dataStore = null;
        this.monitor = null;
        this.haSensor = null;
        this.alertManager = null;
        this.apiServer = null;
        this.config = null;
        this.isRunning = false;
        this.isInitialized = false;
        this.cleanupInterval = null;
        this.logger = new logger_1.Logger('NetworkMonitorApp');
        this.configManager = new config_manager_1.ConfigManager();
        this.errorHandler = new error_handling_1.ErrorHandler();
    }
    /**
     * Initialize all components
     */
    async initialize() {
        if (this.isInitialized) {
            this.logger.warn('App is already initialized');
            return;
        }
        this.logger.info('Initializing Network Monitor App...');
        try {
            // Load configuration
            this.config = await this.configManager.loadConfig();
            this.logger.info('Configuration loaded successfully');
            // Initialize data store
            const dataDir = process.env.DATA_PATH || '/data';
            this.dataStore = new data_store_1.DataStore(this.logger, dataDir, this.config.data_retention_days);
            await this.dataStore.initialize();
            this.logger.info('Data store initialized');
            // Initialize Home Assistant sensors
            this.haSensor = new ha_sensor_1.HASensor({
                homeAssistantUrl: process.env.HOMEASSISTANT_URL || undefined,
                accessToken: process.env.HASSIO_TOKEN || undefined,
                deviceName: 'network_monitor'
            });
            this.logger.info('Home Assistant sensor component initialized');
            // Initialize alert manager
            this.alertManager = new alert_manager_1.AlertManager(this.config.alert_thresholds);
            this.logger.info('Alert manager initialized');
            // Initialize coordinated monitor
            this.monitor = new coordinated_monitor_1.CoordinatedMonitor({
                errorHandler: this.errorHandler
            });
            this.logger.info('Coordinated monitor initialized');
            // Initialize API server
            const staticPath = path_1.default.join(__dirname, 'dashboard', 'static');
            this.apiServer = new api_server_1.APIServer(this.dataStore, this.configManager, this.logger, {
                port: parseInt(process.env.PORT || '8080'),
                host: '0.0.0.0',
                staticPath,
                enableCors: true
            });
            this.logger.info('API server initialized');
            // Set up event handlers
            this.setupEventHandlers();
            // Create sensors for configured targets
            await this.createSensorsForTargets();
            this.isInitialized = true;
            this.logger.info('App initialization completed successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize app:', error);
            throw error;
        }
    }
    /**
     * Set up event handlers for component integration
     */
    setupEventHandlers() {
        if (!this.monitor || !this.dataStore || !this.haSensor || !this.alertManager || !this.apiServer) {
            throw new Error('Components not initialized');
        }
        // Handle ping results
        this.monitor.on('ping:result', async (result) => {
            try {
                // Store result
                await this.dataStore.storePingResult(result);
                // Update sensor
                const sensorId = `sensor.network_monitor_ping_${this.sanitizeName(result.target_name)}`;
                const sensorState = {
                    state: result.success ? 'online' : 'offline',
                    response_time: result.response_time_ms,
                    packet_loss: result.packet_loss_percent,
                    last_success: result.success ? result.timestamp : new Date(0),
                    consecutive_failures: 0 // Would be tracked by state manager
                };
                await this.haSensor.updatePingSensor(sensorId, result, sensorState);
                // Check for alerts (simplified - would use alert manager methods)
                // await this.alertManager!.checkPingResult(result);
                // Broadcast to dashboard
                this.apiServer.broadcastUpdate({
                    type: 'ping',
                    result
                });
            }
            catch (error) {
                this.logger.error('Error handling ping result:', error);
            }
        });
        // Handle DNS results
        this.monitor.on('dns:result', async (result) => {
            try {
                // Store result
                await this.dataStore.storeDnsResult(result);
                // Update sensor
                const sensorId = `sensor.network_monitor_dns_${this.sanitizeName(result.server_name)}`;
                const sensorState = {
                    state: result.success ? 'available' : 'unavailable',
                    response_time: result.response_time_ms,
                    success_rate: result.success ? 100 : 0,
                    last_success: result.success ? result.timestamp : new Date(0),
                    consecutive_failures: 0 // Would be tracked by state manager
                };
                await this.haSensor.updateDNSSensor(sensorId, result, sensorState);
                // Check for alerts (simplified - would use alert manager methods)
                // await this.alertManager!.checkDnsResult(result);
                // Broadcast to dashboard
                this.apiServer.broadcastUpdate({
                    type: 'dns',
                    result
                });
            }
            catch (error) {
                this.logger.error('Error handling DNS result:', error);
            }
        });
        // Handle configuration changes
        this.configManager.on('configChanged', async (newConfig) => {
            try {
                this.logger.info('Configuration updated, applying changes...');
                await this.applyConfigurationChanges(newConfig);
            }
            catch (error) {
                this.logger.error('Error applying configuration changes:', error);
            }
        });
        this.logger.info('Event handlers configured');
    }
    /**
     * Create sensors for all configured targets
     */
    async createSensorsForTargets() {
        if (!this.config || !this.haSensor) {
            throw new Error('Configuration or sensor component not initialized');
        }
        // Create ping sensors
        for (const target of this.config.ping_targets) {
            if (target.enabled) {
                await this.haSensor.create_ping_sensor(target);
            }
        }
        // Create DNS sensors
        for (const target of this.config.dns_targets) {
            if (target.enabled) {
                await this.haSensor.create_dns_sensor(target);
            }
        }
        this.logger.info(`Created sensors for ${this.config.ping_targets.length} ping targets and ${this.config.dns_targets.length} DNS targets`);
    }
    /**
     * Start all monitoring services
     */
    async start() {
        if (!this.isInitialized) {
            throw new Error('App must be initialized before starting');
        }
        if (this.isRunning) {
            this.logger.warn('App is already running');
            return;
        }
        this.logger.info('Starting Network Monitor App...');
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }
            // Start API server
            if (this.apiServer) {
                await this.apiServer.start();
                this.logger.info('API server started');
            }
            // Register sensors with Home Assistant
            if (this.haSensor) {
                await this.haSensor.registerSensors();
                this.logger.info('Sensors registered with Home Assistant');
            }
            // Configure and start monitoring
            if (this.monitor) {
                const enabledPingTargets = this.config.ping_targets.filter(t => t.enabled);
                const enabledDnsTargets = this.config.dns_targets.filter(t => t.enabled);
                this.monitor.updateTargets(enabledPingTargets, enabledDnsTargets);
                await this.monitor.start();
                this.logger.info('Monitoring started');
            }
            // Start periodic cleanup
            this.startPeriodicCleanup();
            this.isRunning = true;
            this.logger.info('Network Monitor App started successfully');
        }
        catch (error) {
            this.logger.error('Failed to start app:', error);
            throw error;
        }
    }
    /**
     * Stop all monitoring services gracefully
     */
    async stop() {
        if (!this.isRunning) {
            this.logger.warn('App is not running');
            return;
        }
        this.logger.info('Stopping Network Monitor App...');
        try {
            // Stop periodic cleanup
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }
            // Stop monitoring
            if (this.monitor) {
                await this.monitor.stop();
                this.logger.info('Monitoring stopped');
            }
            // Stop API server
            if (this.apiServer) {
                await this.apiServer.stop();
                this.logger.info('API server stopped');
            }
            // Close data store
            if (this.dataStore) {
                await this.dataStore.close();
                this.logger.info('Data store closed');
            }
            this.isRunning = false;
            this.logger.info('Network Monitor App stopped successfully');
        }
        catch (error) {
            this.logger.error('Failed to stop app gracefully:', error);
            throw error;
        }
    }
    /**
     * Apply configuration changes without full restart
     */
    async applyConfigurationChanges(newConfig) {
        this.config = newConfig;
        // Update alert thresholds
        if (this.alertManager) {
            this.alertManager.updateThresholds(newConfig.alert_thresholds);
        }
        // Update monitoring targets
        if (this.monitor) {
            const enabledPingTargets = newConfig.ping_targets.filter(t => t.enabled);
            const enabledDnsTargets = newConfig.dns_targets.filter(t => t.enabled);
            this.monitor.updateTargets(enabledPingTargets, enabledDnsTargets);
        }
        // Update sensors (create new ones, remove old ones)
        if (this.haSensor) {
            // This is simplified - in production would need to track and remove old sensors
            await this.createSensorsForTargets();
        }
        this.logger.info('Configuration changes applied successfully');
    }
    /**
     * Start periodic data cleanup
     */
    startPeriodicCleanup() {
        // Run cleanup daily at 3 AM
        const runCleanup = async () => {
            try {
                this.logger.info('Running periodic data cleanup...');
                if (this.dataStore) {
                    await this.dataStore.cleanupOldData();
                }
                this.logger.info('Data cleanup completed');
            }
            catch (error) {
                this.logger.error('Data cleanup failed:', error);
            }
        };
        // Run cleanup every 24 hours
        this.cleanupInterval = setInterval(runCleanup, 24 * 60 * 60 * 1000);
        // Also run cleanup on startup (after 5 minutes)
        setTimeout(runCleanup, 5 * 60 * 1000);
    }
    /**
     * Get application status
     */
    getStatus() {
        return {
            running: this.isRunning,
            initialized: this.isInitialized,
            config: this.config,
            components: {
                dataStore: this.dataStore !== null,
                monitor: this.monitor !== null,
                haSensor: this.haSensor !== null,
                alertManager: this.alertManager !== null,
                apiServer: this.apiServer !== null
            }
        };
    }
    /**
     * Health check endpoint
     */
    async healthCheck() {
        const status = this.getStatus();
        const allComponentsHealthy = Object.values(status.components).every(c => c);
        return {
            status: this.isRunning && allComponentsHealthy ? 'healthy' : 'unhealthy',
            uptime: process.uptime(),
            components: status.components
        };
    }
    /**
     * Sanitize name for entity IDs
     */
    sanitizeName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
}
exports.NetworkMonitorApp = NetworkMonitorApp;
//# sourceMappingURL=app.js.map