// InventoryManagement/Service/StockService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const stockRepository = require('../Repository/Stock');
const itemBatchOrderRepository = require('../Repository/ItemBatchOrder');
const productRepository = require('../Repository/Product');

class StockService {
  // A delivery arrives from a supplier: log the batch order AND
  // increase Stock by the correct amount, in one atomic operation.
  // If either step fails, both are rolled back (no half-updated stock).
  async receiveBatchOrder({ productId, receivedById, crateCount, bottleCount, costPerUnit, expiryDate }) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error(`Product ${productId} does not exist`);
    }

    // Convert crates into bottles using the product's own crate size
    const crateSize = product.crateSize ?? 0;
    const bottlesFromCrates = crateCount * crateSize;
    const totalBottlesAdded = bottlesFromCrates + bottleCount;

    // $transaction ensures both writes succeed together or not at all
    const [batchOrder, updatedStock] = await prisma.$transaction([
      prisma.itemBatchOrder.create({
        data: { productId, receivedById, crateCount, bottleCount, costPerUnit, expiryDate },
      }),
      prisma.stock.update({
        where: { productId },
        data: {
          quantityBottles: { increment: totalBottlesAdded },
          quantityCrates: { increment: crateCount },
        },
      }),
    ]);

    return { batchOrder, updatedStock };
  }

  async getStockForProduct(productId) {
    return stockRepository.findByProductId(productId);
  }

  async listLowStock() {
    return stockRepository.findLowStock();
  }

  async adjustReorderLevel(productId, newLevel) {
    const stock = await stockRepository.findByProductId(productId);
    if (!stock) throw new Error(`No stock record for product ${productId}`);
    return stockRepository.update(stock.id, { reorderLevel: newLevel });
  }
}

module.exports = new StockService();
