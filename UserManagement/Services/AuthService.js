// UserManagement/Service/AuthService.js
const userRepository = require('../Repository/UserRepository');
const userService = require('./UserService');
const { ValidationError, UnauthorizedError } = require('../../errors');

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await userService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Never return passwordHash to the caller
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Simple permission check: only ADMIN can do certain things
  isAdmin(user) {
    return user.role === 'ADMIN';
  }

  isManager(user) {
    return user.role === 'MANAGER';
  }
}

module.exports = new AuthService();