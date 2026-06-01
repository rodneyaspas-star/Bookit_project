const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/timeslots/:service_id - Get available time slots for a service
router.get('/:service_id', async (req, res) => {
  try {
    const { service_id } = req.params;
    const { date, start_date, end_date } = req.query;

    let query = `
      SELECT * FROM time_slots 
      WHERE service_id = $1 AND is_booked = false
    `;
    const params = [service_id];

    if (date) {
      query += ` AND DATE(start_time) = $2`;
      params.push(date);
    } else if (start_date && end_date) {
      query += ` AND DATE(start_time) BETWEEN $2 AND $3`;
      params.push(start_date, end_date);
    } else {
      // Default to future slots only
      query += ` AND start_time > CURRENT_TIMESTAMP`;
    }

    query += ` ORDER BY start_time`;

    const timeSlots = await db.any(query, params);

    res.json({ timeSlots });
  } catch (error) {
    console.error('Get time slots error:', error);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
});

// POST /api/timeslots - Add time slots (business only)
router.post('/', authMiddleware, requireRole('business'), [
  body('service_id').isInt().withMessage('Valid service ID is required'),
  body('start_time').isISO8601().withMessage('Valid start time is required'),
  body('end_time').isISO8601().withMessage('Valid end time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { service_id, start_time, end_time } = req.body;

    // Verify service belongs to user's business
    const service = await db.oneOrNone(
      `SELECT s.* FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1 AND b.user_id = $2`,
      [service_id, req.user.id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check for overlapping time slots
    const overlap = await db.oneOrNone(
      `SELECT id FROM time_slots 
       WHERE service_id = $1 
       AND (
         (start_time <= $2 AND end_time > $2) OR
         (start_time < $3 AND end_time >= $3) OR
         (start_time >= $2 AND end_time <= $3)
       )`,
      [service_id, start_time, end_time]
    );

    if (overlap) {
      return res.status(400).json({ error: 'Time slot overlaps with existing slot' });
    }

    const timeSlot = await db.one(
      `INSERT INTO time_slots (service_id, start_time, end_time)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [service_id, start_time, end_time]
    );

    res.status(201).json({
      message: 'Time slot created successfully',
      timeSlot
    });
  } catch (error) {
    console.error('Create time slot error:', error);
    res.status(500).json({ error: 'Failed to create time slot' });
  }
});

// POST /api/timeslots/bulk - Add multiple time slots (business only)
router.post('/bulk', authMiddleware, requireRole('business'), [
  body('service_id').isInt().withMessage('Valid service ID is required'),
  body('slots').isArray({ min: 1 }).withMessage('At least one time slot is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { service_id, slots } = req.body;

    // Verify service belongs to user's business
    const service = await db.oneOrNone(
      `SELECT s.* FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1 AND b.user_id = $2`,
      [service_id, req.user.id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (slots.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 slots per request' });
    }

    const now = new Date();
    for (const slot of slots) {
      const start = new Date(slot.start_time);
      const end = new Date(slot.end_time);
      if (start <= now) return res.status(400).json({ error: 'All slots must be in the future' });
      if (start >= end) return res.status(400).json({ error: 'start_time must be before end_time' });
    }

    const { pgp } = db.$config;
    const cs = new pgp.helpers.ColumnSet(['service_id', 'start_time', 'end_time'], { table: 'time_slots' });
    const rows = slots.map(slot => ({ service_id, start_time: slot.start_time, end_time: slot.end_time }));
    await db.none(pgp.helpers.insert(rows, cs));

    res.status(201).json({
      message: `${slots.length} time slots created successfully`
    });
  } catch (error) {
    console.error('Bulk create time slots error:', error);
    res.status(500).json({ error: 'Failed to create time slots' });
  }
});

// DELETE /api/timeslots/:id - Delete time slot (business only)
router.delete('/:id', authMiddleware, requireRole('business'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify time slot belongs to user's business and is not booked
    const timeSlot = await db.oneOrNone(
      `SELECT ts.* FROM time_slots ts
       JOIN services s ON ts.service_id = s.id
       JOIN businesses b ON s.business_id = b.id
       WHERE ts.id = $1 AND b.user_id = $2`,
      [id, req.user.id]
    );

    if (!timeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    if (timeSlot.is_booked) {
      return res.status(400).json({ error: 'Cannot delete booked time slot' });
    }

    await db.none('DELETE FROM time_slots WHERE id = $1', [id]);

    res.json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    console.error('Delete time slot error:', error);
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
});

module.exports = router;
