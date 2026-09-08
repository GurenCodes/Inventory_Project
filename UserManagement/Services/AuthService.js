// UserManagement/Service/AuthService.js
const userRepository = require('../Repository/UserRepository');

// NOTE: your seed data currently stores plain-text strings in passwordHash
// (e.g. 'temporary123'), not real hashes. Before this goes anywhere near
// real users, install bcrypt and hash passwords on creation, then compare
// with bcrypt.compare() here instead of a direct string check.
// npm install bcrypt

class AuthService {
  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // TEMPORARY plain-text check — replace with bcrypt.compare(password, user.passwordHash)
    const isValid = password === user.passwordHash;
    if (!isValid) {
      throw new Error('Invalid email or password');
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
