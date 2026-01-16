"use strict";
/**
 * State management for monitoring connectivity status transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class StateManager extends events_1.EventEmitter {
    constructor(consecutiveFailureThreshold = 3) {
        super();
        this.states = new Map();
        this.consecutiveFailureThreshold = 3;
        this.consecutiveFailureThreshold = consecutiveFailureThreshold;
    }
    /**
     * Process a ping result and update state
     */
    processPingResult(result) {
        const key = `ping:${result.target_name}`;
        const currentState = this.states.get(key);
        const newState = this.calculatePingStatus(result, currentState);
        this.updateState(key, newState);
    }
    /**
     * Process a DNS result and update state
     */
    processDNSResult(result) {
        const key = `dns:${result.server_name}`;
        const currentState = this.states.get(key);
        const newState = this.calculateDNSStatus(result, currentState);
        this.updateState(key, newState);
    }
    /**
     * Get current state for a target
     */
    getState(targetName, targetType) {
        const key = `${targetType}:${targetName}`;
        return this.states.get(key);
    }
    /**
     * Get all current states
     */
    getAllStates() {
        return Array.from(this.states.values());
    }
    /**
     * Clear state for a target (when target is removed)
     */
    clearState(targetName, targetType) {
        const key = `${targetType}:${targetName}`;
        this.states.delete(key);
        logger_1.logger.debug(`Cleared state for ${key}`);
    }
    /**
     * Set consecutive failure threshold
     */
    setConsecutiveFailureThreshold(threshold) {
        this.consecutiveFailureThreshold = threshold;
        logger_1.logger.info(`Updated consecutive failure threshold to ${threshold}`);
    }
    /**
     * Calculate ping status based on result and current state
     */
    calculatePingStatus(result, currentState) {
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
        const newState = {
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
            }
            else {
                newState.status = 'online';
            }
        }
        else {
            // Failure - increment failure count
            newState.consecutive_failures = currentState.consecutive_failures + 1;
            // Update status based on consecutive failures
            if (newState.consecutive_failures >= this.consecutiveFailureThreshold) {
                newState.status = 'offline';
            }
            else {
                // Keep current status if we haven't reached threshold yet
                newState.status = currentState.status;
            }
        }
        return newState;
    }
    /**
     * Calculate DNS status based on result and current state
     */
    calculateDNSStatus(result, currentState) {
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
        const newState = {
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
            }
            else {
                newState.status = 'available';
            }
        }
        else {
            // Failure - increment failure count
            newState.consecutive_failures = currentState.consecutive_failures + 1;
            // Update status based on consecutive failures
            if (newState.consecutive_failures >= this.consecutiveFailureThreshold) {
                newState.status = 'unavailable';
            }
            else {
                // Keep current status if we haven't reached threshold yet
                newState.status = currentState.status;
            }
        }
        return newState;
    }
    /**
     * Update state and emit change event if status changed
     */
    updateState(key, newState) {
        const currentState = this.states.get(key);
        const previousStatus = currentState?.status || 'unknown';
        // Update the state
        this.states.set(key, newState);
        // Emit change event if status changed
        if (previousStatus !== newState.status) {
            const changeEvent = {
                target_name: newState.target_name,
                target_type: newState.target_type,
                previous_status: previousStatus,
                new_status: newState.status,
                timestamp: new Date()
            };
            this.emit('stateChange', changeEvent);
            logger_1.logger.info(`State change for ${newState.target_name} (${newState.target_type}): ${previousStatus} -> ${newState.status}`);
        }
        // Emit recovery event if we recovered from failure
        if (previousStatus === 'offline' && newState.status === 'online') {
            this.emit('recovery', {
                target_name: newState.target_name,
                target_type: newState.target_type,
                timestamp: new Date()
            });
            logger_1.logger.info(`Recovery detected for ${newState.target_name} (${newState.target_type})`);
        }
        if (previousStatus === 'unavailable' && newState.status === 'available') {
            this.emit('recovery', {
                target_name: newState.target_name,
                target_type: newState.target_type,
                timestamp: new Date()
            });
            logger_1.logger.info(`Recovery detected for ${newState.target_name} (${newState.target_type})`);
        }
    }
    /**
     * Get targets that are currently in failure state
     */
    getFailedTargets() {
        return Array.from(this.states.values()).filter(state => state.status === 'offline' || state.status === 'unavailable');
    }
    /**
     * Get targets that are currently degraded
     */
    getDegradedTargets() {
        return Array.from(this.states.values()).filter(state => state.status === 'degraded' || state.status === 'slow');
    }
    /**
     * Get overall system health status
     */
    getOverallHealth() {
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
exports.StateManager = StateManager;
//# sourceMappingURL=state-manager.js.map