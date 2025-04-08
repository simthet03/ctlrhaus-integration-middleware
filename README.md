# Gammatek Shopify Product Sync

## Prerequisites
- Node.js (v14+ recommended)
- Shopify Store
- Gammatek API Access

## Setup

1. Install dependencies
```bash
npm install axios shopify-api-node dotenv
```

2. Create a `.env` file in the project root with the following variables:
```
GAMMATEK_API_KEY=your_gammatek_api_key
SHOPIFY_SHOP_NAME=your_shop_name
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_PASSWORD=your_shopify_api_password
```

3. Create an `index.js` file to start the sync process:
```javascript
const shopifyService = require('./src/services/shopifyService');

// Start periodic sync
shopifyService.scheduleSync(60); // Sync every 60 minutes
```

## Features
- Fetch product catalog from Gammatek
- Sync products to Shopify
- Update product details and inventory
- Scheduled periodic sync

## Error Handling
- Detailed error logging
- Handles product creation and updates
- Skips individual product errors to continue sync

## Customization
- Adjust sync interval in `scheduleSync()`
- Modify mapping in `createOrUpdateProduct()` as needed