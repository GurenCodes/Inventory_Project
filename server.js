// server.js
// Express server for the Floramagg Drinks Shop API layer
// Stage 1: bare server with health check
// Stage 2: auth login + JWT middleware
// Stage 3: Product and Stock routes (all authenticated)
// Stage 4: Sale routes
// Stage 5: Report routes
// Stage 6: centralized error handling

require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  UnauthorizedError,
  ForbiddenError,
  AppError 
} = require('./errors');

const authService = require('./UserManagement/Services/AuthService');
const userService = require('./UserManagement/Services/UserService');
const productService = require('./InventoryManagement/Services/ProductService');
const stockService = require('./InventoryManagement/Services/StockService');
const saleService = require('./InventoryManagement/Services/SaleService');
const reportService = require('./InventoryManagement/Services/ReportService');

const app = express();

// Login rate limiter (Stage 9)
// Limit: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests from counting
  skipSuccessfulRequests: true,
  // Use built-in key generator that handles IPv6 properly
  // keyGenerator: rateLimit.ipKeyGenerator, // Default, handles IPv6
  // Handler for when limit is exceeded
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many login attempts, please try again later' });
  },
});

// Security headers (Stage 9 - Helmet)
app.use(helmet({
  // Prevent framing - deny all framing (more secure than SAMEORIGIN)
  frameguard: { action: 'deny' },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS filter (legacy but harmless)
  xssFilter: true,
  // Referrer policy
  referrerPolicy: { policy: 'no-referrer' },
  // HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: false,
  },
  // Cross-origin policies
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
  // Expect-CT
  expectCt: false,
  // Feature policy / Permissions policy
  hidePoweredBy: true,
  ieNoOpen: true,
  noSniff: true,
  xssFilter: true,
}));

// CORS configuration (Stage 9) - Manual implementation for full control
// Allowed origins from environment variable, default to localhost for development
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Manual CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  const isAllowed = !origin || allowedOrigins.includes(origin);
  
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Max-Age', '86400');
  } else {
    // Origin not allowed - reject all requests
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (isAllowed) {
      return res.sendStatus(204);
    }
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }
  
  next();
});

app.use(express.json({ limit: '100kb' }));

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
// Rate limited: 5 attempts per 15 minutes per IP (Stage 9)
app.post('/auth/login', loginLimiter, async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
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
      throw new UnauthorizedError('Invalid email or password');
    }
    // For any other unexpected error
    next(err);
  }
});

// JWT Authentication Middleware (Stage 2)
// Verifies token and attaches user to request for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw new UnauthorizedError('Authentication token required');
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // All JWT verification failures are 401 (not authenticated)
      // 403 is for authenticated but forbidden (Stage 7)
      throw new UnauthorizedError('Invalid or expired token');
    }
    // Attach decoded user info (userId, role) to request
    req.user = decoded;
    next();
  });
}

// Role-based Authorization Middleware (Stage 7)
// Checks if the authenticated user has one of the required roles
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      throw new ForbiddenError('Role information missing');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  }
}

// ============================================
// PRODUCT ROUTES (Stage 3) - ALL AUTHENTICATED
// ============================================

// GET /products - list products with optional category filter and includeInactive
// Both Admin and Manager can view products
app.get('/products', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { category, includeInactive } = req.query;
  
  // Convert query params
  const categoryFilter = category || undefined;
  const includeInactiveFlag = includeInactive === 'true';
  
  let products;
  if (includeInactiveFlag) {
    products = await productService.listProducts(categoryFilter);
  } else {
    // Default: only active products
    products = await productService.listActiveProducts(categoryFilter);
  }
  
  res.json(products);
});

// POST /products - register a new product (Admin only)
app.post('/products', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { name, category, unitPrice, crateSize, reorderLevel } = req.body;
  
  const result = await productService.registerProduct({
    name,
    category,
    unitPrice,
    crateSize,
    reorderLevel,
  });
  
  res.status(201).json(result);
});

// POST /products/:id/discontinue - discontinue a product (Admin only)
app.post('/products/:id/discontinue', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const result = await productService.discontinueProduct(id);
  res.json(result);
});

// POST /products/:id/reactivate - reactivate a discontinued product (Admin only)
app.post('/products/:id/reactivate', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const result = await productService.restoreProduct(id);
  res.json(result);
});

// PUT /products/:id - update a product (Admin only)
app.put('/products/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const { name, category, unitPrice, crateSize, reorderLevel } = req.body;
  
  const result = await productService.updateProduct(id, {
    name,
    category,
    unitPrice,
    crateSize,
    reorderLevel,
  });
  
  res.json(result);
});

// GET /products/:id - get a product with its stock (Admin + Manager)
app.get('/products/:id', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const product = await productService.getProductWithStock(id);
  if (!product) {
    throw new NotFoundError(`Product ${id} not found`);
  }
  
  res.json(product);
});

// ============================================
// STOCK ROUTES (Stage 3) - ALL AUTHENTICATED
// ============================================

// GET /stock/low - list low stock products (Admin + Manager)
app.get('/stock/low', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const lowStock = await stockService.listLowStock();
  res.json(lowStock);
});

