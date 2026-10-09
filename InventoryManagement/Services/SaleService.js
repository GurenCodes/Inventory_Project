// InventoryManagement/Service/SaleService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const saleRepository = require('../Repository/Sale');
const stockRepository = require('../Repository/Stock');
const productRepository = require('../Repository/Product');
const userRepository = require('../../UserManagement/Repository/UserRepository');
const { ValidationError, NotFoundError } = require('../../errors');

class SaleService {
  // items = [{ productId, quantityBottles }, ...]
  // unitPrice is read from Product.unitPrice server-side (K1 fix).
  // Client-supplied unitPrice is ignored for security.
  // Stock decrement is atomic: check-and-decrement in one DB operation (K2 fix).
  // Crate/bottle consistency maintained (K7 fix).
  // Checks stock for every item BEFORE writing anything, then creates
  // the Sale + all SaleItems + decrements Stock, all in one transaction.
  async completeSale({ soldById, items }) {
    if (!items || items.length === 0) {
      throw new ValidationError('A sale must have at least one item');
    }
    if (!soldById) {
      throw new ValidationError('Sold by user ID is required');
    }

    // Validate that the user exists
    const user = await userRepository.findById(soldById);
    if (!user) {
      throw new NotFoundError(`User ${soldById} does not exist`);
    }

    // 1. Validate all items first
    for (const item of items) {
      if (!item.productId) {
        throw new ValidationError('Each sale item must have a productId');
      }
      if (item.quantityBottles === undefined || item.quantityBottles === null) {
        throw new ValidationError('Each sale item must have a quantityBottles');
      }
      if (typeof item.quantityBottles !== 'number' || item.quantityBottles <= 0) {
        throw new ValidationError('Quantity must be a positive number');
      }

      // Check if product exists and is active
      const product = await productRepository.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} does not exist`);
      }
      if (!product.isActive) {
        throw new ValidationError(`Product ${item.productId} is discontinued and cannot be sold`);
      }
    }

    // 2. Read prices from Product.unitPrice server-side (K1 fix)
    //    Client-supplied unitPrice is ignored for security
    const lineItems = [];
    for (const item of items) {
      const product = await productRepository.findById(item.productId);
      const unitPrice = product.unitPrice;
      const lineTotal = item.quantityBottles * Number(unitPrice);
      lineItems.push({
        productId: item.productId,
        quantityBottles: item.quantityBottles,
        unitPrice,
        lineTotal,
        crateSize: product.crateSize,
      });
    }
    const totalAmount = lineItems.reduce((sum, i) => sum + Number(i.lineTotal), 0);

    // 3. Build one transaction: create Sale, create each SaleItem,
    //    atomically decrement Stock for each product (K2 fix)
    //    K7: Also update crates to stay in sync with bottles
    // Increased timeout to 60s to handle network latency to Aiven DB
    const result = await prisma.$transaction(
      async (tx) => {
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

        // K2 + K7: Atomic conditional decrement with crate sync
        // Only decrement if sufficient stock exists, and update crates
        const updated = await stockRepository.conditionalDecrementWithCrates(
          item.productId,
          item.quantityBottles,
          item.crateSize,
          tx
        );

        if (updated === 0) {
          // No row updated = insufficient stock or concurrent modification
          throw new ValidationError(
            `Not enough stock for product ${item.productId} (concurrent modification or insufficient quantity)`
          );
        }
      }

      return sale;
    },
    { timeout: 60000 }
    );

    return saleRepository.findByIdWithItems(result.id);
  }

  // Returns null if sale not found (instead of throwing)
  async getSale(id) {
    return saleRepository.findByIdWithItems(id);
  }

  async listSales(status) {
    return saleRepository.findAll(status);
  }

  async cancelSale(id) {
    // K3: Cancellation policy
    // - Only completed sales can be cancelled
    // - Already cancelled sales are rejected
    // - Restocking happens atomically with status change
    // - Only ADMIN can cancel (enforced at route level)
    // K7: Restock updates both bottles and crates
    try {
      const sale = await saleRepository.findByIdWithItems(id);
      if (!sale) {
        throw new NotFoundError(`Sale ${id} does not exist`);
      }
      if (sale.status !== 'completed') {
        throw new ValidationError(`Only completed sales can be cancelled (current status: ${sale.status})`);
      }

      // Atomic: update sale status to cancelled AND restock all items
      await prisma.$transaction(
        async (tx) => {
          // Restock each product
          for (const item of sale.items) {
            const product = await productRepository.findById(item.productId);
            const crateSize = product.crateSize ?? 0;
            await stockRepository.incrementBottlesAndCrates(
              item.productId,
              item.quantityBottles,
              crateSize,
              tx
            );
          }

          // Update sale status
          await tx.sale.update({
            where: { id },
            data: { status: 'cancelled' },
          });
        },
        { timeout: 60000 }
      );

      return saleRepository.findByIdWithItems(id);
    } catch (e) {
      if (e.code === 'P2025') {
        throw new NotFoundError(`Sale ${id} does not exist`);
      }
      throw e;
    }
  }
}

module.exports = new SaleService();