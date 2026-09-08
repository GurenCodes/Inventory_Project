// InventoryManagement/Service/SaleService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const saleRepository = require('../Repository/Sale');
const stockRepository = require('../Repository/Stock');

class SaleService {
  // items = [{ productId, quantityBottles, unitPrice }, ...]
  // Checks stock for every item BEFORE writing anything, then creates
  // the Sale + all SaleItems + decrements Stock, all in one transaction.
  async completeSale({ soldById, items }) {
    if (!items || items.length === 0) {
      throw new Error('A sale must have at least one item');
    }

    // 1. Check stock availability for every item first
    for (const item of items) {
      const stock = await stockRepository.findByProductId(item.productId);
      if (!stock) {
        throw new Error(`No stock record for product ${item.productId}`);
      }
      if (stock.quantityBottles < item.quantityBottles) {
        throw new Error(
          `Not enough stock for product ${item.productId}: have ${stock.quantityBottles}, need ${item.quantityBottles}`
        );
      }
    }

    // 2. Calculate line totals and the sale's total
    const lineItems = items.map((item) => ({
      ...item,
      lineTotal: item.quantityBottles * item.unitPrice,
    }));
    const totalAmount = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

    // 3. Build one transaction: create Sale, create each SaleItem,
    //    decrement Stock for each product — all succeed or all fail together
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: { soldById, totalAmount, status: 'completed' },
      });

      for (const item of lineItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantityBottles: item.quantityBottles,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          },
        });

        await tx.stock.update({
          where: { productId: item.productId },
          data: { quantityBottles: { decrement: item.quantityBottles } },
        });
      }

      return sale;
    });

    return saleRepository.findByIdWithItems(result.id);
  }

  async getSale(id) {
    return saleRepository.findByIdWithItems(id);
  }

  async listSales(status) {
    return saleRepository.findAll(status);
  }

  async cancelSale(id) {
    // Marks pending as cancelled; does not restock (sale never completed,
    // so stock was never decremented in the first place).
    return saleRepository.updateStatus(id, 'cancelled');
  }
}

module.exports = new SaleService();
