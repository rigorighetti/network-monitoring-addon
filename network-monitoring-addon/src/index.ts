/**
 * Main entry point for the Network Monitoring Add-on
 */

import { NetworkMonitorApp } from './app';
import { Logger } from './utils/logger';

const logger = new Logger('Main');
let app: NetworkMonitorApp | null = null;

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  
  try {
    // Stop the main application
    if (app) {
      await app.stop();
      app = null;
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

/**
 * Main application startup
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Network Monitoring Add-on...');
    logger.info(`Node version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`Architecture: ${process.arch}`);
    
    // Create and initialize the application
    app = new NetworkMonitorApp();
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
    
  } catch (error) {
    logger.error('Failed to start Network Monitoring Add-on:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});