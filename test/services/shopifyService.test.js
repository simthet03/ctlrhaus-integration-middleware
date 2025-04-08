// test/services/shopifyService.test.js
const ShopifyService = require('../../src/services/shopifyService');

// Mock the 'got' module that might be used internally
jest.mock('got', () => ({
  default: jest.fn()
}));

// Mock Shopify API
const mockShopifyApi = {
  product: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  metafield: {
    create: jest.fn()
  }
};

jest.mock('shopify-api-node', () => {
  return jest.fn().mockImplementation(() => mockShopifyApi);
});

// Mock gammatekService
const mockGammatekService = {
  fetchProductCatalog: jest.fn(),
  fetchStockLevels: jest.fn()
};

jest.mock('../../src/services/gammatekService', () => mockGammatekService);

describe('ShopifyService', () => {
  let shopifyService;
  
  const mockProducts = [
    {
      sku: 'TEST001',
      name: 'Test Product 1',
      description: 'Test Description 1',
      priceIncl: 99.99,
      images: ['http://example.com/image1.jpg'],
      attributes: {
        brand: 'Test Brand',
        category: 'Test Category',
        deviceManufacturer: 'Test Manufacturer',
        deviceModel: 'Test Model',
        color: 'Black'
      },
      features: {
        Feature1: 'Test Feature 1',
        Feature2: 'Test Feature 2'
      }
    }
  ];

  const mockStockLevels = [
    {
      sku: 'TEST001',
      onHand: 10
    }
  ];

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset all mock implementations
    mockShopifyApi.product.list.mockResolvedValue([]);
    mockShopifyApi.product.create.mockResolvedValue({ id: 'new-id' });
    mockShopifyApi.product.update.mockResolvedValue({});
    mockShopifyApi.metafield.create.mockResolvedValue({});
    
    mockGammatekService.fetchProductCatalog.mockResolvedValue([mockProducts[0]]);
    mockGammatekService.fetchStockLevels.mockResolvedValue([mockStockLevels[0]]);
    
    // Create new service instance
    shopifyService = new ShopifyService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('syncProducts', () => {
    it('should fetch products and stock levels from Gammatek', async () => {
      await shopifyService.syncProducts();
      
      expect(mockGammatekService.fetchProductCatalog).toHaveBeenCalled();
      expect(mockGammatekService.fetchStockLevels).toHaveBeenCalled();
    });

    it('should handle errors during sync', async () => {
      mockGammatekService.fetchProductCatalog.mockRejectedValue(new Error('API Error'));
      
      await expect(shopifyService.syncProducts()).rejects.toThrow('API Error');
    });
  });

  describe('createOrUpdateProduct', () => {
    it('should create a new product if it does not exist', async () => {
      mockShopifyApi.product.list.mockResolvedValue([]);
      
      await shopifyService.createOrUpdateProduct(mockProducts[0], 10);
      
      expect(mockShopifyApi.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockProducts[0].name,
          vendor: mockProducts[0].attributes.brand,
          variants: expect.arrayContaining([
            expect.objectContaining({
              sku: mockProducts[0].sku,
              inventory_quantity: 10
            })
          ])
        })
      );
    });

    it('should update existing product if it exists', async () => {
      const existingProduct = { 
        id: 'existing-id', 
        variants: [{ id: 'variant-id' }] 
      };
      
      mockShopifyApi.product.list.mockResolvedValue([existingProduct]);
      
      await shopifyService.createOrUpdateProduct(mockProducts[0], 10);
      
      expect(mockShopifyApi.product.update).toHaveBeenCalledWith(
        existingProduct.id,
        expect.any(Object)
      );
    });
  });

  describe('scheduleSync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should schedule sync with specified interval', () => {
      const intervalMinutes = 30;
      const spy = jest.spyOn(global, 'setInterval');
      
      shopifyService.scheduleSync(intervalMinutes);
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(Function),
        intervalMinutes * 60 * 1000
      );
      
      spy.mockRestore();
    });

    it('should execute sync function when interval triggers', () => {
      const syncSpy = jest.spyOn(shopifyService, 'syncProducts');
      shopifyService.scheduleSync(30);
      
      jest.advanceTimersByTime(30 * 60 * 1000);
      
      expect(syncSpy).toHaveBeenCalled();
      syncSpy.mockRestore();
    });
  });
});