/**
 * State management for monitoring connectivity status transitions
 */
import { EventEmitter } from 'events';
import { PingResult, DNSResult, MonitoringStatus } from '../types';
export interface StateChangeEvent {
    target_name: string;
    target_type: 'ping' | 'dns';
    previous_status: string;
    new_status: string;
    timestamp: Date;
}
export declare class StateManager extends EventEmitter {
    private states;
    private consecutiveFailureThreshold;
    constructor(consecutiveFailureThreshold?: number);
    /**
     * Process a ping result and update state
     */
    processPingResult(result: PingResult): void;
    /**
     * Process a DNS result and update state
     */
    processDNSResult(result: DNSResult): void;
    /**
     * Get current state for a target
     */
    getState(targetName: string, targetType: 'ping' | 'dns'): MonitoringStatus | undefined;
    /**
     * Get all current states
     */
    getAllStates(): MonitoringStatus[];
    /**
     * Clear state for a target (when target is removed)
     */
    clearState(targetName: string, targetType: 'ping' | 'dns'): void;
    /**
     * Set consecutive failure threshold
     */
    setConsecutiveFailureThreshold(threshold: number): void;
    /**
     * Calculate ping status based on result and current state
     */
    private calculatePingStatus;
    /**
     * Calculate DNS status based on result and current state
     */
    private calculateDNSStatus;
    /**
     * Update state and emit change event if status changed
     */
    private updateState;
    /**
     * Get targets that are currently in failure state
     */
    getFailedTargets(): MonitoringStatus[];
    /**
     * Get targets that are currently degraded
     */
    getDegradedTargets(): MonitoringStatus[];
    /**
     * Get overall system health status
     */
    getOverallHealth(): 'healthy' | 'degraded' | 'critical';
}
//# sourceMappingURL=state-manager.d.ts.map