"use strict";
/**
 * Logger utility for the Network Monitoring Add-on
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
class Logger {
    constructor(component) {
        this.component = component;
    }
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ') : '';
        return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${message}${formattedArgs}`;
    }
    info(message, ...args) {
        console.log(this.formatMessage('info', message, ...args));
    }
    warn(message, ...args) {
        console.warn(this.formatMessage('warn', message, ...args));
    }
    error(message, ...args) {
        console.error(this.formatMessage('error', message, ...args));
    }
    debug(message, ...args) {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.debug(this.formatMessage('debug', message, ...args));
        }
    }
}
exports.Logger = Logger;
// Default logger instance
exports.logger = new Logger('NetworkMonitor');
//# sourceMappingURL=logger.js.map