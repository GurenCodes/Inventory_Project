// InventoryManagement/Service/StockService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const stockRepository = require('../Repository/Stock');
const itemBatchOrderRepository = require('../Repository/ItemBatchOrder');
const productRepository = require('../Repository/Product');
const userRepository = require('../../UserManagement/Repository/UserRepository');
const { ValidationError, NotFoundError } = require('../../errors');

class StockService {
  // A delivery arrives from a supplier: log the batch order AND
  // increase Stock by the correct amount, in one atomic operation.
  // If either step fails, both are rolled back (no half-updated stock).
  async receiveBatchOrder({ productId, receivedById, crateCount, bottleCount, costPerUnit, expiryDate }) {
    if (productId === undefined || productId === null) {
      throw new ValidationError('Product ID is required');
    }
    if (receivedById === undefined || receivedById === null) {
      throw new ValidationError('Received by user ID is required');
    }

    // Validate that the user exists
    const user = await userRepository.findById(receivedById);
    if (!user) {
      throw new NotFoundError(`User ${receivedById} does not exist`);
    }

    if (costPerUnit === undefined || costPerUnit === null) {
      throw new ValidationError('Cost per unit is required');
    }
    if (typeof costPerUnit !== 'number' || costPerUnit <= 0) {
      throw new ValidationError('Cost per unit must be a positive number');
    }
    if (crateCount !== undefined && crateCount !== null) {
      if (typeof crateCount !== 'number' || crateCount < 0) {
        throw new ValidationError('Crate count must be a non-negative number');
      }
    }
    if (bottleCount !== undefined && bottleCount !== null) {
      if (typeof bottleCount !== 'number' || bottleCount < 0) {
        throw new ValidationError('Bottle count must be a non-negative number');
      }
    }
    if (crateCount === 0 && bottleCount === 0) {
      throw new ValidationError('At least one of crateCount or bottleCount must be greater than zero');
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product ${productId} does not exist`);
    }

    // Convert crates into bottles using the product's own crate size
    const crateSize = product.crateSize ?? 0;
    const bottlesFromCrates = (crateCount ?? 0) * crateSize;
    const totalBottlesAdded = bottlesFromCrates + (bottleCount ?? 0);

    // $transaction ensures both writes succeed together or not at all
    const [batchOrder, updatedStock] = await prisma.$transaction([
      prisma.itemBatchOrder.create({
        data: { productId, receivedById, crateCount: crateCount ?? 0, bottleCount: bottleCount ?? 0, costPerUnit, expiryDate },
      }),
      prisma.stock.update({
        where: { productId },
        data: {
          quantityBottles: { increment: totalBottlesAdded },
          quantityCrates: { increment: crateCount ?? 0 },
        },
      }),
    ]);

    return { batchOrder, updatedStock };
  }

  async getStockForProduct(productId) {
    return stockRepository.findByProductId(productId);
  }

  // Returns null if no stock record exists for the product
  async getStockForProductSafe(productId) {
    return stockRepository.findByProductId(productId);
  }

  async listLowStock() {
    return stockRepository.findLowStock();
  }

  async adjustReorderLevel(productId, newLevel) {
    if (productId === undefined || productId === null) {
      throw new ValidationError('Product ID is required');
    }
    if (newLevel === undefined || newLevel === null) {
      throw new ValidationError('Reorder level is required');
    }
    if (typeof newLevel !== 'number' || newLevel < 0) {
      throw new ValidationError('Reorder level must be a non-negative number');
    }

    const stock = await stockRepository.findByProductId(productId);
    if (!stock) throw new NotFoundError(`No stock record for product ${productId}`);
    return stockRepository.update(stock.id, { reorderLevel: newLevel });
  }
}

module.exports = new StockService();