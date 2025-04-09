const axios = require('axios');
require('dotenv').config();
class GammatekService {
  constructor() {
    this.apiKey = process.env.GAMMATEK_API_KEY;
    this.baseUrl = 'https://api.gamma.co.za/api';
  }

  /**
   * Fetch product catalog from Gammatek, filtered by category
   * @returns {Promise<Array>} Array of filtered products
   */
  async fetchProductCatalog() {
    try {
      const response = await axios.get(`${this.baseUrl}/products`, {
        headers: {
          'X-GAMMATEK-API-Key': this.apiKey,
          'Accept': 'application/json'
        }
      });

      //       Available categories:
      // - Audio (58 products) (done)
      // - Charging (216 products) (done)
      // - Gadgets and Accessories (89 products) (done)
      // - Homeware (12 products) (done)
      // - Luggage (17 products) (done)
      // - Phone Case (1097 products)
      // - Screen Protector (202 products) (done)

      // Filter products to only include 'Gadgets and Accessories'
      const filteredProducts = response.data.filter(product => {
        const category = this.extractFirstAttribute(product.Attributes, 'ItemCategory');
        return category === 'Screen Protector';
      });
      console.log(`Filtered ${response.data.length} total products to ${filteredProducts.length} Gadgets and Accessories products`);

      // Transform filtered products to a more manageable format
      return filteredProducts.map(product => ({
        sku: product.Sku,
        name: product.Name,
        description: product.FullDescription,
        priceIncl: product.PriceIncl,
        priceExcl: product.PriceExcl,
        images: product.Pictures,
        attributes: {
          deviceManufacturer: this.extractFirstAttribute(product.Attributes, 'DeviceManufacturer'),
          deviceModel: this.extractFirstAttribute(product.Attributes, 'DeviceModel'),
          brand: this.extractFirstAttribute(product.Attributes, 'Brand'),
          category: this.extractFirstAttribute(product.Attributes, 'ItemCategory'),
          color: this.extractFirstAttribute(product.Attributes, 'ItemColor')
        },
        features: this.extractFeatures(product.KeyValues)
      }));
    } catch (error) {
      console.error('Error fetching Gammatek product catalog:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Extract the first value for a given attribute key
   * @param {Array} attributes - Array of attribute objects
   * @param {string} key - Attribute key to find
   * @returns {string|null} First value for the key or null
   */
  extractFirstAttribute(attributes, key) {
    const attr = attributes.find(a => a.Key === key);
    return attr ? attr.Value[0] : null;
  }

  /**
   * Extract features from KeyValues
   * @param {Array} keyValues - Array of key-value pairs
   * @returns {Object} Object of features
   */
  extractFeatures(keyValues) {
    const features = {};
    keyValues.forEach(kv => {
      if (kv.Key.startsWith('Feature') && kv.Key !== 'Feed') {
        features[kv.Key] = kv.Value;
      }
    });
    return features;
  }

  /**
   * Fetch stock levels for products
   * @returns {Promise<Array>} Array of stock levels
   */
  async fetchStockLevels() {
    try {
      const response = await axios.get(`${this.baseUrl}/stock`, {
        headers: {
          'X-GAMMATEK-API-Key': this.apiKey,
          'Accept': 'application/json'
        }
      });
      return response.data.map(stock => ({
        sku: stock.Sku,
        onHand: stock.OnHand
      }));
    } catch (error) {
      console.error('Error fetching Gammatek stock levels:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}
module.exports = {
  GammatekService
};