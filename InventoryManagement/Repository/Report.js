// repositories/dailyReportRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DailyReportRepository {
  async create(data) {
    // data = { reportDate, generatedById, totalSalesAmount }
    return prisma.dailyReport.create({ data });
  }

  async findById(id) {
    return prisma.dailyReport.findUnique({
      where: { id },
    });
  }

  // DailyReport has one row per date, so this is the common lookup
  async findByDate(date) {
    return prisma.dailyReport.findUnique({
      where: { reportDate: date },
    });
  }

  async findAll() {
    return prisma.dailyReport.findMany({
      orderBy: { reportDate: 'desc' },
    });
  }

  // Reports within a date range
  async findByDateRange(startDate, endDate) {
    return prisma.dailyReport.findMany({
      where: {
        reportDate: { gte: startDate, lte: endDate },
      },
      orderBy: { reportDate: 'asc' },
    });
  }

  async update(id, data) {
    return prisma.dailyReport.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.dailyReport.delete({
      where: { id },
    });
  }
}

module.exports = new DailyReportRepository();