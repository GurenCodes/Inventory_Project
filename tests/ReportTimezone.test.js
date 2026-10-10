// tests/ReportTimezone.test.js
// Business-calendar (Africa/Douala, UTC+1) boundary tests for daily reports.
// A business day YYYY-MM-DD covers the half-open UTC interval
// [local midnight, next local midnight) = [23:00Z previous day, 23:00Z).
// Exits non-zero on any failure.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const prisma = require('../lib/prisma');
const reportService = require('../InventoryManagement/Services/ReportService');
const {
  BUSINESS_TZ,
  businessDayBounds,
  todayBusinessDate,
} = require('../lib/businessTime');

const PREFIX = `TZTEST_${Date.now()}_`;

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

async function main() {
  console.log(`=== Report timezone tests (business zone: ${BUSINESS_TZ}) ===\n`);

  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash(`${PREFIX}pass`, 4);
  const user = await prisma.user.create({
    data: { fullName: `${PREFIX}User`, email: `${PREFIX.toLowerCase()}u@test.local`, passwordHash: hash, role: 'MANAGER' },
  });
  const product = await prisma.product.create({
    data: { name: `${PREFIX}Prod`, unitPrice: 500, crateSize: 12 },
  });
  await prisma.stock.create({
    data: { productId: product.id, quantityBottles: 0, quantityCrates: 0, reorderLevel: 0 },
  });

  const saleIds = [];
  const reportIds = [];

  async function makeSale(isoInstant, status, amount) {
    const s = await prisma.sale.create({
      data: {
        soldById: user.id,
        totalAmount: amount,
        status,
        createdAt: new Date(isoInstant),
        items: {
          create: { productId: product.id, quantityBottles: 1, unitPrice: amount, lineTotal: amount },
        },
      },
    });
    saleIds.push(s.id);
    return s;
  }

  try {
    // ============================================================
    console.log('--- 1. businessDayBounds math (Africa/Douala = UTC+1) ---');
    const b = businessDayBounds('2026-10-10');
    assert(!!b, 'bounds for 2026-10-10 resolve');
    assert(b.start.toISOString() === '2026-10-09T23:00:00.000Z',
      `start = 2026-10-09T23:00Z (got ${b.start.toISOString()})`);
    assert(b.end.toISOString() === '2026-10-10T23:00:00.000Z',
      `end (exclusive) = 2026-10-10T23:00Z (got ${b.end.toISOString()})`);
    assert(b.storageDate.toISOString() === '2026-10-10T00:00:00.000Z',
      `storage date = 2026-10-10T00:00Z (got ${b.storageDate.toISOString()})`);
    const boundsDate = new Date('2026-07-10T00:00:00Z');
    const b2 = businessDayBounds(boundsDate);
    assert(b2.start.toISOString() === '2026-07-09T23:00:00.000Z' && b2.end.toISOString() === '2026-07-10T23:00:00.000Z',
      'Date input (UTC calendar date) maps to the same Douala day');
    assert(businessDayBounds('not-a-date') === null, 'invalid input returns null');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(todayBusinessDate()), `todayBusinessDate is YYYY-MM-DD (got ${todayBusinessDate()})`);

    // ============================================================
    console.log('\n--- 2. Boundary sales around local midnight (2026-07-10 Douala day) ---');
    const day = '2026-07-10';
    await prisma.dailyReport.deleteMany({ where: { reportDate: businessDayBounds(day).storageDate } });

    // 22:30Z on Jul 10 = 23:30 local Jul 10 -> INSIDE the business day
    await makeSale('2026-07-10T22:30:00.000Z', 'completed', 1000);
    // 22:59:59.999Z on Jul 10 = 23:59:59.999 local Jul 10 -> INSIDE (last ms)
    await makeSale('2026-07-10T22:59:59.999Z', 'completed', 2000);
    // 23:00:00Z on Jul 10 = 00:00 local Jul 11 -> OUTSIDE (exactly next-day start)
    await makeSale('2026-07-10T23:00:00.000Z', 'completed', 4000);
    // Cancelled sale inside the day -> excluded from the total
    await makeSale('2026-07-10T12:00:00.000Z', 'cancelled', 8000);
    // Pending sale inside the day -> excluded
    await makeSale('2026-07-10T13:00:00.000Z', 'pending', 16000);

    const report = await reportService.generateDailyReport({ date: day, generatedById: user.id });
    reportIds.push(report.id);
    assert(Number(report.totalSalesAmount) === 3000,
      `Jul 10 total = 1000 + 2000 = 3000, boundary 23:00Z excluded, cancelled/pending excluded (got ${report.totalSalesAmount})`);
    assert(report.reportDate.toISOString() === '2026-07-10T00:00:00.000Z',
      `reportDate stored at UTC midnight of the calendar date (got ${report.reportDate.toISOString()})`);

    // ============================================================
    console.log('\n--- 3. The 23:00Z sale belongs to the NEXT business day ---');
    const nextDay = '2026-07-11';
    await prisma.dailyReport.deleteMany({ where: { reportDate: businessDayBounds(nextDay).storageDate } });
    const nextReport = await reportService.generateDailyReport({ date: nextDay, generatedById: user.id });
    reportIds.push(nextReport.id);
    assert(Number(nextReport.totalSalesAmount) === 4000,
      `Jul 11 total = 4000 (the exact-next-day-start sale only) (got ${nextReport.totalSalesAmount})`);

    // ============================================================
    console.log('\n--- 4. Date-only string input matches Date input ---');
    const strDay = '2026-07-09';
    await prisma.dailyReport.deleteMany({ where: { reportDate: businessDayBounds(strDay).storageDate } });
    await makeSale('2026-07-09T10:00:00.000Z', 'completed', 500);
    // A sale at 2026-07-08T23:30Z is local Jul 9 00:30 -> belongs to Jul 9
    await makeSale('2026-07-08T23:30:00.000Z', 'completed', 700);
    const strReport = await reportService.generateDailyReport({ date: strDay, generatedById: user.id });
    reportIds.push(strReport.id);
    assert(Number(strReport.totalSalesAmount) === 1200,
      `"${strDay}" includes sales from the previous UTC evening (local after midnight) (got ${strReport.totalSalesAmount})`);

    // ============================================================
    console.log('\n--- 5. Generation and retrieval agree ---');
    const fetched = await reportService.getReportByDate(day);
    assert(!!fetched && fetched.id === report.id, 'getReportByDate(date-only string) returns the generated report');
    const fetchedAsDate = await reportService.getReportByDate(new Date('2026-07-10T00:00:00Z'));
    assert(!!fetchedAsDate && fetchedAsDate.id === report.id, 'getReportByDate(Date) returns the same report');

    // ============================================================
    console.log('\n--- 6. Future-date validation uses the business calendar ---');
    let threw = null;
    try {
      await reportService.generateDailyReport({
        date: '2099-01-01',
        generatedById: user.id,
      });
    } catch (e) {
      threw = e;
    }
    assert(!!threw && /future date/.test(threw.message), `far-future date rejected (got: ${threw && threw.message})`);

    // Tomorrow in the business calendar must be rejected too.
    const [ty, tm, td] = todayBusinessDate().split('-').map(Number);
    const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10);
    threw = null;
    try {
      await reportService.generateDailyReport({ date: tomorrow, generatedById: user.id });
    } catch (e) {
      threw = e;
    }
    assert(!!threw && /future date/.test(threw.message), `tomorrow (${tomorrow}, business calendar) rejected (got: ${threw && threw.message})`);

    // Today (business calendar) must not be rejected as future. If a report
    // for today already exists (shared DB), the expected error is the unique
    // constraint — never delete pre-existing data to make this pass.
    const existingToday = await reportService.getReportByDate(todayBusinessDate());
    if (existingToday) {
      threw = null;
      try {
        await reportService.generateDailyReport({ date: todayBusinessDate(), generatedById: user.id });
      } catch (e) {
        threw = e;
      }
      assert(!!threw && (/Unique|unique|already/.test(threw.message)),
        `today (${todayBusinessDate()}) not rejected as future; unique-constraint surfaced instead (got: ${threw && threw.message})`);
    } else {
      const todayRep = await reportService.generateDailyReport({
        date: todayBusinessDate(),
        generatedById: user.id,
      });
      reportIds.push(todayRep.id);
      assert(!!todayRep.id, `today (${todayBusinessDate()}) accepted, not treated as future`);
    }

    // ============================================================
    console.log('\n--- 7. Invalid date inputs ---');
    threw = null;
    try {
      await reportService.generateDailyReport({ date: 'not-a-date', generatedById: user.id });
    } catch (e) {
      threw = e;
    }
    assert(!!threw && /Invalid date/.test(threw.message), `"not-a-date" rejected (got: ${threw && threw.message})`);
    const nullBounds = await reportService.getReportByDate('not-a-date');
    assert(nullBounds === null, 'getReportByDate(invalid) returns null');

    console.log(`\n=== Summary: Passed: ${passed}, Failed: ${failed} ===`);
  } finally {
    for (const id of reportIds) {
      await prisma.dailyReport.delete({ where: { id } }).catch(() => {});
    }
    await prisma.dailyReport.deleteMany({ where: { generatedById: user.id } }).catch(() => {});
    await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } }).catch(() => {});
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } }).catch(() => {});
    await prisma.saleItem.deleteMany({ where: { productId: product.id } }).catch(() => {});
    await prisma.stock.deleteMany({ where: { productId: product.id } }).catch(() => {});
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await prisma.$disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('ReportTimezone suite crashed:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
