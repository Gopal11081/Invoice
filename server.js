/* ============================================
   GST INVOICE GENERATOR — Express Server
   With Session-Based Authentication & Firestore
   ============================================ */

require('dotenv').config();

const express = require('express');
const session = require('cookie-session');
const path = require('path');
const db = require('./db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Vercel) to support secure cookies over HTTPS
app.set('trust proxy', 1);

// Setup Nodemailer Transporter
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

let transporter = null;
if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
  console.log(`✉️ Nodemailer SMTP transporter initialized with host: ${smtpHost}`);
} else {
  console.log(`⚠️ SMTP environment variables not configured. Reset links will be logged to the server console.`);
}

// Middleware
app.use(express.json());

app.use(session({
  name: 'invoice-gst-session',
  keys: [process.env.SESSION_SECRET || 'invoice-gst-session-secret-key-12345'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  httpOnly: true, // Prevents client-side script access to session cookie
  secure: process.env.NODE_ENV === 'production', // Only transmit cookie over HTTPS in production
  sameSite: 'lax' // Mitigate CSRF risks
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
app.get(['/register', '/register.html'], (req, res) => {
  sendPublicFile(res, 'register.html');
});
app.get('/register.css', (req, res) => {
  sendPublicFile(res, 'register.css');
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
app.get(['/forgot-password', '/forgot-password.html'], (req, res) => {
  sendPublicFile(res, 'forgot-password.html');
});
app.get(['/reset-password', '/reset-password.html'], (req, res) => {
  sendPublicFile(res, 'reset-password.html');
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

    // Check if account is active
    const isActive = user.is_active !== false;
    if (!isActive) {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact the administrator.' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;
    req.session.role = user.role || (user.username === 'aishu' ? 'admin' : 'staff');

    res.json({
      success: true,
      user: { id: user.id, username: user.username, display_name: user.display_name, role: req.session.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, display_name, email, mobile } = req.body;

  if (!username || !password || !display_name) {
    return res.status(400).json({ error: 'Username, password and display name are required' });
  }

  let normalizedMobile = '';
  if (mobile) {
    normalizedMobile = mobile.replace(/\D/g, '');
    if (normalizedMobile.length === 12 && normalizedMobile.startsWith('91')) {
      normalizedMobile = normalizedMobile.substring(2);
    } else if (normalizedMobile.length === 11 && normalizedMobile.startsWith('0')) {
      normalizedMobile = normalizedMobile.substring(1);
    }
    if (!/^\d{10}$/.test(normalizedMobile)) {
      return res.status(400).json({ error: 'Mobile number must be a valid 10-digit number' });
    }
  }

  if (!email && !normalizedMobile) {
    return res.status(400).json({ error: 'Either Email Address or Mobile Number is required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  try {
    const existing = await db.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    if (email) {
      const existingEmail = await db.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email address is already registered' });
      }
    }

    const newUser = await db.registerUser({ username, password, display_name, email, mobile: normalizedMobile });
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please wait for the administrator to activate your account.',
      user: newUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// GET /api/auth/check — check if user is authenticated
app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: { id: req.session.userId, username: req.session.username, display_name: req.session.displayName, role: req.session.role },
    });
  }
  res.json({ authenticated: false });
});

// GET /api/public/debug-db — debug endpoint to verify Firestore connection status
app.get('/api/public/debug-db', async (req, res) => {
  res.json(await db.getInitStatus());
});

// POST /api/public/log-error — frontend error logging
app.post('/api/public/log-error', (req, res) => {
  console.log('\n🔴 [FRONTEND ERROR]:', JSON.stringify(req.body, null, 2), '\n');
  res.sendStatus(200);
});

// ===== PASSWORD RESET PUBLIC APIS =====

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'No user account found with that email address' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await db.saveResetToken(user.id, token, expiry);

    const host = req.get('host');
    const protocol = req.protocol;
    const resetUrl = `${protocol}://${host}/reset-password.html?token=${token}&email=${encodeURIComponent(user.email)}`;

    console.log(`\n🔑 [PASSWORD RESET LINK FOR ${user.username}]: ${resetUrl}\n`);

    let emailSent = false;
    if (transporter) {
      const mailOptions = {
        from: `"InvoiceGST Support" <${smtpFrom}>`,
        to: user.email,
        subject: 'Reset your InvoiceGST Password',
        html: `
          <div style="font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; padding: 2.5rem 2rem; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(148, 163, 184, 0.1);">
            <h2 style="color: #38bdf8; margin-bottom: 1.5rem; text-align: center;">Reset your Password</h2>
            <p>Hi ${user.display_name || user.username},</p>
            <p>We received a request to reset the password for your InvoiceGST account. Click the button below to set a new password. This link is valid for 15 minutes.</p>
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; text-decoration: none; padding: 0.85rem 2rem; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 16px rgba(99,102,241,0.3);">Reset Password</a>
            </div>
            <p style="font-size: 0.8rem; color: #64748b;">If you did not request this, please ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid rgba(148, 163, 184, 0.1); margin: 2rem 0;" />
            <p style="font-size: 0.75rem; color: #64748b; text-align: center;">InvoiceGST Professional Billing System</p>
          </div>
        `
      };
      await transporter.sendMail(mailOptions);
      emailSent = true;
    }

    res.json({
      success: true,
      message: emailSent
        ? 'A password reset link has been sent to your registered email address.'
        : 'Password reset link generated. (Check server logs in development)',
      debugUrl: transporter ? null : resetUrl
    });
  } catch (err) {
    console.error('Error in forgot-password:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, token, password } = req.body;

  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Email, token and new password are required' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  try {
    const isValid = await db.validateResetToken(email, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    await db.resetUserPassword(email, password);
    res.json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Error in reset-password:', err);
    res.status(500).json({ error: err.message });
  }
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

app.put('/api/business', requireAdmin, async (req, res) => {
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

// ===== ADMIN USER CONTROL ROUTES =====
function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
}

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    res.json(await db.getAllUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { is_active } = req.body;
    
    if (userId === 1 || userId === 7 || req.params.id === '1' || req.params.id === '7') {
      return res.status(400).json({ error: 'Cannot modify admin user status.' });
    }
    
    await db.updateUserStatus(userId, is_active);
    res.json({ success: true, message: 'User status updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    
    if (userId === 1 || userId === 7 || req.params.id === '1' || req.params.id === '7') {
      return res.status(400).json({ error: 'Cannot modify system admin role.' });
    }
    
    if (role !== 'admin' && role !== 'staff') {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    
    await db.updateUserRole(userId, role);
    res.json({ success: true, message: 'User role updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== START SERVER =====
if (require.main === module) {
  const startServer = (port) => {
    const server = app.listen(port, () => {
      console.log(`\n  ✨ InvoiceGST Server running at http://localhost:${port}\n`);
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${port} is already in use. Trying fallback port ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  };
  
  startServer(PORT);
}

// Expose the Express app as a Firebase Cloud Function (2nd Gen)
const { onRequest } = require('firebase-functions/v2/https');
exports.api = onRequest({ cors: true, maxInstances: 10 }, app);

// Export Express app for Vercel
module.exports = app;
