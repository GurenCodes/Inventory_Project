// UserManagement/Service/UserService.js
const bcrypt = require('bcrypt');
const userRepository = require('../Repository/UserRepository');
const { ValidationError } = require('../../errors');

const SALT_ROUNDS = 10;

class UserService {
  // Hash a plain-text password using bcrypt
  async hashPassword(plainPassword) {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new ValidationError('Password is required and must be a string');
    }
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  // Create a new user with a hashed password
  async createUser({ fullName, email, password, role = 'MANAGER' }) {
    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      throw new ValidationError('Full name is required');
    }
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new ValidationError('Email is required');
    }
    if (!password || typeof password !== 'string' || password.length < 1) {
      throw new ValidationError('Password is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ValidationError('Email already in use');
    }

    const passwordHash = await this.hashPassword(password);

    const user = await userRepository.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });

    // Never return passwordHash to the caller
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  // Update a user's password (hashes the new password)
  async updatePassword(userId, newPassword) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 1) {
      throw new ValidationError('New password is required');
    }
    const passwordHash = await this.hashPassword(newPassword);
    return userRepository.update(userId, { passwordHash });
  }

  // Verify a plain-text password against a stored hash
  async verifyPassword(plainPassword, passwordHash) {
    if (!plainPassword || !passwordHash) {
      return false;
    }
    return bcrypt.compare(plainPassword, passwordHash);
  }

  // Get user by ID (without password hash)
  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Get user by email (without password hash)
  async getUserByEmail(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // List all users (without password hashes)
  async listUsers(role) {
    const users = await userRepository.findAll(role);
    return users.map(({ passwordHash, ...safeUser }) => safeUser);
  }
}

module.exports = new UserService();