/**
 * Data storage component for network monitoring results
 * Provides time-series data storage with SQLite backend
 */
import { PingResult, DNSResult } from '../types/results';
import { Logger } from '../types';
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface HistoricalData<T> {
    data: T[];
    total_count: number;
    time_range: TimeRange;
}
export interface AggregatedData {
    timestamp: Date;
    min_response_time: number | null;
    max_response_time: number | null;
    avg_response_time: number | null;
    success_count: number;
    total_count: number;
    success_rate: number;
}
export declare class DataStore {
    private db;
    private dbPath;
    private logger;
    private retentionDays;
    constructor(logger: Logger, dataDir?: string, retentionDays?: number);
    /**
     * Initialize the database connection and create tables
     */
    initialize(): Promise<void>;
    /**
     * Create database tables for storing monitoring results
     */
    private createTables;
    /**
     * Create database indexes for efficient querying
     */
    private createIndexes;
    /**
     * Store a ping test result
     */
    storePingResult(result: PingResult): Promise<void>;
    /**
     * Store a DNS test result
     */
    storeDnsResult(result: DNSResult): Promise<void>;
    /**
     * Retrieve ping history for a specific target
     */
    getPingHistory(targetName: string, timeRange: TimeRange, limit?: number): Promise<HistoricalData<PingResult>>;
    /**
     * Retrieve DNS history for a specific server
     */
    getDnsHistory(serverName: string, timeRange: TimeRange, limit?: number): Promise<HistoricalData<DNSResult>>;
    /**
     * Clean up old data based on retention policy
     */
    cleanupOldData(): Promise<void>;
    /**
     * Get database statistics
     */
    getStats(): Promise<{
        ping_count: number;
        dns_count: number;
        db_size_mb: number;
    }>;
    /**
     * Close the database connection
     */
    close(): Promise<void>;
    /**
     * Get aggregated ping data for dashboard visualization
     */
    getAggregatedPingData(targetName: string, timeRange: TimeRange, intervalMinutes?: number): Promise<AggregatedData[]>;
    /**
     * Get aggregated DNS data for dashboard visualization
     */
    getAggregatedDnsData(serverName: string, timeRange: TimeRange, intervalMinutes?: number): Promise<AggregatedData[]>;
    /**
     * Get aggregated DNS data filtered by query type for dashboard visualization
     */
    getAggregatedDnsDataByType(serverName: string, queryType: string, timeRange: TimeRange, intervalMinutes?: number): Promise<AggregatedData[]>;
    /**
     * Get recent ping data for real-time dashboard updates
     */
    getRecentPingData(targetName: string, minutes?: number): Promise<PingResult[]>;
    /**
     * Get recent DNS data for real-time dashboard updates
     */
    getRecentDnsData(serverName: string, minutes?: number): Promise<DNSResult[]>;
    /**
     * Get summary statistics for a target over a time period
     */
    getPingSummary(targetName: string, timeRange: TimeRange): Promise<{
        total_tests: number;
        successful_tests: number;
        success_rate: number;
        avg_response_time: number | null;
        min_response_time: number | null;
        max_response_time: number | null;
        avg_packet_loss: number;
    }>;
    /**
     * Get summary statistics for DNS server over a time period
     */
    getDnsSummary(serverName: string, timeRange: TimeRange): Promise<{
        total_tests: number;
        successful_tests: number;
        success_rate: number;
        avg_response_time: number | null;
        min_response_time: number | null;
        max_response_time: number | null;
        unique_domains_tested: number;
    }>;
    /**
     * Get all available targets for dashboard selection
     */
    getAvailableTargets(): Promise<{
        ping_targets: string[];
        dns_servers: string[];
    }>;
}
//# sourceMappingURL=data-store.d.ts.map