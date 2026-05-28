require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes     = require('./routes/auth.routes');
const businessRoutes = require('./routes/business.routes');
const serviceRoutes  = require('./routes/service.routes');
const timeslotRoutes = require('./routes/timeslot.routes');
const bookingRoutes  = require('./routes/booking.routes');
const adminRoutes    = require('./routes/admin.routes');
const reviewRoutes   = require('./routes/review.routes');
const escrowRoutes   = require('./routes/escrow.routes');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(require('helmet')());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(require('hpp')());
app.use(morgan('dev'));

// General rate limit
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', generalLimiter);

// Stricter limit on auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts, try again later' } });
app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);

// Routes
app.use('/api/auth',       authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/services',   serviceRoutes);
app.use('/api/timeslots',  timeslotRoutes);
app.use('/api/bookings',   bookingRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/reviews',    reviewRoutes);
app.use('/api/escrow',     escrowRoutes);
app.use('/api/payments',   escrowRoutes); // alias: /api/payments/simulate/:id

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
