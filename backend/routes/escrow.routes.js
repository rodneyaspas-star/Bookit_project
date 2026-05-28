const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const escrow = require('../services/escrow.service');

const router = express.Router();

// GET /api/escrow/status/:bookingId
// Returns full booking detail + transaction log + dispute for the booking detail page.
router.get('/status/:bookingId', authMiddleware, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const details = await escrow.getFullBookingDetails(db, bookingId);
    if (!details) return res.status(404).json({ error: 'Booking not found' });

    const isCustomer = details.customer_id === req.user.id;
    const isOwner    = details.business_owner_id === req.user.id;
    const isAdmin    = req.user.role === 'admin';
    if (!isCustomer && !isOwner && !isAdmin)
      return res.status(403).json({ error: 'Access denied' });

    const transactions = await db.any(
      `SELECT t.action, t.from_state, t.to_state, t.amount, t.notes, t.created_at,
              u.name AS actor_name
       FROM transactions t
       JOIN users u ON t.actor_id = u.id
       WHERE t.booking_id = $1
       ORDER BY t.created_at ASC`,
      [bookingId]
    );

    const dispute = await db.oneOrNone(
      'SELECT * FROM disputes WHERE booking_id = $1',
      [bookingId]
    );

    res.json({ booking: details, events: transactions, dispute: dispute || null });
  } catch (err) {
    console.error('Escrow status error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch escrow status' });
  }
});

// POST /api/escrow/simulate/:bookingId  (also aliased as /api/payments/simulate/:bookingId via server.js)
// Customer pays — only allowed after provider has accepted (awaiting_payment state).
router.post('/simulate/:bookingId', authMiddleware, requireRole('customer'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const details = await escrow.simulatePayment(bookingId, req.user.id);
    res.json({ message: 'Payment simulated. Funds are now held in escrow.', booking: details });
  } catch (err) {
    console.error('Simulate payment error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to simulate payment' });
  }
});

// POST /api/escrow/release/:bookingId
// Customer confirms service and releases escrow to provider.
router.post('/release/:bookingId', authMiddleware, requireRole('customer'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const details = await escrow.releaseEscrow(bookingId, req.user.id);
    res.json({ message: 'Payment released. Booking marked complete.', booking: details });
  } catch (err) {
    console.error('Release escrow error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to release escrow' });
  }
});

// POST /api/escrow/dispute/:bookingId
// Customer opens a dispute — requires at least 10-char reason.
router.post('/dispute/:bookingId', authMiddleware, requireRole('customer'), [
  body('reason').trim().isLength({ min: 10 }).withMessage('Dispute reason must be at least 10 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const bookingId = parseInt(req.params.bookingId);
    const details = await escrow.openDispute(bookingId, req.user.id, req.body.reason);
    res.json({ message: 'Dispute opened. Admin will review.', booking: details });
  } catch (err) {
    console.error('Open dispute error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to open dispute' });
  }
});

module.exports = router;
