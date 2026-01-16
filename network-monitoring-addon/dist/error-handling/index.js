"use strict";
/**
 * Error handling module exports
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReporter = exports.RecoveryManager = exports.ErrorHandler = exports.ErrorSeverity = exports.ErrorCategory = exports.NetworkMonitoringError = void 0;
__exportStar(require("./error-types"), exports);
__exportStar(require("./error-handler"), exports);
__exportStar(require("./recovery-manager"), exports);
__exportStar(require("./error-reporter"), exports);
// Re-export commonly used types and classes
var error_types_1 = require("./error-types");
Object.defineProperty(exports, "NetworkMonitoringError", { enumerable: true, get: function () { return error_types_1.NetworkMonitoringError; } });
Object.defineProperty(exports, "ErrorCategory", { enumerable: true, get: function () { return error_types_1.ErrorCategory; } });
Object.defineProperty(exports, "ErrorSeverity", { enumerable: true, get: function () { return error_types_1.ErrorSeverity; } });
var error_handler_1 = require("./error-handler");
Object.defineProperty(exports, "ErrorHandler", { enumerable: true, get: function () { return error_handler_1.ErrorHandler; } });
var recovery_manager_1 = require("./recovery-manager");
Object.defineProperty(exports, "RecoveryManager", { enumerable: true, get: function () { return recovery_manager_1.RecoveryManager; } });
var error_reporter_1 = require("./error-reporter");
Object.defineProperty(exports, "ErrorReporter", { enumerable: true, get: function () { return error_reporter_1.ErrorReporter; } });
//# sourceMappingURL=index.js.map