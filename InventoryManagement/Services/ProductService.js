// InventoryManagement/Service/ProductService.js
// Uses shared PrismaClient (K8 fix)
const prisma = require('../../lib/prisma');
const productRepository = require('../Repository/Product');
const stockRepository = require('../Repository/Stock');
const { ValidationError, NotFoundError } = require('../../errors');

// PostgreSQL INTEGER (signed 32-bit) upper bound — values above this are
// rejected with a 400 instead of surfacing as a Prisma 500.
const MAX_CRATE_SIZE = 2147483647;

// K12: crateSize must be a positive whole number of bottles, or null/omitted
// for bottles-only products. Number.isInteger rejects fractional values,
// NaN, and ±Infinity; the explicit typeof check rejects numeric strings and
// other coerced types before any implicit conversion can sneak through.
function assertValidCrateSize(crateSize) {
  if (crateSize === undefined || crateSize === null) return; // bottles-only
  if (
    typeof crateSize !== 'number' ||
    !Number.isInteger(crateSize) ||
    crateSize <= 0 ||
    crateSize > MAX_CRATE_SIZE
  ) {
    throw new ValidationError('Crate size must be a positive whole number of bottles');
  }
}

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
    assertValidCrateSize(crateSize);
    if (reorderLevel !== undefined && reorderLevel !== null) {
      if (typeof reorderLevel !== 'number' || reorderLevel < 0) {
        throw new ValidationError('Reorder level must be a non-negative number');
      }
    }

    // Create the Product and its Stock row atomically so a product can
    // never exist without stock tracking.
    const result = await prisma.$transaction(async (tx) => {
      const product = await productRepository.create({
        name: name.trim(),
        category,
        unitPrice,
        crateSize,
      }, tx);

      const stock = await stockRepository.create({
        productId: product.id,
        quantityBottles: 0,
        quantityCrates: 0,
        reorderLevel: reorderLevel ?? 0,
      }, tx);

      return { product, stock };
    });

    return result;
  }

  // Update a product's basic details (price change, category change, etc.)
  // reorderLevel belongs to Stock, not Product - it is ignored here and must
  // be updated through StockService.adjustReorderLevel.
  async updateProduct(id, data) {
    const { reorderLevel, ...productFields } = data;

    if (productFields.unitPrice !== undefined) {
      if (typeof productFields.unitPrice !== 'number' || productFields.unitPrice <= 0) {
        throw new ValidationError('Unit price must be a positive number');
      }
    }
    // undefined (omitted) = leave unchanged; null = clear (bottles-only).
    assertValidCrateSize(productFields.crateSize);
    if (productFields.name !== undefined) {
      if (typeof productFields.name !== 'string' || productFields.name.trim() === '') {
        throw new ValidationError('Product name cannot be empty');
      }
      productFields.name = productFields.name.trim();
    }
    if (productFields.category !== undefined && productFields.category !== null &&
        typeof productFields.category !== 'string') {
      throw new ValidationError('Category must be a string');
    }
    if (productFields.isActive !== undefined &&
        typeof productFields.isActive !== 'boolean') {
      throw new ValidationError('isActive must be a boolean');
    }

    return productRepository.update(id, productFields);
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