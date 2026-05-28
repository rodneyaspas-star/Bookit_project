const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { sendBookingRequested } = require('../utils/email');
const escrow = require('../services/escrow.service');

const router = express.Router();

const ALL_STATUSES = [
  'pending_provider_approval',
  'awaiting_payment',
  'booked',
  'awaiting_confirmation',
  'completed',
  'disputed',
  'cancelled',
  'rejected',
];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings — customer submits a booking request
// Creates booking in pending_provider_approval; provider must accept before payment.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, requireRole('customer'), [
  body('business_id').isInt({ min: 1 }).withMessage('Valid business ID is required'),
  body('service_id').isInt({ min: 1 }).withMessage('Valid service ID is required'),
  body('requested_date').isISO8601().withMessage('Valid date is required').custom(value => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requested = new Date(value);
    if (requested <= today) throw new Error('Requested date must be in the future');
    return true;
  }),
  body('requested_time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Valid time in HH:MM format is required'),
  body('customer_notes').optional().trim().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { business_id, service_id, requested_date, requested_time, customer_notes } = req.body;
    const customer_id = req.user.id;

    const result = await db.tx(async t => {
      const business = await t.oneOrNone(
        'SELECT id, is_approved FROM businesses WHERE id = $1',
        [business_id]
      );
      if (!business) throw Object.assign(new Error('Business not found'), { status: 404 });
      if (!business.is_approved) throw Object.assign(new Error('Business is not yet approved'), { status: 400 });

      const service = await t.oneOrNone(
        'SELECT id, price, service_name FROM services WHERE id = $1 AND business_id = $2 AND is_active = true',
        [service_id, business_id]
      );
      if (!service) throw Object.assign(new Error('Service not found for this business'), { status: 404 });

      const booking = await t.one(
        `INSERT INTO bookings
           (customer_id, business_id, service_id, timeslot_id, requested_date, requested_time, customer_notes, total_price, status)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, 'pending_provider_approval')
         RETURNING *`,
        [customer_id, business_id, service_id, requested_date, requested_time, customer_notes || null, service.price]
      );

      // Payment record created immediately with escrow_status = 'none'
      await t.none(
        `INSERT INTO payments (booking_id, amount, escrow_status, payment_method)
         VALUES ($1, $2, 'none', 'simulated')`,
        [booking.id, service.price]
      );

      await t.none(
        `INSERT INTO transactions (booking_id, actor_id, action, from_state, to_state, notes)
         VALUES ($1, $2, 'booking_requested', null, 'pending_provider_approval', 'Customer submitted booking request')`,
        [booking.id, customer_id]
      );

      return escrow.getFullBookingDetails(t, booking.id);
    });

    setImmediate(() => sendBookingRequested({
      customerName: result.customer_name,
      businessEmail: result.business_email,
      businessOwnerName: result.business_owner_name,
      businessName: result.business_name,
      serviceName: result.service_name,
      startTime: result.start_time,
      endTime: result.end_time,
      totalPrice: result.total_price,
      bookingId: result.id,
    }).catch(e => console.error('Email error:', e)));

    res.status(201).json({
      message: 'Booking request submitted. Awaiting provider approval.',
      booking: result,
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create booking' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/customer/my — must be before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/customer/my', authMiddleware, requireRole('customer'), async (req, res) => {
  try {
    const { status } = req.query;
    const params = [req.user.id];
    let statusClause = '';

    if (status) {
      if (!ALL_STATUSES.includes(status))
        return res.status(400).json({ error: 'Invalid status filter' });
      statusClause = ' AND b.status = $2';
      params.push(status);
    }

    const bookings = await db.any(
      `SELECT
         b.id, b.status, b.total_price, b.created_at,
         bus.name AS business_name, bus.city,
         s.service_name, s.duration,
         COALESCE(ts.start_time, (b.requested_date + b.requested_time)::timestamptz) AS start_time,
         COALESCE(ts.end_time, NULL) AS end_time,
         p.escrow_status
       FROM bookings b
       JOIN businesses bus      ON b.business_id = bus.id
       JOIN services s          ON b.service_id  = s.id
       LEFT JOIN time_slots ts  ON b.timeslot_id = ts.id
       LEFT JOIN payments p     ON b.id = p.booking_id
       WHERE b.customer_id = $1${statusClause}
       ORDER BY b.created_at DESC`,
      params
    );

    res.json({ bookings });
  } catch (err) {
    console.error('Get customer bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/business/:business_id — must be before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/business/:business_id', authMiddleware, requireRole('business'), async (req, res) => {
  try {
    const { business_id } = req.params;
    const { status } = req.query;

    const business = await db.oneOrNone(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [business_id, req.user.id]
    );
    if (!business) return res.status(403).json({ error: 'Access denied' });

    const params = [business_id];
    let statusClause = '';

    if (status) {
      if (!ALL_STATUSES.includes(status))
        return res.status(400).json({ error: 'Invalid status filter' });
      statusClause = ' AND b.status = $2';
      params.push(status);
    }

    const bookings = await db.any(
      `SELECT
         b.id, b.status, b.customer_notes, b.total_price, b.created_at,
         u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
         s.service_name, s.duration,
         COALESCE(ts.start_time, (b.requested_date + b.requested_time)::timestamptz) AS start_time,
         COALESCE(ts.end_time, NULL) AS end_time,
         p.escrow_status
       FROM bookings b
       JOIN users u             ON b.customer_id = u.id
       JOIN services s          ON b.service_id  = s.id
       LEFT JOIN time_slots ts  ON b.timeslot_id = ts.id
       LEFT JOIN payments p     ON b.id = p.booking_id
       WHERE b.business_id = $1${statusClause}
       ORDER BY b.created_at DESC`,
      params
    );

    res.json({ bookings });
  } catch (err) {
    console.error('Get business bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const details = await escrow.getFullBookingDetails(db, bookingId);
    if (!details) return res.status(404).json({ error: 'Booking not found' });

    const isCustomer = details.customer_id === req.user.id;
    const isOwner    = details.business_owner_id === req.user.id;
    const isAdmin    = req.user.role === 'admin';
    if (!isCustomer && !isOwner && !isAdmin)
      return res.status(403).json({ error: 'Access denied' });

    const reviewRow = await db.oneOrNone(
      'SELECT id FROM reviews WHERE booking_id = $1 LIMIT 1',
      [bookingId]
    );
    res.json({ booking: { ...details, has_review: !!reviewRow } });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings/:id/accept — provider accepts a pending request
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/accept', authMiddleware, requireRole('business'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const details = await escrow.acceptBooking(bookingId, req.user.id);
    res.json({ message: 'Booking accepted. Customer has been notified to complete payment.', booking: details });
  } catch (err) {
    console.error('Accept booking error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to accept booking' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings/:id/reject — provider rejects a pending request
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/reject', authMiddleware, requireRole('business'), [
  body('reason').optional().trim().isLength({ max: 500 }),
], async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { reason } = req.body;
    const details = await escrow.rejectBooking(bookingId, req.user.id, reason || null);
    res.json({ message: 'Booking rejected. Customer has been notified.', booking: details });
  } catch (err) {
    console.error('Reject booking error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reject booking' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings/:id/complete — provider marks service as done
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/complete', authMiddleware, requireRole('business'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const details = await escrow.markComplete(bookingId, req.user.id);
    res.json({ message: 'Service marked complete. Awaiting customer confirmation.', booking: details });
  } catch (err) {
    console.error('Mark complete error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to mark service complete' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/bookings/:id/cancel — customer, provider, or admin cancels
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const result = await escrow.cancelBooking(bookingId, req.user.id, req.user.role);
    res.json({
      message: result.wasRefunded
        ? 'Booking cancelled and escrow refunded.'
        : 'Booking cancelled.',
      ...result,
    });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to cancel booking' });
  }
});

module.exports = router;
