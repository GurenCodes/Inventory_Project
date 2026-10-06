// server.js
// Express server for the Floramagg Drinks Shop API layer
// Stage 1: bare server with health check
// Stage 2: auth login + JWT middleware
// Stage 3: Product and Stock routes (all authenticated)

require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');

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

// ============================================
// PRODUCT ROUTES (Stage 3) - ALL AUTHENTICATED
// ============================================

// GET /products - list products with optional category filter and includeInactive
app.get('/products', authenticateToken, async (req, res) => {
  try {
    const { category, includeInactive } = req.query;
    
    // Convert query params
    const categoryFilter = category || undefined;
    const includeInactiveFlag = includeInactive === 'true';
    
    let products;
    if (includeInactiveFlag) {
      // listProducts doesn't support includeInactive, need to use listActiveProducts when false
      // Actually listProducts returns all, listActiveProducts returns only active
      // For includeInactive=true, we need all products
      // The service has listProducts (all) and listActiveProducts (only active)
      products = await productService.listProducts(categoryFilter);
    } else {
      // Default: only active products
      products = await productService.listActiveProducts(categoryFilter);
    }
    
    res.json(products);
  } catch (err) {
    console.error('GET /products error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /products - register a new product
app.post('/products', authenticateToken, async (req, res) => {
  try {
    const { name, category, unitPrice, crateSize, reorderLevel } = req.body;
    
    const result = await productService.registerProduct({
      name,
      category,
      unitPrice,
      crateSize,
      reorderLevel,
    });
    
    res.status(201).json(result);
  } catch (err) {
    // Validation/business rule errors from Service
    if (err.message.includes('required') || 
        err.message.includes('must be') || 
        err.message.includes('cannot be empty')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /products error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /products/:id/discontinue - discontinue a product
app.post('/products/:id/discontinue', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const result = await productService.discontinueProduct(id);
    res.json(result);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('required') || err.message.includes('must be')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /products/:id/discontinue error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /products/:id/reactivate - reactivate a discontinued product
app.post('/products/:id/reactivate', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const result = await productService.restoreProduct(id);
    res.json(result);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('required') || err.message.includes('must be')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /products/:id/reactivate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// STOCK ROUTES (Stage 3) - ALL AUTHENTICATED
// ============================================

// GET /stock/low - list low stock products
app.get('/stock/low', authenticateToken, async (req, res) => {
  try {
    const lowStock = await stockService.listLowStock();
    res.json(lowStock);
  } catch (err) {
    console.error('GET /stock/low error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stock/receive - receive a batch order (log delivery + update stock)
// receivedById comes from authenticated user, NOT client
app.post('/stock/receive', authenticateToken, async (req, res) => {
  try {
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
  } catch (err) {
    // Validation/business rule errors from Service
    if (err.message.includes('required') || 
        err.message.includes('must be') || 
        err.message.includes('does not exist') ||
        err.message.includes('greater than zero')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /stock/receive error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// SALE ROUTES (Stage 4) - ALL AUTHENTICATED
// ============================================

// POST /sales - complete a sale (checkout)
// soldById comes from authenticated user, NOT client
app.post('/sales', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    
    // soldById comes from the authenticated user's token
    const soldById = req.user.userId;
    
    const result = await saleService.completeSale({
      soldById,
      items,
    });
    
    res.status(201).json(result);
  } catch (err) {
    // Validation/business rule errors from Service
    if (err.message.includes('required') || 
        err.message.includes('must be') || 
        err.message.includes('does not exist') ||
        err.message.includes('discontinued') ||
        err.message.includes('Not enough stock') ||
        err.message.includes('at least one item') ||
        err.message.includes('productId') ||
        err.message.includes('quantityBottles') ||
        err.message.includes('unitPrice')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /sales error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /sales - list sales with optional status filter
app.get('/sales', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const sales = await saleService.listSales(status);
    res.json(sales);
  } catch (err) {
    console.error('GET /sales error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /sales/:id - get a specific sale by ID
app.get('/sales/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }
    
    const sale = await saleService.getSale(id);
    if (!sale) {
      return res.status(404).json({ error: `Sale ${id} not found` });
    }
    
    res.json(sale);
  } catch (err) {
    console.error('GET /sales/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sales/:id/cancel - cancel a sale
app.post('/sales/:id/cancel', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid sale ID' });
  }
  
  try {
    const result = await saleService.cancelSale(id);
    if (!result) {
      return res.status(404).json({ error: `Sale ${id} not found` });
    }
    
    res.json(result);
  } catch (err) {
    // Prisma throws P2025 when record not found
    if (err.code === 'P2025' || err.message.includes('not found') || err.message.includes('Record to update not found')) {
      return res.status(404).json({ error: `Sale ${id} not found` });
    }
    console.error('POST /sales/:id/cancel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// REPORT ROUTES (Stage 5) - ALL AUTHENTICATED
// ============================================

// POST /reports/daily - generate a daily report
// generatedById comes from authenticated user, NOT client
app.post('/reports/daily', authenticateToken, async (req, res) => {
  try {
    const { date } = req.body;
    
    // generatedById comes from the authenticated user's token
    const generatedById = req.user.userId;
    
    const result = await reportService.generateDailyReport({
      date,
      generatedById,
    });
    
    res.status(201).json(result);
  } catch (err) {
    // Validation/business rule errors from Service
    if (err.message.includes('required') || 
        err.message.includes('Invalid date') ||
        err.message.includes('future date')) {
      return res.status(400).json({ error: err.message });
    }
    // Prisma unique constraint error (P2002) for duplicate reportDate
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A report for this date already exists' });
    }
    console.error('POST /reports/daily error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/:date - get a specific daily report by date
app.get('/reports/:date', authenticateToken, async (req, res) => {
  try {
    const date = req.params.date;
    
    // Validate date format
    const reportDate = new Date(date);
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const report = await reportService.getReportByDate(date);
    if (!report) {
      return res.status(404).json({ error: `Report for ${date} not found` });
    }
    
    res.json(report);
  } catch (err) {
    console.error('GET /reports/:date error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports - list reports with start and end date range (both required)
app.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid start or end date format' });
    }
    
    const reports = await reportService.listReports(startDate, endDate);
    res.json(reports);
  } catch (err) {
    console.error('GET /reports error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export middleware for use in future stages
module.exports = { app, authenticateToken };

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}