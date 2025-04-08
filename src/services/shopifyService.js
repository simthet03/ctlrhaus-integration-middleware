const Shopify = require('shopify-api-node');
const axios = require('axios'); 
const { GammatekService } = require('./gammatekService');
const sharp = require('sharp');
const fs = require('fs').promises;
const { optimize } = require('svgo');

class ShopifyService {
  constructor() {
    this.shopify = new Shopify({
      shopName: process.env.SHOPIFY_SHOP_NAME,
      apiKey: process.env.SHOPIFY_API_KEY,
      password: process.env.SHOPIFY_ACCESS_TOKEN_VAR
    });
  }


  /**
   * Sync Gammatek products to Shopify
   */
  async syncProducts() {
    try {
        // Add counters
        let totalProducts = 0;
        let successfulSyncs = 0;
        let failedSyncs = 0;
        
        // Fetch products and stock levels from Gammatek
        const products = await gammatekService.fetchProductCatalog();
        totalProducts = products.length;
        console.log(`Fetched ${totalProducts} products from Gammatek`);

        const stockLevels = await gammatekService.fetchStockLevels();
        console.log(`Fetched ${stockLevels.length} stock levels from Gammatek`);

        // Create a map of stock levels for easy lookup
        const stockMap = new Map(stockLevels.map(stock => [stock.sku, stock.onHand]));

        // Process each product
        for (const product of products) {
            try {
                await this.createOrUpdateProduct(product, stockMap.get(product.sku) || 0);
                successfulSyncs++;
                console.log(`Successfully synced product ${successfulSyncs}/${totalProducts}: ${product.sku}`);
            } catch (error) {
                failedSyncs++;
                console.error(`Failed to sync product ${product.sku}:`, error.message);
            }
        }

        // Log final results
        console.log(`
            Sync Summary:
            Total Products: ${totalProducts}
            Successfully Synced: ${successfulSyncs}
            Failed: ${failedSyncs}
        `);
    } catch (error) {
        console.error('Error syncing products:', error);
        throw error;
    }
}

async createNewProduct(product, shopifyProduct, stockLevel) {
    try {
        const response = await this.shopify.product.create(shopifyProduct);
        console.log(`Created new product ${product.sku} with ID ${response.id}`);
        
        // Update inventory if needed
        if (response.variants && response.variants.length > 0) {
            await this.updateInventory(response.variants[0], stockLevel);
        }
        
        return response;
    } catch (error) {
        console.error(`Error creating product ${product.sku}:`, error);
        throw error;
    }
}

async updateInventory(variant, stockLevel) {
    try {
        await this.shopify.inventoryLevel.set({
            inventory_item_id: variant.inventory_item_id,
            location_id: process.env.SHOPIFY_LOCATION_ID,
            available: stockLevel
        });
        console.log(`Updated inventory level for variant ${variant.sku} to ${stockLevel}`);
    } catch (error) {
        console.error(`Error updating inventory:`, error);
        throw error;
    }
}

async verifyProductExistence(sku) {
    try {
        // Search specifically by SKU
        const products = await this.shopify.product.list({
            query: `variants.sku:${sku}`,
            fields: 'id,title,variants'
        });

        // Find the exact product that matches the SKU
        const exactMatch = products.find(product => 
            product.variants.some(variant => variant.sku === sku)
        );

        return exactMatch || null;
    } catch (error) {
        console.error(`Error verifying product existence for SKU ${sku}:`, error);
        return null;
    }
}

optimizeImageUrl(originalUrl) {
    if (!originalUrl) return null;

    // Parse the original URL
    const url = new URL(originalUrl);
    
    // Add Shopify CDN parameters
    const params = new URLSearchParams({
        width: '2048',      // Request large size
        height: '2048',
        crop: 'center',     // Center the image
        quality: '100',     // Highest quality
        format: 'jpg',      // Use jpg format for photos
        fit: 'contain'      // Maintain aspect ratio
    });

    // Combine URL with parameters
    return `${url.origin}${url.pathname}?${params.toString()}`;
}

transformImageUrl(originalUrl) {
    if (!originalUrl) return null;
    
    // Ensure we're getting the highest quality version from Gammatek
    const baseUrl = originalUrl.split('?')[0]; // Remove any existing parameters
    return `${baseUrl}?format=jpg&quality=100&width=2048`;
}

validateImageUrl(url) {
    if (!url) return false;
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'https:' && 
               parsedUrl.hostname === 'images.gammatek.co.za';
    } catch {
        return false;
    }
}

//  async convertToSVG(imageUrl) {
//         try {
//             // Download the image
//             const response = await axios({
//                 url: imageUrl,
//                 responseType: 'arraybuffer'
//             });

