// InventoryManagement/Service/ProductService.js
const productRepository = require('../Repository/Product');
const stockRepository = require('../Repository/Stock');
const { ValidationError, NotFoundError } = require('../../errors');

class ProductService {
  // Creates a Product AND its matching Stock row in one step.
  // Your schema requires every Product to eventually have a Stock row,
  // so this prevents ever creating a product that has no stock tracking.
  async registerProduct({ name, category, unitPrice, crateSize, reorderLevel }) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new ValidationError('Product name is required');
    }
    if (unitPrice === undefined || unitPrice === null) {
      throw new ValidationError('Unit price is required');
    }
    if (typeof unitPrice !== 'number' || unitPrice <= 0) {
      throw new ValidationError('Unit price must be a positive number');
    }
    if (crateSize !== undefined && crateSize !== null) {
      if (typeof crateSize !== 'number' || crateSize <= 0) {
        throw new ValidationError('Crate size must be a positive number');
      }
    }
    if (reorderLevel !== undefined && reorderLevel !== null) {
      if (typeof reorderLevel !== 'number' || reorderLevel < 0) {
        throw new ValidationError('Reorder level must be a non-negative number');
      }
    }

    const product = await productRepository.create({
      name: name.trim(),
      category,
      unitPrice,
      crateSize,
    });

    const stock = await stockRepository.create({
      productId: product.id,
      quantityBottles: 0,
      quantityCrates: 0,
      reorderLevel: reorderLevel ?? 0,
    });

    return { product, stock };
  }

  // Update a product's basic details (price change, category change, etc.)
  async updateProduct(id, data) {
    if (data.unitPrice !== undefined) {
      if (typeof data.unitPrice !== 'number' || data.unitPrice <= 0) {
        throw new ValidationError('Unit price must be a positive number');
      }
    }
    if (data.crateSize !== undefined && data.crateSize !== null) {
      if (typeof data.crateSize !== 'number' || data.crateSize <= 0) {
        throw new ValidationError('Crate size must be a positive number');
      }
    }
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim() === '') {
        throw new ValidationError('Product name cannot be empty');
      }
      data.name = data.name.trim();
    }
    if (data.reorderLevel !== undefined && data.reorderLevel !== null) {
      if (typeof data.reorderLevel !== 'number' || data.reorderLevel < 0) {
        throw new ValidationError('Reorder level must be a non-negative number');
      }
    }

    return productRepository.update(id, data);
  }

  async getProductWithStock(id) {
    return productRepository.findByIdWithStock(id);
  }

  async listProducts(category) {
    return productRepository.findAll(category);
  }

  // Marks a product as discontinued (isActive = false) instead of deleting.
  // This preserves sales, stock, and delivery history.
  async discontinueProduct(id) {
    if (id === undefined || id === null || typeof id !== 'number' || isNaN(id)) {
      throw new ValidationError('Product ID is required');
    }
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product ${id} does not exist`);
    }
    return productRepository.update(id, { isActive: false });
  }

  // Restore a discontinued product
  async restoreProduct(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product ${id} does not exist`);
    }
    return productRepository.update(id, { isActive: true });
  }

  // List only active products (for catalog views)
  async listActiveProducts(category) {
    return productRepository.findAll(category, true);
  }
}

module.exports = new ProductService();