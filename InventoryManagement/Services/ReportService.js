// InventoryManagement/Service/ReportService.js
const dailyReportRepository = require('../Repository/Report');
const saleRepository = require('../Repository/Sale');

class ReportService {
  // Pulls every completed sale for the given date, sums the totals,
  // and saves that as a DailyReport row.
  async generateDailyReport({ date, generatedById }) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await saleRepository.findByDateRange(startOfDay, endOfDay);
    const completedSales = sales.filter((s) => s.status === 'completed');

    const totalSalesAmount = completedSales.reduce(
      (sum, sale) => sum + Number(sale.totalAmount),
      0
    );

    // reportDate is @unique in the schema, so this will fail if a report
    // for this exact date already exists — decide whether to update
    // instead if you re-run this for the same day.
    return dailyReportRepository.create({
      reportDate: startOfDay,
      generatedById,
      totalSalesAmount,
    });
  }

  async getReportByDate(date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return dailyReportRepository.findByDate(day);
  }

  async listReports(startDate, endDate) {
    return dailyReportRepository.findByDateRange(startDate, endDate);
  }
}

module.exports = new ReportService();
