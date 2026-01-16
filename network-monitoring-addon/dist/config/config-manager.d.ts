/**
 * Configuration manager for the Network Monitoring Add-on
 */
import { EventEmitter } from 'events';
import { NetworkMonitorConfig, PingTarget, DNSTarget } from '../types';
export interface ConfigValidationError {
    field: string;
    message: string;
    value?: any;
}
export declare class ConfigManager extends EventEmitter {
    private logger;
    private configPath;
    private backupPath;
    private currentConfig;
    private configWatcher;
    constructor(configPath?: string);
    loadConfig(): Promise<NetworkMonitorConfig>;
    saveConfig(config: NetworkMonitorConfig): Promise<void>;
    updateConfig(partialConfig: Partial<NetworkMonitorConfig>): Promise<NetworkMonitorConfig>;
    getCurrentConfig(): NetworkMonitorConfig | null;
    createBackup(): Promise<void>;
    restoreFromBackup(): Promise<NetworkMonitorConfig>;
    validateConfig(config: any): NetworkMonitorConfig;
    private validatePingTarget;
    private validateDNSTarget;
    private validateAlertThresholds;
    private validateDataRetention;
    private isValidInterval;
    getDefaultConfig(): NetworkMonitorConfig;
    startConfigWatcher(): Promise<void>;
    stopConfigWatcher(): Promise<void>;
    validatePingTargetConfig(target: Partial<PingTarget>): ConfigValidationError[];
    validateDNSTargetConfig(target: Partial<DNSTarget>): ConfigValidationError[];
    validateIntervalConfig(interval: any): boolean;
    private fileExists;
}
//# sourceMappingURL=config-manager.d.ts.map