/* ============================================
   GST INVOICE GENERATOR — Express Server
   With Session-Based Authentication & Firestore
   ============================================ */

const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Session setup
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ===== STATIC FILES (publicly accessible) =====
const publicDir = path.join(process.cwd(), 'public');

function sendPublicFile(res, fileName) {
  const filePath = path.join(publicDir, fileName);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`Error sending file ${filePath}:`, err);
      if (!res.headersSent) {
        res.status(500).send(`Error loading ${fileName}: ${err.message}. process.cwd()=${process.cwd()}, __dirname=${__dirname}`);
      }
    }
  });
}

app.get(['/login', '/login.html'], (req, res) => {
  sendPublicFile(res, 'login.html');
});
app.get('/login.css', (req, res) => {
  sendPublicFile(res, 'login.css');
});
app.get(['/share', '/share.html'], (req, res) => {
  sendPublicFile(res, 'share.html');
});
app.get('/share.css', (req, res) => {
  sendPublicFile(res, 'share.css');
});
app.get('/share.js', (req, res) => {
  sendPublicFile(res, 'share.js');
});

// ===== AUTH ROUTES (public — no auth required) =====

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!db.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;

    res.json({
      success: true,
      user: { id: user.id, username: user.username, display_name: user.display_name },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// GET /api/auth/check — check if user is authenticated
app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: { id: req.session.userId, username: req.session.username, display_name: req.session.displayName },
    });
  }
  res.json({ authenticated: false });
});

// ===== AUTH MIDDLEWARE — Protect everything below =====
function requireAuth(req, res, next) {
  // Allow public API endpoints
  if (req.path.startsWith('/api/public/')) {
    return next();
  }

  if (req.session && req.session.userId) {
    return next();
  }

  // For API routes, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // For page requests, redirect to login
  return res.redirect('/login');
}

// Protect all remaining routes
app.use(requireAuth);

// Serve static files (only for authenticated users)
app.use(express.static(publicDir));

// ===== CHANGE PASSWORD =====
app.put('/api/auth/password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (new_password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  try {
    const user = await db.getUserByUsername(req.session.username);
    if (!user || !db.verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await db.changePassword(user.id, new_password);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== BUSINESS CONFIG ROUTES =====

app.get('/api/business', async (req, res) => {
  try { res.json(await db.getBusinessConfig()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/business', async (req, res) => {
  try {
    await db.updateBusinessConfig(req.body);
    res.json(await db.getBusinessConfig());
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== PRODUCTS ROUTES =====

app.get('/api/products', async (req, res) => {
  try { res.json(await db.getProducts()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = await db.addProduct(req.body);
    res.status(201).json(product);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.updateProduct(id, req.body);
    res.json(await db.getProductById(id));
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await db.deleteProduct(parseInt(req.params.id));
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== CUSTOMERS ROUTES =====

app.get('/api/customers', async (req, res) => {
  try { res.json(await db.getCustomers()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const cust = await db.getCustomerById(parseInt(req.params.id));
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    res.json(cust);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/customers', async (req, res) => {
  try {
    const customer = await db.addCustomer(req.body);
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.updateCustomer(id, req.body);
    res.json(await db.getCustomerById(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await db.deleteCustomer(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== DASHBOARD ROUTE =====

app.get('/api/dashboard', async (req, res) => {
  try { res.json(await db.getDashboardData()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== INVOICES ROUTES =====

app.get('/api/invoices', async (req, res) => {
  try { res.json(await db.getInvoices()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/invoices/next-number', async (req, res) => {
  try { res.json({ invoice_number: await db.getNextInvoiceNumber() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await db.getInvoiceById(parseInt(req.params.id));
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invoices', async (req, res) => {
  try { res.status(201).json(await db.saveInvoice(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    await db.deleteInvoice(parseInt(req.params.id));
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== SHARING ROUTES =====
app.post('/api/invoices/:id/share', async (req, res) => {
  try {
    const token = await db.generateShareToken(parseInt(req.params.id));
    if (!token) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ share_token: token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/public/invoices/:token', async (req, res) => {
  try {
    const invoice = await db.getInvoiceByShareToken(req.params.token);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found or link expired' });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== START SERVER =====
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ✨ InvoiceGST Server running at http://localhost:${PORT}\n`);
  });
}

// Expose the Express app as a Firebase Cloud Function (2nd Gen)
const { onRequest } = require('firebase-functions/v2/https');
exports.api = onRequest({ cors: true, maxInstances: 10 }, app);

// Export Express app for Vercel
module.exports = app;
