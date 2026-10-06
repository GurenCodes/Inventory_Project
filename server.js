// server.js
// Express server for the Floramagg Drinks Shop API layer
// Stage 1: bare server with health check
// Stage 2: auth login + JWT middleware

require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');

const authService = require('./UserManagement/Services/AuthService');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set in environment');
  process.exit(1);
}

// Health check endpoint (Stage 1)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST /auth/login (Stage 2)
// Accepts email/password, returns JWT + user info on success
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await authService.login(email, password);

    // Generate JWT with user id and role (no password/hash)
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    // AuthService throws "Invalid email or password" for both missing user and wrong password
    if (err.message === 'Invalid email or password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    // For any other unexpected error
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// JWT Authentication Middleware (Stage 2)
// Verifies token and attaches user to request for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    // Attach decoded user info (userId, role) to request
    req.user = decoded;
    next();
  });
}

// Export middleware for use in future stages
module.exports = { app, authenticateToken };

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}