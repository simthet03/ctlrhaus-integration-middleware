// test-categories.js
require('dotenv').config();
const axios = require('axios');

class CategoryLister {
    constructor() {
        this.apiKey = process.env.GAMMATEK_API_KEY;
        this.baseUrl = 'https://api.gamma.co.za/api';
    }

    extractFirstAttribute(attributes, key) {
        const attr = attributes.find(a => a.Key === key);
        return attr ? attr.Value[0] : null;
    }

    async listCategories() {
        try {
            console.log('Fetching categories from Gammatek...');
            
            const response = await axios.get(`${this.baseUrl}/products`, {
                headers: {
                    'X-GAMMATEK-API-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            });

            const categories = new Set(
                response.data
                    .map(product => this.extractFirstAttribute(product.Attributes, 'ItemCategory'))
                    .filter(Boolean)
            );

            console.log('\nAvailable categories:');
            Array.from(categories).sort().forEach(category => {
                const count = response.data.filter(
                    product => this.extractFirstAttribute(product.Attributes, 'ItemCategory') === category
                ).length;
                console.log(`- ${category} (${count} products)`);
            });

        } catch (error) {
            console.error('Error fetching categories:', error.message);
        }
    }

    async listCategoryProducts(categoryName) {
        try {
            console.log(`Fetching ${categoryName} products from Gammatek...`);
            
            const response = await axios.get(`${this.baseUrl}/products`, {
                headers: {
                    'X-GAMMATEK-API-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            });
    
            // Filter products by category and extract relevant information
            const categoryProducts = response.data
                .filter(product => this.extractFirstAttribute(product.Attributes, 'ItemCategory') === categoryName)
                .map(product => ({
                    name: product.Name,
                    sku: product.Sku,
                    priceExcl: product.PriceExcl,
                    priceIncl: product.PriceIncl,
                    manufacturer: product.ManufacturerName,
                    description: product.FullDescription,
                    barcode: product.Barcode,
                    pictures: product.Pictures || [],
                    categoryPath: product.CategoryPath,
                    features: product.KeyValues?.filter(kv => kv.Key.startsWith('Feature')).map(kv => kv.Value) || []
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
    
            // Print the results
            console.log(`\nFound ${categoryProducts.length} ${categoryName} products:`);
            categoryProducts.forEach((product, index) => {
                console.log(`\n${index + 1}. ${product.name}`);
                console.log(`   SKU: ${product.sku}`);
                console.log(`   Price (Excl VAT): R${product.priceExcl}`);
                console.log(`   Price (Incl VAT): R${product.priceIncl}`);
                console.log(`   Manufacturer: ${product.manufacturer}`);
                console.log(`   Barcode: ${product.barcode}`);
                console.log('   Features:');
                product.features.forEach(feature => {
                    console.log(`     - ${feature}`);
                });
                console.log('   Images:');
                if (product.pictures.length > 0) {
                    product.pictures.forEach((imageUrl, idx) => {
                        console.log(`     ${idx + 1}. ${imageUrl}`);
                    });
                } else {
                    console.log('     No images available');
                }
            });
    
            return categoryProducts;
    
        } catch (error) {
            console.error('Error fetching products:', error.message);
            throw error;
        }
    }
}

// Run the category lister
const lister = new CategoryLister();
lister.listCategories();
lister.listCategoryProducts('Homeware');