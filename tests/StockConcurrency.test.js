// tests/StockConcurrency.test.js
// Focused regression tests for the 2026-10 stock concurrency fix:
// bottles and crates are now updated in ONE atomic parameterized SQL
// statement, so a successful mutation can never return a stale crate count
// and concurrent writers cannot lose updates or oversell.
//
// Exits non-zero on any failure.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const prisma = require('../lib/prisma');
const stockRepository = require('../InventoryManagement/Repository/Stock');
const stockService = require('../InventoryManagement/Services/StockService');
const saleService = require('../InventoryManagement/Services/SaleService');

const PREFIX = `CONC_${Date.now()}_`;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

function assertInvariant(stock, crateSize, label) {
  if (!crateSize || crateSize <= 0) return assert(true, `${label} (no crateSize, crates untouched)`);
  assert(
    stock.quantityCrates === Math.floor(stock.quantityBottles / crateSize),
    `${label} (bottles=${stock.quantityBottles}, crates=${stock.quantityCrates}, floor(bottles/${crateSize})=${Math.floor(stock.quantityBottles / crateSize)})`
  );
}

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found in database');

  // Sanity: verify the raw-SQL table/column identifiers against the live
  // schema before exercising them (Prisma maps model `Stock` -> table "Stock").
  try {
    await prisma.$queryRaw`SELECT "productId", "quantityBottles", "quantityCrates" FROM "Stock" LIMIT 1`;
    assert(true, 'raw-SQL identifiers ("Stock"."productId"/"quantityBottles"/"quantityCrates") resolve');
  } catch (e) {
    assert(false, `raw-SQL identifier check failed: ${e.message}`);
  }

  const products = [];
  async function makeProduct(crateSize, bottles, crates) {
    const p = await prisma.product.create({
      data: { name: `${PREFIX}P${products.length}`, unitPrice: 500, crateSize },
    });
    await prisma.stock.create({
      data: { productId: p.id, quantityBottles: bottles, quantityCrates: crates, reorderLevel: 0 },
    });
    products.push(p.id);
    return p;
  }

  try {
    // ============================================================
    console.log('\n--- 1. Sequential crate-boundary arithmetic ---');
    {
      const p = await makeProduct(12, 10, 0); // 10 bottles, 0 crates
      const after = await stockRepository.incrementBottlesAndCrates(p.id, 5, 12);
      assert(after.quantityBottles === 15, `increment 10+5 -> 15 bottles (got ${after.quantityBottles})`);
      assertInvariant(after, 12, 'increment across crate boundary keeps invariant');

      const back = await stockRepository.decrementBottlesAndCrates(p.id, 5, 12);
      assert(back.quantityBottles === 10, `decrement 15-5 -> 10 bottles (got ${back.quantityBottles})`);
      assertInvariant(back, 12, 'decrement across crate boundary keeps invariant');
    }

    // ============================================================
    console.log('\n--- 2. Receiving crates + loose bottles together ---');
    {
      const p = await makeProduct(12, 11, 0); // 11 bottles (partial crate)
      const res = await stockService.receiveBatchOrder({
        productId: p.id,
        receivedById: user.id,
        crateCount: 1,
        bottleCount: 2,
        costPerUnit: 100,
      });
      assert(res.updatedStock.quantityBottles === 25, `receive 11 + (1*12 + 2) -> 25 bottles (got ${res.updatedStock.quantityBottles})`);
      assert(res.updatedStock.quantityCrates === 2, `crates = floor(25/12) = 2 (got ${res.updatedStock.quantityCrates})`);
      await prisma.itemBatchOrder.delete({ where: { id: res.batchOrder.id } });
    }

    // ============================================================
    console.log('\n--- 3. Concurrent increments, same product ---');
    {
      const p = await makeProduct(12, 0, 0);
      const results = await Promise.all([
        stockRepository.incrementBottlesAndCrates(p.id, 13, 12),
        stockRepository.incrementBottlesAndCrates(p.id, 13, 12),
      ]);
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 26, `2 concurrent +13 -> 26 bottles (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'persisted row after concurrent increments');
      for (const r of results) assertInvariant(r, 12, 'returned row during concurrent increments');
    }

    // ============================================================
    console.log('\n--- 4. Concurrent decrements, both sufficient ---');
    {
      const p = await makeProduct(12, 24, 2);
      const results = await Promise.all([
        stockRepository.conditionalDecrementWithCrates(p.id, 6, 12),
        stockRepository.conditionalDecrementWithCrates(p.id, 6, 12),
      ]);
      assert(results[0] === 1 && results[1] === 1, `both decrements reported success (got ${results.join(',')})`);
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 12, `24-6-6 -> 12 bottles (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'persisted row after concurrent decrements');
    }

    // ============================================================
    console.log('\n--- 5. Concurrent decrements exceeding stock (no oversell) ---');
    {
      const p = await makeProduct(12, 10, 0);
      const results = await Promise.all([
        stockRepository.conditionalDecrementWithCrates(p.id, 7, 12),
        stockRepository.conditionalDecrementWithCrates(p.id, 7, 12),
      ]);
      const successes = results.filter((r) => r === 1).length;
      assert(successes === 1, `exactly one of two -7 on 10 bottles succeeds (got ${successes})`);
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 3, `final bottles = 3, never negative (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'persisted row after oversell attempt');
    }

    // ============================================================
    console.log('\n--- 6. Concurrent increment + decrement ---');
    {
      const p = await makeProduct(12, 12, 1);
      await Promise.all([
        stockRepository.incrementBottlesAndCrates(p.id, 12, 12),
        stockRepository.conditionalDecrementWithCrates(p.id, 6, 12),
      ]);
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 18, `12 +12 -6 -> 18 bottles (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'persisted row after mixed concurrent operations');
    }

    // ============================================================
    console.log('\n--- 7. Interleaved writers: every successful return is consistent ---');
    {
      // With the old two-step implementation, a guard failure silently
      // returned a row whose crates were stale. With the single-statement
      // implementation, crates are derived from the same UPDATE that moves
      // bottles, so every persisted row after any interleaving satisfies
      // the invariant, and any row returned to a caller does too.
      const p = await makeProduct(12, 0, 0);
      const ops = [];
      for (let i = 0; i < 6; i++) {
        ops.push(stockRepository.incrementBottlesAndCrates(p.id, 5, 12));
      }
      const returned = await Promise.all(ops);
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 30, `6 concurrent +5 -> 30 bottles (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'persisted row after interleaved writers');
      returned.forEach((r, i) => assertInvariant(r, 12, `returned row #${i}`));
    }

    // ============================================================
    console.log('\n--- 8. Concurrent deliveries to the same product ---');
    {
      const p = await makeProduct(12, 0, 0);
      const mk = () => stockService.receiveBatchOrder({
        productId: p.id,
        receivedById: user.id,
        crateCount: 1,
        bottleCount: 0,
        costPerUnit: 100,
      });
      const [a, b] = await Promise.all([mk(), mk()]);
      assert(!!a.batchOrder && !!b.batchOrder, 'both deliveries reported success (no lost update)');
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 24, `2 concurrent deliveries of 12 -> 24 bottles (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'persisted row after concurrent deliveries');
      // Delivery records must match stock: one batch order per successful delivery.
      const orders = await prisma.itemBatchOrder.count({ where: { productId: p.id } });
      assert(orders === 2, `exactly 2 delivery records for 2 concurrent deliveries (got ${orders})`);
      // Each returned snapshot is a consistent view at its transaction's
      // read time (one or both deliveries applied, depending on commit
      // interleaving) and must satisfy the crate invariant; the persisted
      // row reflects both deliveries.
      assertInvariant(a.updatedStock, 12, 'returned updatedStock (delivery A view)');
      assertInvariant(b.updatedStock, 12, 'returned updatedStock (delivery B view)');
      for (const [label, snap] of [['A', a.updatedStock], ['B', b.updatedStock]]) {
        assert(
          snap.quantityBottles === 12 || snap.quantityBottles === 24,
          `snapshot ${label} is a valid prefix state 12 or 24 (got ${snap.quantityBottles})`
        );
      }
      await prisma.itemBatchOrder.deleteMany({ where: { productId: p.id } });
    }

    // ============================================================
    console.log('\n--- 9. Sale failure rolls back the whole transaction ---');
    {
      const p = await makeProduct(12, 5, 0);
      let threw = null;
      try {
        await saleService.completeSale({
          soldById: user.id,
          items: [{ productId: p.id, quantityBottles: 10 }], // more than 5 in stock
        });
      } catch (e) {
        threw = e;
      }
      assert(!!threw && /Not enough stock/.test(threw.message), `overselling sale rejected (got: ${threw && threw.message})`);
      const final = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(final.quantityBottles === 5, `stock unchanged after failed sale (got ${final.quantityBottles})`);
      assertInvariant(final, 12, 'invariant holds after failed sale rollback');
      // The failed sale must not have persisted a Sale row (transaction rollback).
      const recentSale = await prisma.sale.findFirst({
        where: { soldById: user.id, items: { some: { productId: p.id } } },
        include: { items: true },
      });
      assert(!recentSale, 'no Sale row persisted for the rolled-back transaction');
    }

    // ============================================================
    console.log('\n--- 10. Failed delivery rolls back the batch order ---');
    {
      const p = await prisma.product.create({
        data: { name: `${PREFIX}NoStock`, unitPrice: 500, crateSize: 12 },
      });
      products.push(p.id); // no Stock row created
      let threw = null;
      try {
        await stockService.receiveBatchOrder({
          productId: p.id,
          receivedById: user.id,
          crateCount: 1,
          bottleCount: 0,
          costPerUnit: 100,
        });
      } catch (e) {
        threw = e;
      }
      assert(!!threw && /No stock record/.test(threw.message), `delivery without stock row rejected (got: ${threw && threw.message})`);
      const orders = await prisma.itemBatchOrder.count({ where: { productId: p.id } });
      assert(orders === 0, `batch order rolled back (got ${orders} rows)`);
    }

    // ============================================================
    console.log('\n--- 11. crateSize <= 0 / null: bottles only, crates untouched ---');
    {
      const pZero = await makeProduct(0, 10, 7);
      const r1 = await stockRepository.incrementBottlesAndCrates(pZero.id, 5, 0);
      assert(r1.quantityBottles === 15 && r1.quantityCrates === 7, `crateSize=0: bottles 15, crates untouched at 7 (got ${r1.quantityBottles}/${r1.quantityCrates})`);
      const r2 = await stockRepository.conditionalDecrementWithCrates(pZero.id, 3, 0);
      assert(r2 === 1 && r1.quantityBottles === 15, 'conditional decrement works without crateSize');
      const finalZero = await prisma.stock.findUnique({ where: { productId: pZero.id } });
      assert(finalZero.quantityBottles === 12 && finalZero.quantityCrates === 7, `crateSize=0 final: 12/7 (got ${finalZero.quantityBottles}/${finalZero.quantityCrates})`);

      const pNull = await makeProduct(null, 4, 2);
      const r3 = await stockRepository.incrementBottlesAndCrates(pNull.id, 8, null);
      assert(r3.quantityBottles === 12 && r3.quantityCrates === 2, `crateSize=null: bottles 12, crates untouched at 2 (got ${r3.quantityBottles}/${r3.quantityCrates})`);

      // Negative crateSize follows the same documented bottles-only policy
      // (never divides by a non-positive size).
      const pNeg = await makeProduct(-5, 6, 1);
      const r4 = await stockRepository.incrementBottlesAndCrates(pNeg.id, 3, -5);
      assert(r4.quantityBottles === 9 && r4.quantityCrates === 1, `crateSize=-5: bottles 9, crates untouched at 1 (got ${r4.quantityBottles}/${r4.quantityCrates})`);
      // NaN crateSize also falls back to bottles-only (no division by NaN).
      const r5 = await stockRepository.incrementBottlesAndCrates(pNeg.id, 1, NaN);
      assert(r5.quantityBottles === 10 && r5.quantityCrates === 1, `crateSize=NaN: bottles 10, crates untouched at 1 (got ${r5.quantityBottles}/${r5.quantityCrates})`);
    }

    // ============================================================
    console.log('\n--- 12. Missing stock row on increment -> P2025-style error ---');
    {
      const p = await prisma.product.create({
        data: { name: `${PREFIX}Missing`, unitPrice: 500, crateSize: 12 },
      });
      products.push(p.id); // no Stock row
      let threw = null;
      try {
        await stockRepository.incrementBottlesAndCrates(p.id, 5, 12);
      } catch (e) {
        threw = e;
      }
      assert(!!threw && threw.code === 'P2025', `missing stock row throws P2025-coded error (got: ${threw && (threw.code || threw.message)})`);

      // A conditional decrement against a missing row reports 0 affected
      // rows (never a false success); completeSale maps that to a 400.
      const affected = await stockRepository.conditionalDecrementWithCrates(p.id, 1, 12);
      assert(affected === 0, `conditional decrement on missing row returns 0 (got ${affected})`);
    }

    // ============================================================
    console.log('\n--- 13. Concurrent double-cancel restores stock exactly once ---');
    {
      const p = await makeProduct(12, 30, 2);
      const sale = await saleService.completeSale({
        soldById: user.id,
        items: [{ productId: p.id, quantityBottles: 6 }],
      });
      assert(sale.status === 'completed', 'sale created as completed');
      const stockAfterSale = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(stockAfterSale.quantityBottles === 24, `stock after sale = 24 (got ${stockAfterSale.quantityBottles})`);

      // Two concurrent cancellations of the SAME sale: the conditional
      // status transition inside the transaction must let exactly one win.
      const [c1, c2] = await Promise.allSettled([
        saleService.cancelSale(sale.id),
        saleService.cancelSale(sale.id),
      ]);
      const successes = [c1, c2].filter((r) => r.status === 'fulfilled').length;
      const rejections = [c1, c2].filter((r) => r.status === 'rejected');
      assert(successes === 1, `exactly one concurrent cancel succeeds (got ${successes})`);
      assert(
        rejections.length === 1 && /Only completed sales can be cancelled/.test(rejections[0].reason.message),
        `losing cancel rejected with cancellation-policy error (got: ${rejections[0] && rejections[0].reason.message})`
      );

      const finalSale = await prisma.sale.findUnique({ where: { id: sale.id } });
      assert(finalSale.status === 'cancelled', `sale ends cancelled (got ${finalSale.status})`);
      const finalStock = await prisma.stock.findUnique({ where: { productId: p.id } });
      assert(
        finalStock.quantityBottles === 30,
        `stock restored exactly once: 24 + 6 = 30 (got ${finalStock.quantityBottles})`
      );
      assertInvariant(finalStock, 12, 'invariant holds after concurrent double-cancel');
    }

    // ============================================================
    console.log('\n--- 14. Concurrent cancel + new sale on the same product ---');
    {
      const p = await makeProduct(12, 24, 2);
      const saleA = await saleService.completeSale({
        soldById: user.id,
        items: [{ productId: p.id, quantityBottles: 4 }],
      });
      // stock now 20
      // Cancel saleA concurrently with a NEW saleB of 5 bottles.
      const [, saleB] = await Promise.all([
        saleService.cancelSale(saleA.id),
        saleService.completeSale({
          soldById: user.id,
          items: [{ productId: p.id, quantityBottles: 5 }],
        }),
      ]);
      assert(saleB.status === 'completed', 'concurrent new sale completed');
      const finalStock = await prisma.stock.findUnique({ where: { productId: p.id } });
      // 24 - 4 (saleA) + 4 (cancelA) - 5 (saleB) = 19, regardless of order.
      assert(finalStock.quantityBottles === 19, `24 -4 +4 -5 = 19 bottles (got ${finalStock.quantityBottles})`);
      assertInvariant(finalStock, 12, 'invariant holds after concurrent cancel + sale');
    }

    // ============================================================
    console.log('\n========== StockConcurrency Summary ==========');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
  } finally {
    // Reliable cleanup of all data created by this suite.
    await prisma.saleItem.deleteMany({ where: { productId: { in: products } } }).catch(() => {});
    const sales = await prisma.sale.findMany({
      where: { items: { some: { productId: { in: products } } } },
      select: { id: true },
    }).catch(() => []);
    for (const s of sales) {
      await prisma.sale.delete({ where: { id: s.id } }).catch(() => {});
    }
    await prisma.itemBatchOrder.deleteMany({ where: { productId: { in: products } } }).catch(() => {});
    await prisma.stock.deleteMany({ where: { productId: { in: products } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: products } } }).catch(() => {});
    await prisma.$disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('StockConcurrency suite crashed:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
