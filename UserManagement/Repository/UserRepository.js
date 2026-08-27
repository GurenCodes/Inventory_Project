// repositories/userRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class UserRepository {
  // Create a new user
  async create(data) {
    // data = { fullName, email, passwordHash, role }
    return prisma.user.create({ data });
  }

  // Find one user by id
  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  // Find one user by email (useful for login)
  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  // Get all users, optionally filtered by role
  async findAll(role) {
    return prisma.user.findMany({
      where: role ? { role } : undefined,
    });
  }

  // Update a user's fields
  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete a user
  async delete(id) {
    return prisma.user.delete({
      where: { id },
    });
  }

  // Get a user along with their sales, batch orders, and daily reports
  async findByIdWithRelations(id) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        sales: true,
        batchOrders: true,
        dailyReports: true,
      },
    });
  }
}

module.exports = new UserRepository();