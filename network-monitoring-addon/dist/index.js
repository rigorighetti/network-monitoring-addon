"use strict";
/**
 * Main entry point for the Network Monitoring Add-on
 */
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const logger_1 = require("./utils/logger");
const logger = new logger_1.Logger('Main');
let app = null;
/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    try {
        // Stop the main application
        if (app) {
            await app.stop();
            app = null;
        }
        logger.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}
/**
 * Main application startup
 */
async function main() {
    try {
        logger.info('Starting Network Monitoring Add-on...');
        logger.info(`Node version: ${process.version}`);
        logger.info(`Platform: ${process.platform}`);
        logger.info(`Architecture: ${process.arch}`);
        // Create and initialize the application
        app = new app_1.NetworkMonitorApp();
        await app.initialize();
        await app.start();
        logger.info('API server includes /health endpoint');
        // Set up signal handlers for graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            gracefulShutdown('uncaughtException');
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection:', reason);
            gracefulShutdown('unhandledRejection');
        });
        logger.info('Network Monitoring Add-on started successfully');
        logger.info('Press Ctrl+C to stop');
    }
    catch (error) {
        logger.error('Failed to start Network Monitoring Add-on:', error);
        process.exit(1);
    }
}
// Start the application
main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map