// test-sync.js
require('dotenv').config();
const { GammatekService } = require('./src/services/gammatekService');
const { ShopifyService } = require('./src/services/shopifyService');
const fs = require('fs');
const path = require('path');

// Initialize services
const gammatekService = new GammatekService();
const shopifyService = new ShopifyService();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Logger function
const logMessage = (message, isError = false) => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${message}\n`;
    const logFile = path.join(logsDir, `test-sync-${new Date().toISOString().split('T')[0]}.log`);
    
    console.log(logEntry.trim());
    fs.appendFileSync(logFile, logEntry);
    
    if (isError) {
        const errorLog = path.join(logsDir, 'error.log');
        fs.appendFileSync(errorLog, logEntry);
    }
};

async function testProductSync() {
    try {
        // 1. Fetch products from Gammatek
        logMessage('Fetching products from Gammatek...');
        const gammatekProducts = await gammatekService.fetchProductCatalog();
        
        if (!gammatekProducts || gammatekProducts.length === 0) {
            throw new Error('No products received from Gammatek');
        }
        
        // Take the first product for testing
        const testProduct = gammatekProducts[0];
        logMessage(`Testing with product: ${testProduct.name} (${testProduct.sku})`);
        
        // Get stock level for the test product
        logMessage('Fetching stock levels...');
        const stockLevels = await gammatekService.fetchStockLevels();
        const stockMap = new Map(stockLevels.map(stock => [stock.sku, stock.onHand]));
        const stockLevel = stockMap.get(testProduct.sku) || 0;
        
        // 2. Create/Update product in Shopify
        logMessage('Attempting to create/update product in Shopify...');
        await shopifyService.createOrUpdateProduct(testProduct, stockLevel);
        
        // 3. Verify the product was created/updated successfully
        logMessage('Verifying product in Shopify...');
        const verifyProduct = await shopifyService.findProductBySku(testProduct.sku);
        
        if (!verifyProduct) {
            throw new Error('Failed to verify product in Shopify');
        }
        
        // Log success details
        logMessage('Product sync test completed successfully!');
        logMessage('Product Details:');
        logMessage(JSON.stringify({
            title: verifyProduct.title,
            id: verifyProduct.id,
            status: verifyProduct.status,
            published: verifyProduct.published_at ? 'Yes' : 'No',
            variants: verifyProduct.variants.length,
            sku: testProduct.sku,
            stockLevel: stockLevel
        }, null, 2));
        
        // 4. Check product visibility
        const isPublished = verifyProduct.published_at !== null;
        logMessage(`Product publishing status: ${isPublished ? 'Published' : 'Not Published'}`);
        
        if (!isPublished) {
            logMessage('Warning: Product is not published. Check Shopify admin panel for details.', true);
        }
        
    } catch (error) {
        logMessage(`Error during product sync test: ${error.message}`, true);
        logMessage(`Stack trace: ${error.stack}`, true);
        throw error;
    }
}

// Run the test
testProductSync()
    .then(() => {
        logMessage('Test script completed');
        process.exit(0);
    })
    .catch((error) => {
        logMessage('Test script failed', true);
        process.exit(1);
    });