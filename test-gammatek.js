require('dotenv').config();
const gammatekService = require('./src/services/gammatekService');
const fs = require('fs').promises;

async function testGammatekService() {
    try {
        console.log('Testing Gammatek Service...\n');

        // Test product fetching
        console.log('1. Fetching product catalog...');
        const products = await gammatekService.fetchProductCatalog();
        console.log(`✓ Successfully fetched ${products.length} products\n`);

        // Test first product structure
        if (products.length > 0) {
            console.log('2. Checking first product structure:');
            const firstProduct = products[0];
            console.log(JSON.stringify(firstProduct, null, 2));
            
            // Check required fields based on your implementation
            const requiredFields = ['sku', 'name', 'priceIncl', 'attributes', 'features'];
            const missingFields = requiredFields.filter(field => !firstProduct[field]);
            
            if (missingFields.length === 0) {
                console.log('✓ Product contains all required fields\n');
            } else {
                console.log(`⚠ Missing required fields: ${missingFields.join(', ')}\n`);
            }

            // Check attributes structure
            console.log('3. Checking attributes structure:');
            const expectedAttributes = [
                'deviceManufacturer',
                'deviceModel',
                'brand',
                'category',
                'color'
            ];
            const missingAttributes = expectedAttributes.filter(attr => 
                !firstProduct.attributes.hasOwnProperty(attr)
            );
            
            if (missingAttributes.length === 0) {
                console.log('✓ All expected attributes present\n');
            } else {
                console.log(`⚠ Missing attributes: ${missingAttributes.join(', ')}\n`);
            }
        }

        // Test stock levels
        console.log('4. Fetching stock levels...');
        const stockLevels = await gammatekService.fetchStockLevels();
        console.log(`✓ Successfully fetched stock levels for ${stockLevels.length} products\n`);

        // Test merging products with stock
        console.log('5. Testing product and stock merge...');
        const firstProductWithStock = {
            ...products[0],
            stock: stockLevels.find(stock => stock.sku === products[0].sku)
        };
        console.log('Sample merged product:');
        console.log(JSON.stringify(firstProductWithStock, null, 2));

        // Save test results to file
        const testResults = {
            timestamp: new Date().toISOString(),
            totalProducts: products.length,
            totalStockRecords: stockLevels.length,
            sampleProduct: firstProductWithStock,
            stockLevelsSnapshot: stockLevels.slice(0, 5), // First 5 stock records
            dataValidation: {
                productsWithoutSku: products.filter(p => !p.sku).length,
                productsWithoutPrice: products.filter(p => !p.priceIncl).length,
                productsWithoutName: products.filter(p => !p.name).length,
                productsWithoutImages: products.filter(p => !p.images || !p.images.length).length,
                stockRecordsWithoutSku: stockLevels.filter(s => !s.sku).length,
                stockRecordsWithoutOnHand: stockLevels.filter(s => typeof s.onHand !== 'number').length
            }
        };

        await fs.writeFile(
            './gammatek-test-results.json', 
            JSON.stringify(testResults, null, 2)
        );
        console.log('\n✓ Test results saved to gammatek-test-results.json');

        // Print validation results
        console.log('\n6. Data validation results:');
        Object.entries(testResults.dataValidation).forEach(([key, value]) => {
            console.log(`${key}: ${value} issues found`);
        });

    } catch (error) {
        console.error('Test failed:', error);
        if (error.response) {
            console.error('API Error Response:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testGammatekService();
}

module.exports = testGammatekService;