/**
 * Logger utility for the Network Monitoring Add-on
 */
export declare class Logger {
    private component;
    constructor(component: string);
    private formatMessage;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map