//             // Convert to PNG and get dimensions
//             const metadata = await sharp(response.data).metadata();
//             const pngBuffer = await sharp(response.data)
//                 .png()
//                 .toBuffer();

//             // Convert to base64
//             const base64Image = pngBuffer.toString('base64');

//             // Create SVG wrapper
//             const svg = `
//                 <svg xmlns="http://www.w3.org/2000/svg" 
//                      xmlns:xlink="http://www.w3.org/1999/xlink"
//                      width="${metadata.width}" 
//                      height="${metadata.height}"
//                      viewBox="0 0 ${metadata.width} ${metadata.height}">
//                     <image
//                         width="100%"
//                         height="100%"
//                         preserveAspectRatio="xMidYMid meet"
//                         xlink:href="data:image/png;base64,${base64Image}"
//                     />
//                 </svg>
//             `;

//             // Optimize SVG
//             const result = optimize(svg, {
//                 multipass: true,
//             });

//             return result.data;
//         } catch (error) {
//             console.error('Error converting image to SVG:', error);
//             throw error;
//         }
//     }






  /**
   * Create or update a product in Shopify
   * @param {Object} product - Gammatek product details
   * @param {number} stockLevel - Available stock
   */
  async createOrUpdateProduct(product, stockLevel) {
    try {
        console.log(`Starting to process product ${product.sku}`);
        
        // Extract base product name and key attributes
        const modelName = product.name; // Full model name
        const color = product.attributes?.color || 'Default';
        const deviceModel = product.attributes?.deviceModel;
        
        // Log the product data we're trying to send
        console.log('Product data:', {
            sku: product.sku,
            name: modelName,
            color: color,
            deviceModel: deviceModel,
            price: product.priceIncl,
            stockLevel: stockLevel,
            hasImages: product.images?.length > 0,
            attributes: product.attributes
        });

        // Validate product data
        if (!this.validateProduct(product)) {
            throw new Error(`Invalid product data for SKU: ${product.sku}`);
        }

        try {
            // Search for existing product using exact title match
            const queryTitle = modelName.replace(/'/g, '').replace(/"/g, '');
            let existingProducts = await this.shopify.product.list({
                limit: 250,
                fields: 'id,title,variants,options,images'
            });

            // Find exact match by comparing full product name
            const existingProduct = existingProducts.find(p => 
                p.title.toLowerCase() === modelName.toLowerCase()
            );

            let response;
            if (existingProduct) {
                console.log(`Found exact matching product: ${existingProduct.title}`);

                // Check if this SKU already exists as a variant
                const existingVariant = existingProduct.variants.find(v => v.sku === product.sku);
                if (existingVariant) {
                    // Update existing variant
                    console.log(`Updating existing variant with SKU: ${product.sku}`);
                    const updateData = {
                        id: existingProduct.id,
                        variants: [{
                            id: existingVariant.id,
                            price: product.priceIncl,
                            sku: product.sku,
                            inventory_quantity: stockLevel,
                            inventory_management: 'shopify'
                        }]
                    };
                    response = await this.shopify.product.update(existingProduct.id, updateData);
                } else {
                    // Add new color variant to existing product
                    console.log(`Adding new color variant to existing product: ${color}`);
                    
                    // Get existing color options
                    const colorOption = existingProduct.options.find(opt => opt.name === "Color");
                    let colorValues = colorOption ? [...colorOption.values] : [];
                    if (!colorValues.includes(color)) {
                        colorValues.push(color);
                    }

                    // Prepare update data with new variant
                    const updateData = {
                        id: existingProduct.id,
                        options: [{
                            name: "Color",
                            values: colorValues
                        }],
                        variants: [
                            {
                                option1: color,
                                price: product.priceIncl,
                                sku: product.sku,
                                inventory_quantity: stockLevel,
                                inventory_management: 'shopify',
                                status: 'active'
                            }
                        ]
                    };

                    response = await this.shopify.product.update(existingProduct.id, updateData);
                }
            } else {
                // Create new product with first variant
                console.log(`Creating new product: ${modelName}`);
                const formatImageUrl = (imageUrl) => {
                    // Ensure we're using the original Gammatek URL without any transformations
                    return imageUrl.split('?')[0]; // Remove any existing query parameters
                };

                // let svgImages = [];
                // if (Array.isArray(product.images)) {
                //     for (const imageUrl of product.images) {
                //         const svgImage = await this.convertImageToSVG(imageUrl);
                //         if (svgImage) {
                //             svgImages.push({
                //                 attachment: svgImage.replace(/^data:image\/svg\+xml;base64,/, ''),
                //                 alt: product.name
                //             });
                //         }
                //     }
                // }

                const newProductData = {
                    title: modelName,
                    body_html: product.description || '',
                    vendor: product.attributes?.brand || 'Unknown',
                    product_type: product.attributes?.category || 'Other',
                    options: [{
                        name: "Color",
                        values: [color]
                    }],
                    variants: [{
                        option1: color,
                        price: product.priceIncl,
                        sku: product.sku,
                        inventory_quantity: stockLevel,
                        inventory_management: 'shopify',
                        status: 'active'
                    }],
                    status: 'active',
                    published: true,
                    published_scope: 'global',
                    images: Array.isArray(product.images) ? 
                        product.images.map(imageUrl => ({
                            src: imageUrl,
                            attachment: null,
                            width: null,  
                            height: null,
                            alt: product.name,
                            metadata: {
                                quality: '100'  
                            }
                        })) : []
        
                };

                response = await this.shopify.product.create(newProductData);
                console.log(`Created new product: ${modelName} with color: ${color}`);
            }

            // Log the response details
            console.log('\nShopify Response:', JSON.stringify({
                id: response.id,
                title: response.title,
                status: response.status,
                published: response.published_at ? 'Yes' : 'No',
                variants: response.variants.map(v => ({
                    id: v.id,
                    sku: v.sku,
                    price: v.price,
                    inventory_quantity: v.inventory_quantity,
                    status: v.status
                }))
            }, null, 2));

            // Update inventory for the specific variant
            if (response && response.variants) {
                const variant = response.variants.find(v => v.sku === product.sku);
                if (variant) {
                    try {
                        await this.shopify.inventoryLevel.set({
                            inventory_item_id: variant.inventory_item_id,
                            location_id: process.env.SHOPIFY_LOCATION_ID,
                            available: stockLevel
                        });
                        console.log(`Updated inventory level for ${product.sku} to ${stockLevel}`);
                    } catch (inventoryError) {
                        console.error(`Error updating inventory for ${product.sku}:`, inventoryError);
                    }
                }
            }

            // Add metafields
            if (product.features && response) {
                try {
                    const metafieldResponse = await this.shopify.metafield.create({
                        key: 'gammatek_sync',
                        value: JSON.stringify(product.features),
                        type: 'json',
                        namespace: 'gammatek',
                        owner_resource: 'product',
                        owner_id: response.id
                    });
                    console.log(`\nMetafield Response for ${product.sku}:`, JSON.stringify(metafieldResponse, null, 2));
                } catch (metafieldError) {
                    console.error(`Error creating metafields for ${product.sku}:`, metafieldError);
                }
            }

            console.log(`\n=== Completed processing ${product.sku} ===\n`);
            return response;

        } catch (apiError) {
            const errorDetails = apiError.response?.body || apiError.message;
            console.error(`\nShopify API Error Details for ${product.sku}:`, {
                errorMessage: apiError.message,
                responseBody: errorDetails,
                statusCode: apiError.response?.statusCode
            });
            throw new Error(`Shopify API Error for SKU ${product.sku}: ${JSON.stringify(errorDetails)}`);
        }
    } catch (error) {
        console.error(`\nError processing product ${product.sku}:`, error);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Headers:', error.response.headers);
            console.error('Response Body:', error.response.body);
        }
        throw error;
    }
}


