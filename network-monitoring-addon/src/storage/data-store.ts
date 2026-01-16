/**
 * Data storage component for network monitoring results
 * Provides time-series data storage with SQLite backend
 */

import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
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

export class DataStore {
  private db: Database | null = null;
  private dbPath: string;
  private logger: Logger;
  private retentionDays: number;

  constructor(logger: Logger, dataDir: string = '/data', retentionDays: number = 30) {
    this.logger = logger;
    this.dbPath = path.join(dataDir, 'network_monitoring.db');
    this.retentionDays = retentionDays;
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          this.logger.error('Failed to open database:', err.message);
          reject(err);
          return;
        }
        
        this.logger.info('Connected to SQLite database');
        this.createTables()
          .then(() => {
            this.createIndexes()
              .then(() => {
                this.logger.info('Database initialized successfully');
                resolve();
              })
              .catch(reject);
          })
          .catch(reject);
      });
    });
  }

  /**
   * Create database tables for storing monitoring results
   */
  private async createTables(): Promise<void> {
    const createPingTable = `
      CREATE TABLE IF NOT EXISTS ping_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        target_name TEXT NOT NULL,
        target_address TEXT NOT NULL,
        response_time_ms REAL,
        packet_loss_percent REAL NOT NULL,
        success INTEGER NOT NULL,
        error_message TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `;

    const createDnsTable = `
      CREATE TABLE IF NOT EXISTS dns_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        server_name TEXT NOT NULL,
        server_ip TEXT NOT NULL,
        domain TEXT NOT NULL,
        query_type TEXT NOT NULL,
        response_time_ms REAL,
        success INTEGER NOT NULL,
        resolved_address TEXT,
        error_message TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.serialize(() => {
        this.db!.run(createPingTable, (err) => {
          if (err) {
            this.logger.error('Failed to create ping_results table:', err.message);
            reject(err);
            return;
          }
        });

        this.db!.run(createDnsTable, (err) => {
          if (err) {
            this.logger.error('Failed to create dns_results table:', err.message);
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  /**
   * Create database indexes for efficient querying
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ping_timestamp ON ping_results(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_ping_target ON ping_results(target_name)',
      'CREATE INDEX IF NOT EXISTS idx_ping_target_timestamp ON ping_results(target_name, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_dns_timestamp ON dns_results(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_dns_server ON dns_results(server_name)',
      'CREATE INDEX IF NOT EXISTS idx_dns_server_timestamp ON dns_results(server_name, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_dns_domain ON dns_results(domain)'
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let completed = 0;
      const total = indexes.length;

      indexes.forEach((indexSql) => {
        this.db!.run(indexSql, (err) => {
          if (err) {
            this.logger.error('Failed to create index:', err.message);
            reject(err);
            return;
          }
          
          completed++;
          if (completed === total) {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Store a ping test result
   */
  async storePingResult(result: PingResult): Promise<void> {
    const sql = `
      INSERT INTO ping_results (
        timestamp, target_name, target_address, response_time_ms, 
        packet_loss_percent, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      Math.floor(result.timestamp.getTime() / 1000), // Convert to Unix timestamp
      result.target_name,
      result.target_address,
      result.response_time_ms,
      result.packet_loss_percent,
      result.success ? 1 : 0,
      result.error_message || null
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Store a DNS test result
   */
  async storeDnsResult(result: DNSResult): Promise<void> {
    const sql = `
      INSERT INTO dns_results (
        timestamp, server_name, server_ip, domain, query_type,
        response_time_ms, success, resolved_address, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      Math.floor(result.timestamp.getTime() / 1000), // Convert to Unix timestamp
      result.server_name,
      result.server_ip,
      result.domain,
      result.query_type,
      result.response_time_ms,
      result.success ? 1 : 0,
      result.resolved_address || null,
      result.error_message || null
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Retrieve ping history for a specific target
   */
  async getPingHistory(
    targetName: string, 
    timeRange: TimeRange, 
    limit: number = 1000
  ): Promise<HistoricalData<PingResult>> {
    const sql = `
      SELECT timestamp, target_name, target_address, response_time_ms,
             packet_loss_percent, success, error_message
      FROM ping_results
      WHERE target_name = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const params = [
      targetName,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000),
      limit
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: PingResult[] = rows.map(row => ({
          timestamp: new Date(row.timestamp * 1000),
          target_name: row.target_name,
          target_address: row.target_address,
          response_time_ms: row.response_time_ms,
          packet_loss_percent: row.packet_loss_percent,
          success: row.success === 1,
          error_message: row.error_message
        }));

        resolve({
          data,
          total_count: data.length,
          time_range: timeRange
        });
      });
    });
  }

  /**
   * Retrieve DNS history for a specific server
   */
  async getDnsHistory(
    serverName: string, 
    timeRange: TimeRange, 
    limit: number = 1000
  ): Promise<HistoricalData<DNSResult>> {
    const sql = `
      SELECT timestamp, server_name, server_ip, domain, query_type,
             response_time_ms, success, resolved_address, error_message
      FROM dns_results
      WHERE server_name = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const params = [
      serverName,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000),
      limit
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: DNSResult[] = rows.map(row => ({
          timestamp: new Date(row.timestamp * 1000),
          server_name: row.server_name,
          server_ip: row.server_ip,
          domain: row.domain,
          query_type: row.query_type,
          response_time_ms: row.response_time_ms,
          success: row.success === 1,
          resolved_address: row.resolved_address,
          error_message: row.error_message
        }));

        resolve({
          data,
          total_count: data.length,
          time_range: timeRange
        });
      });
    });
  }

  /**
   * Clean up old data based on retention policy
   */
  async cleanupOldData(): Promise<void> {
    const cutoffTimestamp = Math.floor((Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000)) / 1000);
    
    const deletePingSql = 'DELETE FROM ping_results WHERE timestamp < ?';
    const deleteDnsSql = 'DELETE FROM dns_results WHERE timestamp < ?';

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.serialize(() => {
        this.db!.run(deletePingSql, [cutoffTimestamp], (err) => {
          if (err) {
            this.logger.error('Failed to cleanup old ping data:', err.message);
            reject(err);
            return;
          }
          this.logger.info(`Cleaned up ping data older than ${this.retentionDays} days`);
        });

        this.db!.run(deleteDnsSql, [cutoffTimestamp], (err) => {
          if (err) {
            this.logger.error('Failed to cleanup old DNS data:', err.message);
            reject(err);
            return;
          }
          this.logger.info(`Cleaned up DNS data older than ${this.retentionDays} days`);
          resolve();
        });
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{ ping_count: number; dns_count: number; db_size_mb: number }> {
    const pingCountSql = 'SELECT COUNT(*) as count FROM ping_results';
    const dnsCountSql = 'SELECT COUNT(*) as count FROM dns_results';

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let pingCount = 0;
      let dnsCount = 0;

      this.db.get(pingCountSql, (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        pingCount = row.count;

        this.db!.get(dnsCountSql, (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          dnsCount = row.count;

          // Get database file size (simplified - in real implementation would check file system)
          const dbSizeMb = 0; // Placeholder

          resolve({
            ping_count: pingCount,
            dns_count: dnsCount,
            db_size_mb: dbSizeMb
          });
        });
      });
    });
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          this.logger.error('Failed to close database:', err.message);
          reject(err);
          return;
        }
        
        this.logger.info('Database connection closed');
        this.db = null;
        resolve();
      });
    });
  }

  /**
   * Get aggregated ping data for dashboard visualization
   */
  async getAggregatedPingData(
    targetName: string,
    timeRange: TimeRange,
    intervalMinutes: number = 5
  ): Promise<AggregatedData[]> {
    const intervalSeconds = intervalMinutes * 60;
    
    const sql = `
      SELECT 
        (timestamp / ${intervalSeconds}) * ${intervalSeconds} as time_bucket,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        COUNT(*) as total_count,
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate
      FROM ping_results
      WHERE target_name = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
        AND response_time_ms IS NOT NULL
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;

    const params = [
      targetName,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: AggregatedData[] = rows.map(row => ({
          timestamp: new Date(row.time_bucket * 1000),
          min_response_time: row.min_response_time,
          max_response_time: row.max_response_time,
          avg_response_time: row.avg_response_time,
          success_count: row.success_count,
          total_count: row.total_count,
          success_rate: row.success_rate
        }));

        resolve(data);
      });
    });
  }

  /**
   * Get aggregated DNS data for dashboard visualization
   */
  async getAggregatedDnsData(
    serverName: string,
    timeRange: TimeRange,
    intervalMinutes: number = 5
  ): Promise<AggregatedData[]> {
    const intervalSeconds = intervalMinutes * 60;
    
    const sql = `
      SELECT 
        (timestamp / ${intervalSeconds}) * ${intervalSeconds} as time_bucket,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        COUNT(*) as total_count,
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate
      FROM dns_results
      WHERE server_name = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
        AND response_time_ms IS NOT NULL
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;

    const params = [
      serverName,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: AggregatedData[] = rows.map(row => ({
          timestamp: new Date(row.time_bucket * 1000),
          min_response_time: row.min_response_time,
          max_response_time: row.max_response_time,
          avg_response_time: row.avg_response_time,
          success_count: row.success_count,
          total_count: row.total_count,
          success_rate: row.success_rate
        }));

        resolve(data);
      });
    });
  }

  /**
   * Get aggregated DNS data filtered by query type for dashboard visualization
   */
  async getAggregatedDnsDataByType(
    serverName: string,
    queryType: string,
    timeRange: TimeRange,
    intervalMinutes: number = 5
  ): Promise<AggregatedData[]> {
    const intervalSeconds = intervalMinutes * 60;
    
    const sql = `
      SELECT 
        (timestamp / ${intervalSeconds}) * ${intervalSeconds} as time_bucket,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        COUNT(*) as total_count,
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate
      FROM dns_results
      WHERE server_name = ? 
        AND query_type = ?
        AND timestamp >= ? 
        AND timestamp <= ?
        AND response_time_ms IS NOT NULL
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;

    const params = [
      serverName,
      queryType,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: AggregatedData[] = rows.map(row => ({
          timestamp: new Date(row.time_bucket * 1000),
          min_response_time: row.min_response_time,
          max_response_time: row.max_response_time,
          avg_response_time: row.avg_response_time,
          success_count: row.success_count,
          total_count: row.total_count,
          success_rate: row.success_rate
        }));

        resolve(data);
      });
    });
  }

  /**
   * Get recent ping data for real-time dashboard updates
   */
  async getRecentPingData(targetName: string, minutes: number = 60): Promise<PingResult[]> {
    const cutoffTimestamp = Math.floor((Date.now() - (minutes * 60 * 1000)) / 1000);
    
    const sql = `
      SELECT timestamp, target_name, target_address, response_time_ms,
             packet_loss_percent, success, error_message
      FROM ping_results
      WHERE target_name = ? AND timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, [targetName, cutoffTimestamp], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: PingResult[] = rows.map(row => ({
          timestamp: new Date(row.timestamp * 1000),
          target_name: row.target_name,
          target_address: row.target_address,
          response_time_ms: row.response_time_ms,
          packet_loss_percent: row.packet_loss_percent,
          success: row.success === 1,
          error_message: row.error_message
        }));

        resolve(data);
      });
    });
  }

  /**
   * Get recent DNS data for real-time dashboard updates
   */
  async getRecentDnsData(serverName: string, minutes: number = 60): Promise<DNSResult[]> {
    const cutoffTimestamp = Math.floor((Date.now() - (minutes * 60 * 1000)) / 1000);
    
    const sql = `
      SELECT timestamp, server_name, server_ip, domain, query_type,
             response_time_ms, success, resolved_address, error_message
      FROM dns_results
      WHERE server_name = ? AND timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, [serverName, cutoffTimestamp], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const data: DNSResult[] = rows.map(row => ({
          timestamp: new Date(row.timestamp * 1000),
          server_name: row.server_name,
          server_ip: row.server_ip,
          domain: row.domain,
          query_type: row.query_type,
          response_time_ms: row.response_time_ms,
          success: row.success === 1,
          resolved_address: row.resolved_address,
          error_message: row.error_message
        }));

        resolve(data);
      });
    });
  }

  /**
   * Get summary statistics for a target over a time period
   */
  async getPingSummary(targetName: string, timeRange: TimeRange): Promise<{
    total_tests: number;
    successful_tests: number;
    success_rate: number;
    avg_response_time: number | null;
    min_response_time: number | null;
    max_response_time: number | null;
    avg_packet_loss: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_tests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_tests,
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate,
        AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as avg_response_time,
        MIN(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as min_response_time,
        MAX(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as max_response_time,
        AVG(packet_loss_percent) as avg_packet_loss
      FROM ping_results
      WHERE target_name = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
    `;

    const params = [
      targetName,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          total_tests: row.total_tests || 0,
          successful_tests: row.successful_tests || 0,
          success_rate: row.success_rate || 0,
          avg_response_time: row.avg_response_time,
          min_response_time: row.min_response_time,
          max_response_time: row.max_response_time,
          avg_packet_loss: row.avg_packet_loss || 0
        });
      });
    });
  }

  /**
   * Get summary statistics for DNS server over a time period
   */
  async getDnsSummary(serverName: string, timeRange: TimeRange): Promise<{
    total_tests: number;
    successful_tests: number;
    success_rate: number;
    avg_response_time: number | null;
    min_response_time: number | null;
    max_response_time: number | null;
    unique_domains_tested: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_tests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_tests,
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate,
        AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as avg_response_time,
        MIN(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as min_response_time,
        MAX(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as max_response_time,
        COUNT(DISTINCT domain) as unique_domains_tested
      FROM dns_results
      WHERE server_name = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
    `;

    const params = [
      serverName,
      Math.floor(timeRange.start.getTime() / 1000),
      Math.floor(timeRange.end.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          total_tests: row.total_tests || 0,
          successful_tests: row.successful_tests || 0,
          success_rate: row.success_rate || 0,
          avg_response_time: row.avg_response_time,
          min_response_time: row.min_response_time,
          max_response_time: row.max_response_time,
          unique_domains_tested: row.unique_domains_tested || 0
        });
      });
    });
  }

  /**
   * Get all available targets for dashboard selection
   */
  async getAvailableTargets(): Promise<{
    ping_targets: string[];
    dns_servers: string[];
  }> {
    const pingTargetsSql = 'SELECT DISTINCT target_name FROM ping_results ORDER BY target_name';
    const dnsServersSql = 'SELECT DISTINCT server_name FROM dns_results ORDER BY server_name';

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(pingTargetsSql, (err, pingRows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        this.db!.all(dnsServersSql, (err, dnsRows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            ping_targets: pingRows.map(row => row.target_name),
            dns_servers: dnsRows.map(row => row.server_name)
          });
        });
      });
    });
  }
}