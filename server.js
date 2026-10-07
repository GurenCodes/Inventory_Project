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

const { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  UnauthorizedError,
  ForbiddenError,
  AppError 
} = require('./errors');

const authService = require('./UserManagement/Services/AuthService');
const productService = require('./InventoryManagement/Services/ProductService');
const stockService = require('./InventoryManagement/Services/StockService');
const saleService = require('./InventoryManagement/Services/SaleService');
const reportService = require('./InventoryManagement/Services/ReportService');

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
app.post('/auth/login', async (req, res, next) => {
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

// ============================================
// PRODUCT ROUTES (Stage 3) - ALL AUTHENTICATED
// ============================================

// GET /products - list products with optional category filter and includeInactive
app.get('/products', authenticateToken, async (req, res) => {
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

// POST /products - register a new product
app.post('/products', authenticateToken, async (req, res) => {
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

// POST /products/:id/discontinue - discontinue a product
app.post('/products/:id/discontinue', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const result = await productService.discontinueProduct(id);
  res.json(result);
});

// POST /products/:id/reactivate - reactivate a discontinued product
app.post('/products/:id/reactivate', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid product ID');
  }
  
  const result = await productService.restoreProduct(id);
  res.json(result);
});

// ============================================
// STOCK ROUTES (Stage 3) - ALL AUTHENTICATED
// ============================================

// GET /stock/low - list low stock products
app.get('/stock/low', authenticateToken, async (req, res) => {
  const lowStock = await stockService.listLowStock();
  res.json(lowStock);
});

// POST /stock/receive - receive a batch order (log delivery + update stock)
// receivedById comes from authenticated user, NOT client
app.post('/stock/receive', authenticateToken, async (req, res) => {
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

// ============================================
// SALE ROUTES (Stage 4) - ALL AUTHENTICATED
// ============================================

// POST /sales - complete a sale (checkout)
// soldById comes from authenticated user, NOT client
app.post('/sales', authenticateToken, async (req, res) => {
  const { items } = req.body;
  
  // soldById comes from the authenticated user's token
  const soldById = req.user.userId;
  
  const result = await saleService.completeSale({
    soldById,
    items,
  });
  
  res.status(201).json(result);
});

// GET /sales - list sales with optional status filter
app.get('/sales', authenticateToken, async (req, res) => {
  const { status } = req.query;
  const sales = await saleService.listSales(status);
  res.json(sales);
});

// GET /sales/:id - get a specific sale by ID
app.get('/sales/:id', authenticateToken, async (req, res) => {
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

// POST /sales/:id/cancel - cancel a sale
app.post('/sales/:id/cancel', authenticateToken, async (req, res) => {
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

// POST /reports/daily - generate a daily report
// generatedById comes from authenticated user, NOT client
app.post('/reports/daily', authenticateToken, async (req, res) => {
  const { date } = req.body;
  
  // generatedById comes from the authenticated user's token
  const generatedById = req.user.userId;
  
  const result = await reportService.generateDailyReport({
    date,
    generatedById,
  });
  
  res.status(201).json(result);
});

// GET /reports/:date - get a specific daily report by date
app.get('/reports/:date', authenticateToken, async (req, res) => {
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

// GET /reports - list reports with start and end date range (both required)
app.get('/reports', authenticateToken, async (req, res) => {
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