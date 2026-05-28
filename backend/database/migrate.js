require('dotenv').config();
const db = require('../config/database');

// Drop all tables in dependency order, then recreate fresh.
// Safe for development — run `node migrate.js` then `node seed.js` for a clean slate.
const dropStatements = [
  'DROP TABLE IF EXISTS transactions CASCADE',
  'DROP TABLE IF EXISTS escrow_events CASCADE',
  'DROP TABLE IF EXISTS disputes CASCADE',
  'DROP TABLE IF EXISTS reviews CASCADE',
  'DROP TABLE IF EXISTS payments CASCADE',
  'DROP TABLE IF EXISTS bookings CASCADE',
  'DROP TABLE IF EXISTS time_slots CASCADE',
  'DROP TABLE IF EXISTS services CASCADE',
  'DROP TABLE IF EXISTS businesses CASCADE',
  'DROP TABLE IF EXISTS users CASCADE',
];

const createStatements = [
  `CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    email        VARCHAR(255) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL CHECK (role IN ('customer','business','admin')),
    phone        VARCHAR(20),
    created_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE businesses (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    address        TEXT,
    city           VARCHAR(100),
    state          VARCHAR(100),
    zip_code       VARCHAR(20),
    category       VARCHAR(100) NOT NULL,
    contact_info   VARCHAR(255),
    image_url      TEXT,
    is_approved    BOOLEAN DEFAULT false,
    rating         DECIMAL(3,2) DEFAULT 0.00,
    total_reviews  INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE services (
    id            SERIAL PRIMARY KEY,
    business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_name  VARCHAR(255) NOT NULL,
    description   TEXT,
    price         DECIMAL(10,2) NOT NULL,
    duration      INTEGER NOT NULL,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE time_slots (
    id          SERIAL PRIMARY KEY,
    service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    is_booked   BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  // Booking lifecycle states:
  //   pending_provider_approval → awaiting_payment → booked → awaiting_confirmation → completed
  //   pending_provider_approval → rejected
  //   (pending_provider_approval | awaiting_payment | booked) → cancelled
  //   awaiting_confirmation → disputed → completed | cancelled
  `CREATE TABLE bookings (
    id                SERIAL PRIMARY KEY,
    customer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    business_id       INTEGER NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    service_id        INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    timeslot_id       INTEGER REFERENCES time_slots(id) ON DELETE SET NULL,
    requested_date    DATE NOT NULL,
    requested_time    TIME NOT NULL,
    status            VARCHAR(50) NOT NULL DEFAULT 'pending_provider_approval'
                        CHECK (status IN (
                          'pending_provider_approval',
                          'awaiting_payment',
                          'booked',
                          'awaiting_confirmation',
                          'completed',
                          'disputed',
                          'cancelled',
                          'rejected'
                        )),
    customer_notes    TEXT,
    rejection_reason  TEXT,
    total_price       DECIMAL(10,2) NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  // Escrow states:
  //   none → held → released (provider paid)
  //   held → disputed → released | refunded
  //   none | held → refunded (cancellation)
  `CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    booking_id      INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    amount          DECIMAL(10,2) NOT NULL,
    escrow_status   VARCHAR(30) NOT NULL DEFAULT 'none'
                      CHECK (escrow_status IN ('none','held','released','disputed','refunded')),
    payment_method  VARCHAR(50) DEFAULT 'simulated',
    released_to     VARCHAR(20) CHECK (released_to IN ('provider','customer') OR released_to IS NULL),
    simulated_at    TIMESTAMPTZ,
    held_at         TIMESTAMPTZ,
    released_at     TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE reviews (
    id           SERIAL PRIMARY KEY,
    booking_id   INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    rating       INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment      TEXT,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE disputes (
    id           SERIAL PRIMARY KEY,
    booking_id   INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    opened_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason       TEXT NOT NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','resolved_provider','resolved_customer')),
    admin_notes  TEXT,
    resolved_by  INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    resolved_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  // Full audit trail for all booking lifecycle events.
  `CREATE TABLE transactions (
    id          SERIAL PRIMARY KEY,
    booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    actor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action      VARCHAR(100) NOT NULL,
    from_state  VARCHAR(100),
    to_state    VARCHAR(100),
    amount      DECIMAL(10,2),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,

  // Indexes
  `CREATE INDEX idx_users_email              ON users(email)`,
  `CREATE INDEX idx_businesses_category      ON businesses(category)`,
  `CREATE INDEX idx_businesses_user_id       ON businesses(user_id)`,
  `CREATE INDEX idx_businesses_is_approved   ON businesses(is_approved)`,
  `CREATE INDEX idx_services_business_id     ON services(business_id)`,
  `CREATE INDEX idx_time_slots_service_id    ON time_slots(service_id)`,
  `CREATE INDEX idx_bookings_customer_id     ON bookings(customer_id)`,
  `CREATE INDEX idx_bookings_business_id     ON bookings(business_id)`,
  `CREATE INDEX idx_bookings_status          ON bookings(status)`,
  `CREATE INDEX idx_bookings_requested_datetime ON bookings(requested_date, requested_time)`,
  `CREATE INDEX idx_payments_escrow_status   ON payments(escrow_status)`,
  `CREATE INDEX idx_disputes_status          ON disputes(status)`,
  `CREATE INDEX idx_transactions_booking_id  ON transactions(booking_id)`,
  `CREATE INDEX idx_reviews_business_id      ON reviews(business_id)`,
];

async function runMigrations() {
  try {
    console.log('Dropping existing tables...');
    for (const sql of dropStatements) {
      await db.none(sql);
    }

    console.log('Creating tables...');
    for (let i = 0; i < createStatements.length; i++) {
      console.log(`  Statement ${i + 1}/${createStatements.length}`);
      await db.none(createStatements[i]);
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

runMigrations();