// POST /stock/receive - receive a batch order (log delivery + update stock) (Admin + Manager)
// receivedById comes from authenticated user, NOT client
app.post('/stock/receive', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { productId, crateCount, bottleCount, costPerUnit, expiryDate } = req.body;
  
  // receivedById comes from the authenticated user's token
  const receivedById = req.user.userId;
  
  const result = await stockService.receiveBatchOrder({
    productId,
    receivedById,
    crateCount,
    bottleCount,
    costPerUnit,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
  });
  
  res.status(201).json(result);
});

// GET /stock/:productId - get stock for a specific product (Admin + Manager)
app.get('/stock/:productId', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const stock = await stockService.getStockForProduct(productId);
  if (!stock) {
    throw new NotFoundError(`Stock for product ${productId} not found`);
  }
  
  res.json(stock);
});

// PUT /stock/:productId/reorder-level - adjust reorder level for a product (Admin only)
app.put('/stock/:productId/reorder-level', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const { reorderLevel } = req.body;
  if (reorderLevel === undefined || reorderLevel === null) {
    throw new ValidationError('Reorder level is required');
  }
  
  const result = await stockService.adjustReorderLevel(productId, reorderLevel);
  res.json(result);
});

// ============================================
// SALE ROUTES (Stage 4) - ALL AUTHENTICATED
// ============================================

// POST /sales - complete a sale (checkout) (Admin + Manager)
// soldById comes from authenticated user, NOT client
app.post('/sales', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { items } = req.body;
  
  // soldById comes from the authenticated user's token
  const soldById = req.user.userId;
  
  const result = await saleService.completeSale({
    soldById,
    items,
  });
  
  res.status(201).json(result);
});

// GET /sales - list sales with optional status filter (Admin + Manager)
app.get('/sales', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { status } = req.query;
  const sales = await saleService.listSales(status);
  res.json(sales);
});

// GET /sales/:id - get a specific sale by ID (Admin + Manager)
app.get('/sales/:id', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid sale ID');
  }
  
  const sale = await saleService.getSale(id);
  if (!sale) {
    throw new NotFoundError(`Sale ${id} not found`);
  }
  
  res.json(sale);
});

// POST /sales/:id/cancel - cancel a sale (Admin only)
app.post('/sales/:id/cancel', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid sale ID');
  }
  
  const result = await saleService.cancelSale(id);
  if (!result) {
    throw new NotFoundError(`Sale ${id} not found`);
  }
  
  res.json(result);
});

// ============================================
// REPORT ROUTES (Stage 5) - ALL AUTHENTICATED
// ============================================

// POST /reports/daily - generate a daily report (Admin + Manager)
// generatedById comes from authenticated user, NOT client
app.post('/reports/daily', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { date } = req.body;
  
  // generatedById comes from the authenticated user's token
  const generatedById = req.user.userId;
  
  const result = await reportService.generateDailyReport({
    date,
    generatedById,
  });
  
  res.status(201).json(result);
});

// GET /reports/:date - get a specific daily report by date (Admin + Manager)
app.get('/reports/:date', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const date = req.params.date;
  
  // Validate date format
  const reportDate = new Date(date);
  if (isNaN(reportDate.getTime())) {
    throw new ValidationError('Invalid date format');
  }
  
  const report = await reportService.getReportByDate(date);
  if (!report) {
    throw new NotFoundError(`Report for ${date} not found`);
  }
  
  res.json(report);
});

// GET /reports - list reports with start and end date range (both required) (Admin + Manager)
app.get('/reports', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { start, end } = req.query;
  
  if (!start || !end) {
    throw new ValidationError('Start and end dates are required');
  }
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ValidationError('Invalid start or end date format');
  }
  
  const reports = await reportService.listReports(startDate, endDate);
  res.json(reports);
});

// ============================================
// USER MANAGEMENT ROUTES (Stage 8) - ADMIN ONLY
// ============================================

// POST /users - create a new user (Admin only)
app.post('/users', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { fullName, email, password, role } = req.body;
  
  const result = await userService.createUser({
    fullName,
    email,
    password,
    role,
  });
  
  res.status(201).json(result);
});

// GET /users - list all users (Admin only)
app.get('/users', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { role } = req.query;
  
  const users = await userService.listUsers(role);
  res.json(users);
});

// GET /users/:id - get a user by ID (Admin only)
app.get('/users/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }
  
  const user = await userService.getUserById(id);
  if (!user) {
    throw new NotFoundError(`User ${id} not found`);
  }
  
  res.json(user);
});

// PUT /users/:id/password - update a user's password (Admin only)
app.put('/users/:id/password', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }
  
  const { password } = req.body;
  if (!password) {
    throw new ValidationError('New password is required');
  }
  
  const result = await userService.updatePassword(id, password);
  // Never return passwordHash to the caller
  const { passwordHash, ...safeUser } = result;
  res.json(safeUser);
});

// Unknown route handler - must be after all defined routes
app.use((req, res, next) => {
  throw new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
});

// Centralized error handling middleware
// Express 5: rejected promises in async route handlers are automatically forwarded here
app.use((err, req, res, next) => {
  // Prisma unique constraint violation (P2002) - duplicate key
  if (err.code === 'P2002') {
    return res.status(400).json({ error: 'A record with this value already exists' });
  }
  
  // Prisma record not found (P2025)
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  
  // Prisma foreign key constraint violation (P2003)
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  
  // Request body too large (express.json limit)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  
  // Known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  
  // Unexpected server error
  console.error('Unexpected error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

// Export middleware for use in future stages
module.exports = { app, authenticateToken };

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}