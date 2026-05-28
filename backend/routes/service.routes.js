const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/services/:business_id - Get services for a business
router.get('/:business_id', async (req, res) => {
  try {
    const { business_id } = req.params;

    const services = await db.any(
      'SELECT * FROM services WHERE business_id = $1 AND is_active = true ORDER BY price',
      [business_id]
    );

    res.json({ services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST /api/services - Add new service
router.post('/', authMiddleware, requireRole('business'), [
  body('service_name').trim().notEmpty().withMessage('Service name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { service_name, description, price, duration } = req.body;

    // Get business ID for current user
    const business = await db.oneOrNone(
      'SELECT id FROM businesses WHERE user_id = $1',
      [req.user.id]
    );

    if (!business) {
      return res.status(404).json({ error: 'Business profile not found. Please create a business profile first.' });
    }

    const service = await db.one(
      `INSERT INTO services (business_id, service_name, description, price, duration)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [business.id, service_name, description, price, duration]
    );

    res.status(201).json({
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT /api/services/:id - Update service
router.put('/:id', authMiddleware, requireRole('business'), [
  body('service_name').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('duration').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { service_name, description, price, duration, is_active } = req.body;

    // Verify service belongs to user's business
    const service = await db.oneOrNone(
      `SELECT s.* FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1 AND b.user_id = $2`,
      [id, req.user.id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const updatedService = await db.one(
      `UPDATE services 
       SET service_name = COALESCE($1, service_name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           duration = COALESCE($4, duration),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [service_name, description, price, duration, is_active, id]
    );

    res.json({
      message: 'Service updated successfully',
      service: updatedService
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id - Delete service (soft delete)
router.delete('/:id', authMiddleware, requireRole('business'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify service belongs to user's business
    const service = await db.oneOrNone(
      `SELECT s.* FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1 AND b.user_id = $2`,
      [id, req.user.id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    await db.none(
      'UPDATE services SET is_active = false WHERE id = $1',
      [id]
    );

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
