// index.js

require('dotenv').config();
const { ShopifyService } = require('./src/services/shopifyService');
const { GammatekService } = require('./src/services/gammatekService');
const path = require('path');
const fs = require('fs');

// Initialize services
const gammatekService = new GammatekService();
const shopifyService = new ShopifyService();

// Setup logging
const setupLogging = () => {
  const logDir = path.join(__dirname, 'logs');
  
  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Log to file and console
  const logToFileAndConsole = async (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    
    console.log(message);
    
    try {
      fs.appendFileSync(
        path.join(logDir, `sync-${new Date().toISOString().split('T')[0]}.log`),
        logMessage
      );
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  };

  return {
    info: (message) => logToFileAndConsole(`INFO: ${message}`),
    error: (message) => logToFileAndConsole(`ERROR: ${message}`),
    warning: (message) => logToFileAndConsole(`WARNING: ${message}`)
  };
};

// Initialize logger
const logger = setupLogging();

// Validate environment variables
const validateConfig = () => {
  const required = [
    'SHOPIFY_SHOP_NAME',
    'SHOPIFY_API_KEY',
    'SHOPIFY_ACCESS_TOKEN_VAR',
    'GAMMATEK_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Main sync function
const runSync = async () => {
  try {
    logger.info('Starting product sync');
    
    // Fetch products from Gammatek
    const products = await gammatekService.fetchProductCatalog();
    logger.info(`Fetched ${products.length} products from Gammatek`);
    
    // Fetch stock levels
    const stockLevels = await gammatekService.fetchStockLevels();
    logger.info(`Fetched stock levels for ${stockLevels.length} products`);
    
    // Create stock level map for quick lookup
    const stockMap = new Map(stockLevels.map(stock => [stock.sku, stock.onHand]));
    
    // Process each product
    for (const product of products) {
      try {
        const stockLevel = stockMap.get(product.sku) || 0;
        await shopifyService.createOrUpdateProduct(product, stockLevel);
        logger.info(`Successfully processed product ${product.sku}`);
      } catch (error) {
        logger.error(`Error processing product ${product.sku}: ${error.message}`);
      }
    }
    
    logger.info('Sync completed successfully');
    
  } catch (error) {
    logger.error(`Sync failed: ${error.message}`);
    throw error;
  }
};

// Start the application
const startApp = async () => {
  try {
    // Validate configuration
    validateConfig();
    
    // Initial sync
    await runSync();
    
    // Get sync interval from environment or use default (60 minutes)
    const syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES || '60', 10);
    
    // Schedule periodic sync
    shopifyService.scheduleSync(syncInterval);
    logger.info(`Scheduled periodic sync every ${syncInterval} minutes`);
    
    // Handle process termination
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM. Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT. Shutting down gracefully...');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`Application startup failed: ${error.message}`);
    process.exit(1);
  }
};

// Run the application if this file is run directly
if (require.main === module) {
  startApp();
}

module.exports = {
  runSync,
  startApp
};