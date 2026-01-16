/**
 * State management for monitoring connectivity status transitions
 */

import { EventEmitter } from 'events';
import { PingResult, DNSResult, MonitoringStatus } from '../types';
import { logger } from '../utils/logger';

export interface StateChangeEvent {
  target_name: string;
  target_type: 'ping' | 'dns';
  previous_status: string;
  new_status: string;
  timestamp: Date;
}

export class StateManager extends EventEmitter {
  private states: Map<string, MonitoringStatus> = new Map();
  private consecutiveFailureThreshold: number = 3;

  constructor(consecutiveFailureThreshold: number = 3) {
    super();
    this.consecutiveFailureThreshold = consecutiveFailureThreshold;
  }

  /**
   * Process a ping result and update state
   */
  processPingResult(result: PingResult): void {
    const key = `ping:${result.target_name}`;
    const currentState = this.states.get(key);
    
    const newState = this.calculatePingStatus(result, currentState);
    this.updateState(key, newState);
  }

  /**
   * Process a DNS result and update state
   */
  processDNSResult(result: DNSResult): void {
    const key = `dns:${result.server_name}`;
    const currentState = this.states.get(key);
    
    const newState = this.calculateDNSStatus(result, currentState);
    this.updateState(key, newState);
  }

  /**
   * Get current state for a target
   */
  getState(targetName: string, targetType: 'ping' | 'dns'): MonitoringStatus | undefined {
    const key = `${targetType}:${targetName}`;
    return this.states.get(key);
  }

  /**
   * Get all current states
   */
  getAllStates(): MonitoringStatus[] {
    return Array.from(this.states.values());
  }

  /**
   * Clear state for a target (when target is removed)
   */
  clearState(targetName: string, targetType: 'ping' | 'dns'): void {
    const key = `${targetType}:${targetName}`;
    this.states.delete(key);
    logger.debug(`Cleared state for ${key}`);
  }

  /**
   * Set consecutive failure threshold
   */
  setConsecutiveFailureThreshold(threshold: number): void {
    this.consecutiveFailureThreshold = threshold;
    logger.info(`Updated consecutive failure threshold to ${threshold}`);
  }

  /**
   * Calculate ping status based on result and current state
   */
  private calculatePingStatus(result: PingResult, currentState?: MonitoringStatus): MonitoringStatus {
    const now = new Date();
    
    // Initialize state if it doesn't exist
    if (!currentState) {
      return {
        target_name: result.target_name,
        target_type: 'ping',
        status: result.success ? 'online' : 'offline',
        last_success: result.success ? now : new Date(0),
        consecutive_failures: result.success ? 0 : 1,
        ...(result.response_time_ms !== null && { current_response_time: result.response_time_ms }),
        current_packet_loss: result.packet_loss_percent
      };
    }

    // Update state based on result
    const newState: MonitoringStatus = {
      ...currentState,
      ...(result.response_time_ms !== null && { current_response_time: result.response_time_ms }),
      current_packet_loss: result.packet_loss_percent
    };

    if (result.success) {
      // Success - reset failure count and update last success
      newState.consecutive_failures = 0;
      newState.last_success = now;
      
      // Determine status based on performance
      if (result.packet_loss_percent > 0 && result.packet_loss_percent < 100) {
        newState.status = 'degraded';
      } else {
        newState.status = 'online';
      }
    } else {
      // Failure - increment failure count
      newState.consecutive_failures = currentState.consecutive_failures + 1;
      
      // Update status based on consecutive failures
      if (newState.consecutive_failures >= this.consecutiveFailureThreshold) {
        newState.status = 'offline';
      } else {
        // Keep current status if we haven't reached threshold yet
        newState.status = currentState.status;
      }
    }

    return newState;
  }

  /**
   * Calculate DNS status based on result and current state
   */
  private calculateDNSStatus(result: DNSResult, currentState?: MonitoringStatus): MonitoringStatus {
    const now = new Date();
    
    // Initialize state if it doesn't exist
    if (!currentState) {
      return {
        target_name: result.server_name,
        target_type: 'dns',
        status: result.success ? 'available' : 'unavailable',
        last_success: result.success ? now : new Date(0),
        consecutive_failures: result.success ? 0 : 1,
        ...(result.response_time_ms !== null && { current_response_time: result.response_time_ms })
      };
    }

    // Update state based on result
    const newState: MonitoringStatus = {
      ...currentState,
      ...(result.response_time_ms !== null && { current_response_time: result.response_time_ms })
    };

    if (result.success) {
      // Success - reset failure count and update last success
      newState.consecutive_failures = 0;
      newState.last_success = now;
      
      // Determine status based on performance
      if (result.response_time_ms && result.response_time_ms > 1000) {
        newState.status = 'slow';
      } else {
        newState.status = 'available';
      }
    } else {
      // Failure - increment failure count
      newState.consecutive_failures = currentState.consecutive_failures + 1;
      
      // Update status based on consecutive failures
      if (newState.consecutive_failures >= this.consecutiveFailureThreshold) {
        newState.status = 'unavailable';
      } else {
        // Keep current status if we haven't reached threshold yet
        newState.status = currentState.status;
      }
    }

    return newState;
  }

  /**
   * Update state and emit change event if status changed
   */
  private updateState(key: string, newState: MonitoringStatus): void {
    const currentState = this.states.get(key);
    const previousStatus = currentState?.status || 'unknown';
    
    // Update the state
    this.states.set(key, newState);
    
    // Emit change event if status changed
    if (previousStatus !== newState.status) {
      const changeEvent: StateChangeEvent = {
        target_name: newState.target_name,
        target_type: newState.target_type,
        previous_status: previousStatus,
        new_status: newState.status,
        timestamp: new Date()
      };
      
      this.emit('stateChange', changeEvent);
      logger.info(`State change for ${newState.target_name} (${newState.target_type}): ${previousStatus} -> ${newState.status}`);
    }

    // Emit recovery event if we recovered from failure
    if (previousStatus === 'offline' && newState.status === 'online') {
      this.emit('recovery', {
        target_name: newState.target_name,
        target_type: newState.target_type,
        timestamp: new Date()
      });
      logger.info(`Recovery detected for ${newState.target_name} (${newState.target_type})`);
    }

    if (previousStatus === 'unavailable' && newState.status === 'available') {
      this.emit('recovery', {
        target_name: newState.target_name,
        target_type: newState.target_type,
        timestamp: new Date()
      });
      logger.info(`Recovery detected for ${newState.target_name} (${newState.target_type})`);
    }
  }

  /**
   * Get targets that are currently in failure state
   */
  getFailedTargets(): MonitoringStatus[] {
    return Array.from(this.states.values()).filter(state => 
      state.status === 'offline' || state.status === 'unavailable'
    );
  }

  /**
   * Get targets that are currently degraded
   */
  getDegradedTargets(): MonitoringStatus[] {
    return Array.from(this.states.values()).filter(state => 
      state.status === 'degraded' || state.status === 'slow'
    );
  }

  /**
   * Get overall system health status
   */
  getOverallHealth(): 'healthy' | 'degraded' | 'critical' {
    const allStates = Array.from(this.states.values());
    
    if (allStates.length === 0) {
      return 'healthy';
    }

    const failedCount = this.getFailedTargets().length;
    const degradedCount = this.getDegradedTargets().length;
    const totalCount = allStates.length;

    // Critical if more than 50% of targets are failed
    if (failedCount > totalCount * 0.5) {
      return 'critical';
    }

    // Degraded if any targets are failed or degraded
    if (failedCount > 0 || degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }
}