// InventoryManagement/Service/ProductService.js
const productRepository = require('../Repository/Product');
const stockRepository = require('../Repository/Stock');

class ProductService {
  // Creates a Product AND its matching Stock row in one step.
  // Your schema requires every Product to eventually have a Stock row,
  // so this prevents ever creating a product that has no stock tracking.
  async registerProduct({ name, category, unitPrice, crateSize, reorderLevel }) {
    const product = await productRepository.create({
      name,
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
    return productRepository.update(id, data);
  }

  async getProductWithStock(id) {
    return productRepository.findByIdWithStock(id);
  }

  async listProducts(category) {
    return productRepository.findAll(category);
  }

  async deleteProduct(id) {
    // Note: this will fail if Stock/SaleItem/ItemBatchOrder rows still
    // reference this product, since Prisma enforces the relation.
    // Delete or reassign those first if you need to remove a product.
    return productRepository.delete(id);
  }
}

module.exports = new ProductService();