validateProduct(product) {
    const required = {
        sku: product.sku,
        name: product.name,
        priceIncl: product.priceIncl
    };

    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.error(`Product ${product.sku} missing required fields:`, missing);
        return false;
    }

    // Validate price is a positive number
    if (isNaN(product.priceIncl) || product.priceIncl < 0) {
        console.error(`Product ${product.sku} has invalid price:`, product.priceIncl);
        return false;
    }

    return true;
}

/**
 * Find a product in Shopify by SKU
 * @param {string} sku - The product SKU to search for
 * @returns {Promise<Object>} The found product or null
 */
async findProductBySku(sku) {
    try {
        const products = await this.shopify.product.list({
            limit: 1,
            query: `sku:${sku}`
        });
        return products.length > 0 ? products[0] : null;
    } catch (error) {
        console.error(`Error finding product with SKU ${sku}:`, error);
        throw error;
    }
}

  /**
   * Schedule periodic sync
   * @param {number} intervalInMinutes - Sync interval in minutes
   */
  scheduleSync(intervalInMinutes = 60) {
    console.log(`Scheduling Gammatek product sync every ${intervalInMinutes} minutes`);
    setInterval(async () => {
      try {
        await this.syncProducts();
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    }, intervalInMinutes * 60 * 1000);
  }
}

module.exports = { ShopifyService } ;