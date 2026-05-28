const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/businesses - List all businesses or search/filter
router.get('/', async (req, res) => {
  try {
    const { category, city, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT b.*, u.name as owner_name, u.email as owner_email
      FROM businesses b
      JOIN users u ON b.user_id = u.id
      WHERE b.is_approved = true
    `;
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND LOWER(b.category) = LOWER($${paramCount})`;
      params.push(category);
      paramCount++;
    }

    if (city) {
      query += ` AND LOWER(b.city) = LOWER($${paramCount})`;
      params.push(city);
      paramCount++;
    }

    if (search) {
      query += ` AND (LOWER(b.name) LIKE LOWER($${paramCount}) OR LOWER(b.description) LIKE LOWER($${paramCount}))`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY b.rating DESC, b.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const businesses = await db.any(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM businesses WHERE is_approved = true';
    const countParams = [];
    let countParamNum = 1;

    if (category) {
      countQuery += ` AND LOWER(category) = LOWER($${countParamNum})`;
      countParams.push(category);
      countParamNum++;
    }

    if (city) {
      countQuery += ` AND LOWER(city) = LOWER($${countParamNum})`;
      countParams.push(city);
      countParamNum++;
    }

    if (search) {
      countQuery += ` AND (LOWER(name) LIKE LOWER($${countParamNum}) OR LOWER(description) LIKE LOWER($${countParamNum}))`;
      countParams.push(`%${search}%`);
    }

    const totalCount = await db.one(countQuery, countParams);

    res.json({
      businesses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCount.count)
      }
    });
  } catch (error) {
    console.error('Get businesses error:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// GET /api/businesses/my/profile - Get current user's business
// MUST be defined before /:id so Express does not swallow it as id='my'
router.get('/my/profile', authMiddleware, requireRole('business'), async (req, res) => {
  try {
    const business = await db.oneOrNone(
      'SELECT * FROM businesses WHERE user_id = $1',
      [req.user.id]
    );

    if (!business) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    const services = await db.any(
      'SELECT * FROM services WHERE business_id = $1',
      [business.id]
    );

    res.json({ ...business, services });
  } catch (error) {
    console.error('Get my business error:', error);
    res.status(500).json({ error: 'Failed to fetch business profile' });
  }
});

// GET /api/businesses/:id - Get business by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const business = await db.oneOrNone(
      `SELECT b.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone
       FROM businesses b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1 AND b.is_approved = true`,
      [id]
    );

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Get services for this business
    const services = await db.any(
      'SELECT * FROM services WHERE business_id = $1 AND is_active = true ORDER BY price',
      [id]
    );

    res.json({ ...business, services });
  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// POST /api/businesses - Create or update business profile
router.post('/', authMiddleware, requireRole('business'), [
  body('name').trim().notEmpty().withMessage('Business name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('description').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('zip_code').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, address, city, state, zip_code, category, contact_info, image_url } = req.body;
    const userId = req.user.id;

    // Check if business already exists for this user
    const existingBusiness = await db.oneOrNone(
      'SELECT id FROM businesses WHERE user_id = $1',
      [userId]
    );

    let business;

    if (existingBusiness) {
      // Update existing business
      business = await db.one(
        `UPDATE businesses 
         SET name = $1, description = $2, address = $3, city = $4, state = $5, 
             zip_code = $6, category = $7, contact_info = $8, image_url = $9, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $10
         RETURNING *`,
        [name, description, address, city, state, zip_code, category, contact_info, image_url, userId]
      );
    } else {
      // Create new business - auto-approve
      business = await db.one(
        `INSERT INTO businesses (user_id, name, description, address, city, state, zip_code, category, contact_info, image_url, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
         RETURNING *`,
        [userId, name, description, address, city, state, zip_code, category, contact_info, image_url]
      );
    }

    res.status(201).json({
      message: existingBusiness ? 'Business updated successfully' : 'Business created successfully',
      business
    });
  } catch (error) {
    console.error('Create/update business error:', error);
    res.status(500).json({ error: 'Failed to save business' });
  }
});

module.exports = router;
