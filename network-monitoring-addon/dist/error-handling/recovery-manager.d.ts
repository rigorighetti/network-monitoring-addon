/**
 * Recovery manager for automatic recovery mechanisms
 */
import { EventEmitter } from 'events';
import { ErrorHandler } from './error-handler';
import { NetworkError } from './error-types';
export interface RecoveryAction {
    name: string;
    component: string;
    action: () => Promise<boolean>;
    cooldown_ms: number;
    max_attempts: number;
}
export interface RecoveryAttempt {
    id: string;
    error_id: string;
    action_name: string;
    timestamp: Date;
    success: boolean;
    duration_ms: number;
    error_message?: string;
}
export declare class RecoveryManager extends EventEmitter {
    private logger;
    private errorHandler;
    private recoveryActions;
    private recoveryAttempts;
    private cooldownTimers;
    private isRecoveryActive;
    constructor(errorHandler: ErrorHandler);
    /**
     * Register a recovery action for a specific component
     */
    registerRecoveryAction(action: RecoveryAction): void;
    /**
     * Attempt recovery for a specific error
     */
    attemptRecovery(error: NetworkError): Promise<boolean>;
    /**
     * Get recovery statistics
     */
    getRecoveryStatistics(): {
        total_attempts: number;
        successful_attempts: number;
        failed_attempts: number;
        success_rate: number;
        attempts_by_component: Record<string, number>;
        recent_attempts: RecoveryAttempt[];
    };
    /**
     * Force recovery attempt for a component
     */
    forceRecovery(component: string, actionName: string): Promise<boolean>;
    /**
     * Clear recovery history
     */
    clearRecoveryHistory(maxAge?: number): void;
    /**
     * Stop recovery manager
     */
    stop(): void;
    /**
     * Initialize default recovery actions
     */
    private initializeRecoveryActions;
    /**
     * Setup error handler event listeners
     */
    private setupErrorHandlerListeners;
    /**
     * Execute a recovery action
     */
    private executeRecoveryAction;
    /**
     * Get recovery action key for an error
     */
    private getRecoveryActionKey;
    /**
     * Check if recovery action is in cooldown
     */
    private isInCooldown;
    /**
     * Set cooldown for recovery action
     */
    private setCooldown;
    /**
     * Get recovery attempts for an error
     */
    private getRecoveryAttempts;
    /**
     * Record a recovery attempt
     */
    private recordRecoveryAttempt;
    /**
     * Check if automatic recovery should be attempted
     */
    private shouldAttemptAutoRecovery;
    /**
     * Attempt emergency recovery for critical system errors
     */
    private attemptEmergencyRecovery;
    /**
     * Generate unique attempt ID
     */
    private generateAttemptId;
}
//# sourceMappingURL=recovery-manager.d.ts.map