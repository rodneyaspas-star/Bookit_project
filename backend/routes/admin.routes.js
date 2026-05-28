const express = require('express');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const escrow = require('../services/escrow.service');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.one(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'customer')          AS total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'business')          AS total_businesses,
        (SELECT COUNT(*) FROM businesses WHERE is_approved = true)    AS approved_businesses,
        (SELECT COUNT(*) FROM bookings)                               AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'completed')    AS completed_bookings,
        (SELECT COALESCE(SUM(total_price),0) FROM bookings WHERE status = 'completed') AS total_revenue,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open')         AS open_disputes
    `);
    res.json({ stats });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/businesses
router.get('/businesses', async (req, res) => {
  try {
    const { is_approved, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';

    if (is_approved !== undefined) {
      where = ' WHERE b.is_approved = $1';
      params.push(is_approved === 'true');
    }

    params.push(limit, offset);
    const businesses = await db.any(
      `SELECT b.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
       FROM businesses b
       JOIN users u ON b.user_id = u.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ businesses });
  } catch (err) {
    console.error('Admin get businesses error:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// PUT /api/admin/businesses/:id — approve or revoke
router.put('/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;
    if (typeof is_approved !== 'boolean')
      return res.status(400).json({ error: 'is_approved must be a boolean' });

    const business = await db.oneOrNone('SELECT id FROM businesses WHERE id = $1', [id]);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    await db.none(
      'UPDATE businesses SET is_approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [is_approved, id]
    );
    res.json({ message: is_approved ? 'Business approved' : 'Business approval revoked' });
  } catch (err) {
    console.error('Admin update business error:', err);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

// DELETE /api/admin/businesses/:id
router.delete('/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const business = await db.oneOrNone('SELECT id FROM businesses WHERE id = $1', [id]);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    await db.none('DELETE FROM businesses WHERE id = $1', [id]);
    res.json({ message: 'Business removed successfully' });
  } catch (err) {
    console.error('Admin delete business error:', err);
    res.status(500).json({ error: 'Failed to remove business' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';

    if (role) {
      where = ' WHERE role = $1';
      params.push(role);
    }

    params.push(limit, offset);
    const users = await db.any(
      `SELECT id, name, email, role, phone, created_at FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ users });
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.oneOrNone('SELECT id, role FROM users WHERE id = $1', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin users' });
    await db.none('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User removed successfully' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// GET /api/admin/revenue-by-business
router.get('/revenue-by-business', async (req, res) => {
  try {
    const rows = await db.any(`
      SELECT
        bus.id   AS business_id,
        bus.name AS business_name,
        COALESCE(SUM(b.total_price), 0) AS revenue,
        COUNT(b.id)                     AS completed_bookings
      FROM businesses bus
      LEFT JOIN bookings b ON b.business_id = bus.id AND b.status = 'completed'
      GROUP BY bus.id, bus.name
      ORDER BY revenue DESC, business_name ASC
    `);
    res.json({ revenue: rows });
  } catch (err) {
    console.error('Admin revenue error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue breakdown' });
  }
});

// GET /api/admin/bookings
router.get('/bookings', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';

    if (status) {
      where = ' WHERE b.status = $1';
      params.push(status);
    }

    params.push(limit, offset);
    const bookings = await db.any(
      `SELECT
         b.id, b.status, b.total_price, b.created_at,
         u.name  AS customer_name, u.email AS customer_email,
         bus.name AS business_name,
         s.service_name,
         COALESCE(ts.start_time, (b.requested_date + b.requested_time)::timestamptz) AS start_time,
         COALESCE(ts.end_time, NULL) AS end_time
       FROM bookings b
       JOIN users u             ON b.customer_id = u.id
       JOIN businesses bus      ON b.business_id = bus.id
       JOIN services s          ON b.service_id  = s.id
       LEFT JOIN time_slots ts  ON b.timeslot_id = ts.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ bookings });
  } catch (err) {
    console.error('Admin get bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/admin/disputes
router.get('/disputes', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';

    if (status) {
      const allowed = ['open', 'resolved_provider', 'resolved_customer'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      where = ' WHERE d.status = $1';
      params.push(status);
    }

    const disputes = await db.any(
      `SELECT
         d.id, d.booking_id, d.reason, d.status, d.admin_notes,
         d.created_at, d.resolved_at,
         opener.name   AS opened_by_name,
         resolver.name AS resolved_by_name,
         b.total_price, b.status AS booking_status,
         cust.name     AS customer_name,
         bus.name      AS business_name,
         s.service_name
       FROM disputes d
       JOIN bookings b       ON d.booking_id  = b.id
       JOIN users opener     ON d.opened_by   = opener.id
       LEFT JOIN users resolver ON d.resolved_by = resolver.id
       JOIN users cust       ON b.customer_id = cust.id
       JOIN businesses bus   ON b.business_id = bus.id
       JOIN services s       ON b.service_id  = s.id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    );
    res.json({ disputes });
  } catch (err) {
    console.error('Admin get disputes error:', err);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// POST /api/admin/disputes/:id/release — resolve in favour of provider
router.post('/disputes/:id/release', async (req, res) => {
  try {
    const { admin_notes } = req.body;
    const details = await escrow.adminReleaseEscrow(
      parseInt(req.params.id),
      req.user.id,
      admin_notes || null
    );
    res.json({ message: 'Dispute resolved. Escrow released to provider.', booking: details });
  } catch (err) {
    console.error('Admin release dispute error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to release escrow' });
  }
});

// POST /api/admin/disputes/:id/refund — resolve in favour of customer
router.post('/disputes/:id/refund', async (req, res) => {
  try {
    const { admin_notes } = req.body;
    const details = await escrow.adminRefundCustomer(
      parseInt(req.params.id),
      req.user.id,
      admin_notes || null
    );
    res.json({ message: 'Dispute resolved. Escrow refunded to customer.', booking: details });
  } catch (err) {
    console.error('Admin refund dispute error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to process refund' });
  }
});

// GET /api/admin/transactions/:bookingId — full audit trail for a booking
router.get('/transactions/:bookingId', async (req, res) => {
  try {
    const events = await db.any(
      `SELECT t.action, t.from_state, t.to_state, t.amount, t.notes, t.created_at,
              u.name AS actor_name
       FROM transactions t
       JOIN users u ON t.actor_id = u.id
       WHERE t.booking_id = $1
       ORDER BY t.created_at ASC`,
      [req.params.bookingId]
    );
    res.json({ transactions: events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction log' });
  }
});

module.exports = router;
