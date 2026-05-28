const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/reviews - Create a review
router.post('/', authMiddleware, [
  body('booking_id').isInt().withMessage('Valid booking ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { booking_id, rating, comment } = req.body;
    const customer_id = req.user.id;

    // Verify booking exists and belongs to user and is completed
    const booking = await db.oneOrNone(
      'SELECT * FROM bookings WHERE id = $1 AND customer_id = $2 AND status = $3',
      [booking_id, customer_id, 'completed']
    );

    if (!booking) {
      return res.status(404).json({ error: 'Completed booking not found' });
    }

    // Check if review already exists
    const existingReview = await db.oneOrNone(
      'SELECT id FROM reviews WHERE booking_id = $1',
      [booking_id]
    );

    if (existingReview) {
      return res.status(400).json({ error: 'Review already submitted for this booking' });
    }

    // Start transaction
    await db.tx(async t => {
      // Create review
      const review = await t.one(
        `INSERT INTO reviews (booking_id, business_id, customer_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [booking_id, booking.business_id, customer_id, rating, comment]
      );

      // Update business rating
      const businessStats = await t.one(
        `SELECT 
           COALESCE(AVG(rating), 0) as avg_rating,
           COUNT(*) as total_reviews
         FROM reviews
         WHERE business_id = $1`,
        [booking.business_id]
      );

      await t.none(
        `UPDATE businesses 
         SET rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [businessStats.avg_rating, businessStats.total_reviews, booking.business_id]
      );

      return review;
    }).then(review => {
      res.status(201).json({
        message: 'Review submitted successfully',
        review
      });
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /api/reviews/business/:business_id - Get reviews for a business
router.get('/business/:business_id', async (req, res) => {
  try {
    const { business_id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const reviews = await db.any(
      `SELECT 
         r.id, r.rating, r.comment, r.created_at,
         u.name as customer_name
       FROM reviews r
       JOIN users u ON r.customer_id = u.id
       WHERE r.business_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [business_id, limit, offset]
    );

    // Get total count
    const totalCount = await db.one(
      'SELECT COUNT(*) FROM reviews WHERE business_id = $1',
      [business_id]
    );

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCount.count)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/my - Get customer's reviews
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const reviews = await db.any(
      `SELECT 
         r.id, r.rating, r.comment, r.created_at,
         b.name as business_name,
         s.service_name
       FROM reviews r
       JOIN businesses b ON r.business_id = b.id
       JOIN bookings bk ON r.booking_id = bk.id
       JOIN services s ON bk.service_id = s.id
       WHERE r.customer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    res.json({ reviews });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
