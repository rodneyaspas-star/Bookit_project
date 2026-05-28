const db = require('../config/database');
const {
  sendBookingRequested,
  sendBookingAccepted,
  sendBookingRejected,
  sendPaymentHeld,
  sendProviderMarkedComplete,
  sendEscrowReleased,
  sendDisputeOpened,
  sendRefundProcessed,
  sendCancellationEmail,
  sendCancellationToProvider,
} = require('../utils/email');

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getFullBookingDetails(conn, bookingId) {
  return conn.oneOrNone(
    `SELECT
       b.id, b.status, b.customer_notes, b.rejection_reason, b.total_price,
       b.customer_id, b.business_id, b.timeslot_id,
       b.created_at, b.updated_at,
       u.name  AS customer_name,  u.email AS customer_email,  u.phone AS customer_phone,
       bus.name AS business_name, bus.address AS business_address,
       bus.contact_info, bus.user_id AS business_owner_id,
       ou.name  AS business_owner_name, ou.email AS business_email,
       s.service_name, s.description AS service_description, s.duration,
       COALESCE(ts.start_time, (b.requested_date + b.requested_time)::timestamptz) AS start_time,
       COALESCE(ts.end_time, NULL) AS end_time,
       p.id AS payment_id, p.escrow_status, p.amount,
       p.simulated_at, p.held_at, p.released_at, p.refunded_at, p.released_to
     FROM bookings b
     JOIN users u        ON b.customer_id  = u.id
     JOIN businesses bus ON b.business_id  = bus.id
     JOIN users ou       ON bus.user_id    = ou.id
     JOIN services s     ON b.service_id   = s.id
     LEFT JOIN time_slots ts ON b.timeslot_id = ts.id
     LEFT JOIN payments p    ON b.id = p.booking_id
     WHERE b.id = $1`,
    [bookingId]
  );
}

async function logTransaction(t, { bookingId, actorId, action, fromState, toState, amount, notes }) {
  return t.none(
    `INSERT INTO transactions (booking_id, actor_id, action, from_state, to_state, amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [bookingId, actorId, action, fromState || null, toState || null, amount || null, notes || null]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER: Accept booking request
// Transition: pending_provider_approval → awaiting_payment
// ─────────────────────────────────────────────────────────────────────────────
async function acceptBooking(bookingId, providerUserId) {
  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.id, b.status, bus.user_id AS business_owner_id
       FROM bookings b
       JOIN businesses bus ON b.business_id = bus.id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (row.business_owner_id !== providerUserId)
      throw Object.assign(new Error('Access denied'), { status: 403 });
    if (row.status !== 'pending_provider_approval')
      throw Object.assign(new Error(`Booking cannot be accepted in state: ${row.status}`), { status: 400 });

    await t.none(
      `UPDATE bookings SET status = 'awaiting_payment', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingId]
    );
    await logTransaction(t, {
      bookingId,
      actorId: providerUserId,
      action: 'booking_accepted',
      fromState: 'pending_provider_approval',
      toState: 'awaiting_payment',
      notes: 'Provider accepted the booking request',
    });

    return getFullBookingDetails(t, bookingId);
  });

  setImmediate(() => sendBookingAccepted({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessName: details.business_name,
    serviceName: details.service_name,
    startTime: details.start_time,
    endTime: details.end_time,
    totalPrice: details.total_price,
    bookingId,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER: Reject booking request
// Transition: pending_provider_approval → rejected  (frees timeslot)
// ─────────────────────────────────────────────────────────────────────────────
async function rejectBooking(bookingId, providerUserId, reason) {
  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.id, b.status, b.timeslot_id, bus.user_id AS business_owner_id
       FROM bookings b
       JOIN businesses bus ON b.business_id = bus.id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (row.business_owner_id !== providerUserId)
      throw Object.assign(new Error('Access denied'), { status: 403 });
    if (row.status !== 'pending_provider_approval')
      throw Object.assign(new Error(`Booking cannot be rejected in state: ${row.status}`), { status: 400 });

    // Free the timeslot so the customer can rebook with another provider
    if (row.timeslot_id) {
      await t.none(`UPDATE time_slots SET is_booked = false WHERE id = $1`, [row.timeslot_id]);
    }

    await t.none(
      `UPDATE bookings
       SET status = 'rejected', rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [bookingId, reason || null]
    );
    await logTransaction(t, {
      bookingId,
      actorId: providerUserId,
      action: 'booking_rejected',
      fromState: 'pending_provider_approval',
      toState: 'rejected',
      notes: reason || 'Provider rejected the booking request',
    });

    return getFullBookingDetails(t, bookingId);
  });

  setImmediate(() => sendBookingRejected({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessName: details.business_name,
    serviceName: details.service_name,
    rejectionReason: details.rejection_reason,
    bookingId,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER: Simulate payment (only after provider acceptance)
// Transition: awaiting_payment → booked  |  escrow: none → held
// ─────────────────────────────────────────────────────────────────────────────
async function simulatePayment(bookingId, customerId) {
  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.id, b.status, b.customer_id, b.total_price, p.escrow_status
       FROM bookings b
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (row.customer_id !== customerId)
      throw Object.assign(new Error('Access denied'), { status: 403 });
    if (row.status !== 'awaiting_payment')
      throw Object.assign(new Error(
        row.status === 'pending_provider_approval'
          ? 'Payment is not available until the provider accepts your booking request'
          : `Cannot pay for a booking in state: ${row.status}`
      ), { status: 400 });
    if (row.escrow_status === 'held')
      throw Object.assign(new Error('Payment has already been made'), { status: 400 });

    const now = new Date();
    await t.none(
      `UPDATE bookings SET status = 'booked', updated_at = $2 WHERE id = $1`,
      [bookingId, now]
    );
    await t.none(
      `UPDATE payments
       SET escrow_status = 'held', simulated_at = $2, held_at = $2, updated_at = $2
       WHERE booking_id = $1`,
      [bookingId, now]
    );
    await logTransaction(t, {
      bookingId,
      actorId: customerId,
      action: 'payment_simulated',
      fromState: 'awaiting_payment',
      toState: 'booked',
      amount: row.total_price,
      notes: 'Payment simulated. Funds held in escrow.',
    });

    return getFullBookingDetails(t, bookingId);
  });

  setImmediate(() => sendPaymentHeld({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessEmail: details.business_email,
    businessOwnerName: details.business_owner_name,
    businessName: details.business_name,
    serviceName: details.service_name,
    totalPrice: details.total_price,
    bookingId,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER: Mark service as complete
// Transition: booked → awaiting_confirmation
// ─────────────────────────────────────────────────────────────────────────────
async function markComplete(bookingId, businessUserId) {
  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.id, b.status, bus.user_id AS business_owner_id, p.escrow_status
       FROM bookings b
       JOIN businesses bus ON b.business_id = bus.id
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (row.business_owner_id !== businessUserId)
      throw Object.assign(new Error('Access denied'), { status: 403 });
    if (row.status !== 'booked')
      throw Object.assign(new Error(`Service cannot be marked complete in state: ${row.status}`), { status: 400 });
    if (row.escrow_status !== 'held')
      throw Object.assign(new Error('Payment must be held in escrow before marking service complete'), { status: 400 });

    await t.none(
      `UPDATE bookings SET status = 'awaiting_confirmation', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingId]
    );
    await logTransaction(t, {
      bookingId,
      actorId: businessUserId,
      action: 'service_marked_complete',
      fromState: 'booked',
      toState: 'awaiting_confirmation',
      notes: 'Provider marked service as complete. Awaiting customer confirmation.',
    });

    return getFullBookingDetails(t, bookingId);
  });

  setImmediate(() => sendProviderMarkedComplete({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessName: details.business_name,
    serviceName: details.service_name,
    totalPrice: details.total_price,
    bookingId,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER: Confirm satisfaction and release escrow
// Transition: awaiting_confirmation → completed  |  escrow: held → released
// ─────────────────────────────────────────────────────────────────────────────
async function releaseEscrow(bookingId, customerId) {
  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.id, b.status, b.customer_id, p.escrow_status
       FROM bookings b
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (row.customer_id !== customerId)
      throw Object.assign(new Error('Access denied'), { status: 403 });
    if (row.status !== 'awaiting_confirmation')
      throw Object.assign(new Error('Escrow can only be released when the booking is awaiting your confirmation'), { status: 400 });

    const now = new Date();
    await t.none(
      `UPDATE bookings SET status = 'completed', updated_at = $2 WHERE id = $1`,
      [bookingId, now]
    );
    await t.none(
      `UPDATE payments
       SET escrow_status = 'released', released_to = 'provider', released_at = $2, updated_at = $2
       WHERE booking_id = $1`,
      [bookingId, now]
    );
    await logTransaction(t, {
      bookingId,
      actorId: customerId,
      action: 'escrow_released',
      fromState: 'awaiting_confirmation',
      toState: 'completed',
      notes: 'Customer confirmed service. Escrow released to provider.',
    });

    return getFullBookingDetails(t, bookingId);
  });

  setImmediate(() => sendEscrowReleased({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessEmail: details.business_email,
    businessOwnerName: details.business_owner_name,
    businessName: details.business_name,
    serviceName: details.service_name,
    totalPrice: details.total_price,
    bookingId,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER: Open a dispute
// Transition: awaiting_confirmation → disputed  |  escrow: held → disputed
// ─────────────────────────────────────────────────────────────────────────────
async function openDispute(bookingId, customerId, reason) {
  if (!reason || reason.trim().length < 10)
    throw Object.assign(new Error('Dispute reason must be at least 10 characters'), { status: 400 });

  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.id, b.status, b.customer_id, p.escrow_status
       FROM bookings b
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (row.customer_id !== customerId)
      throw Object.assign(new Error('Access denied'), { status: 403 });
    if (row.status !== 'awaiting_confirmation')
      throw Object.assign(new Error('Disputes can only be opened when the booking is awaiting confirmation'), { status: 400 });

    const existing = await t.oneOrNone('SELECT id FROM disputes WHERE booking_id = $1', [bookingId]);
    if (existing) throw Object.assign(new Error('A dispute already exists for this booking'), { status: 409 });

    await t.none(
      `UPDATE bookings SET status = 'disputed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingId]
    );
    await t.none(
      `UPDATE payments SET escrow_status = 'disputed', updated_at = CURRENT_TIMESTAMP WHERE booking_id = $1`,
      [bookingId]
    );
    await t.none(
      `INSERT INTO disputes (booking_id, opened_by, reason) VALUES ($1, $2, $3)`,
      [bookingId, customerId, reason.trim()]
    );
    await logTransaction(t, {
      bookingId,
      actorId: customerId,
      action: 'dispute_opened',
      fromState: 'awaiting_confirmation',
      toState: 'disputed',
      notes: reason.trim(),
    });

    return getFullBookingDetails(t, bookingId);
  });

  setImmediate(() => sendDisputeOpened({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessEmail: details.business_email,
    businessOwnerName: details.business_owner_name,
    serviceName: details.service_name,
    reason: reason.trim(),
    bookingId,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Resolve dispute — favour provider (release funds)
// Transition: disputed → completed  |  escrow: disputed → released
// ─────────────────────────────────────────────────────────────────────────────
async function adminReleaseEscrow(disputeId, adminId, adminNotes) {
  const details = await db.tx(async t => {
    const dispute = await t.oneOrNone(
      `SELECT d.id, d.booking_id, d.status, b.status AS booking_status
       FROM disputes d
       JOIN bookings b ON d.booking_id = b.id
       WHERE d.id = $1 FOR UPDATE OF d`,
      [disputeId]
    );

    if (!dispute) throw Object.assign(new Error('Dispute not found'), { status: 404 });
    if (dispute.status !== 'open') throw Object.assign(new Error('Dispute is already resolved'), { status: 400 });

    const now = new Date();
    await t.none(
      `UPDATE disputes
       SET status = 'resolved_provider', admin_notes = $2, resolved_by = $3, resolved_at = $4, updated_at = $4
       WHERE id = $1`,
      [disputeId, adminNotes || null, adminId, now]
    );
    await t.none(
      `UPDATE payments
       SET escrow_status = 'released', released_to = 'provider', released_at = $2, updated_at = $2
       WHERE booking_id = $1`,
      [dispute.booking_id, now]
    );
    await t.none(
      `UPDATE bookings SET status = 'completed', updated_at = $2 WHERE id = $1`,
      [dispute.booking_id, now]
    );
    await logTransaction(t, {
      bookingId: dispute.booking_id,
      actorId: adminId,
      action: 'admin_released_escrow',
      fromState: 'disputed',
      toState: 'completed',
      notes: adminNotes || 'Admin resolved dispute in favour of provider.',
    });

    return getFullBookingDetails(t, dispute.booking_id);
  });

  setImmediate(() => sendEscrowReleased({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessEmail: details.business_email,
    businessOwnerName: details.business_owner_name,
    businessName: details.business_name,
    serviceName: details.service_name,
    totalPrice: details.total_price,
    bookingId: details.id,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Resolve dispute — refund customer
// Transition: disputed → cancelled  |  escrow: disputed → refunded
// ─────────────────────────────────────────────────────────────────────────────
async function adminRefundCustomer(disputeId, adminId, adminNotes) {
  const details = await db.tx(async t => {
    const dispute = await t.oneOrNone(
      `SELECT d.id, d.booking_id, d.status, b.timeslot_id, b.total_price
       FROM disputes d
       JOIN bookings b ON d.booking_id = b.id
       WHERE d.id = $1 FOR UPDATE OF d`,
      [disputeId]
    );

    if (!dispute) throw Object.assign(new Error('Dispute not found'), { status: 404 });
    if (dispute.status !== 'open') throw Object.assign(new Error('Dispute is already resolved'), { status: 400 });

    const now = new Date();
    await t.none(
      `UPDATE disputes
       SET status = 'resolved_customer', admin_notes = $2, resolved_by = $3, resolved_at = $4, updated_at = $4
       WHERE id = $1`,
      [disputeId, adminNotes || null, adminId, now]
    );
    await t.none(
      `UPDATE payments
       SET escrow_status = 'refunded', refunded_at = $2, updated_at = $2
       WHERE booking_id = $1`,
      [dispute.booking_id, now]
    );
    if (dispute.timeslot_id) {
      await t.none(`UPDATE time_slots SET is_booked = false WHERE id = $1`, [dispute.timeslot_id]);
    }
    await t.none(
      `UPDATE bookings SET status = 'cancelled', updated_at = $2 WHERE id = $1`,
      [dispute.booking_id, now]
    );
    await logTransaction(t, {
      bookingId: dispute.booking_id,
      actorId: adminId,
      action: 'admin_refunded_customer',
      fromState: 'disputed',
      toState: 'cancelled',
      notes: adminNotes || 'Admin resolved dispute in favour of customer. Refund processed.',
    });

    return getFullBookingDetails(t, dispute.booking_id);
  });

  setImmediate(() => sendRefundProcessed({
    customerEmail: details.customer_email,
    customerName: details.customer_name,
    businessEmail: details.business_email,
    businessOwnerName: details.business_owner_name,
    serviceName: details.service_name,
    totalPrice: details.total_price,
    bookingId: details.id,
    adminNotes,
  }).catch(e => console.error('Email error:', e)));

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER / PROVIDER / ADMIN: Cancel booking
// Allowed from: pending_provider_approval | awaiting_payment | booked
// ─────────────────────────────────────────────────────────────────────────────
async function cancelBooking(bookingId, actorId, actorRole) {
  const CANCELLABLE = ['pending_provider_approval', 'awaiting_payment', 'booked'];

  const details = await db.tx(async t => {
    const row = await t.oneOrNone(
      `SELECT b.*, bus.user_id AS business_owner_id, p.escrow_status,
              u.name AS customer_name, u.email AS customer_email,
              bus.name AS business_name,
              ou.name AS business_owner_name, ou.email AS business_email,
              s.service_name
       FROM bookings b
       JOIN businesses bus ON b.business_id = bus.id
       JOIN users u         ON b.customer_id = u.id
       JOIN users ou         ON bus.user_id  = ou.id
       JOIN services s      ON b.service_id  = s.id
       LEFT JOIN payments p    ON b.id = p.booking_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );

    if (!row) throw Object.assign(new Error('Booking not found'), { status: 404 });

    const isCustomer = row.customer_id === actorId;
    const isOwner    = row.business_owner_id === actorId;
    const isAdmin    = actorRole === 'admin';
    if (!isCustomer && !isOwner && !isAdmin)
      throw Object.assign(new Error('Access denied'), { status: 403 });

    if (!CANCELLABLE.includes(row.status))
      throw Object.assign(new Error(`Cannot cancel a booking with status: ${row.status}`), { status: 400 });

    let timeslot = null;
    if (row.timeslot_id) {
      timeslot = await t.oneOrNone('SELECT start_time FROM time_slots WHERE id = $1', [row.timeslot_id]);
    }
    const startTime = timeslot?.start_time ??
      (row.requested_date
        ? new Date(`${new Date(row.requested_date).toISOString().split('T')[0]}T${row.requested_time}`)
        : null);

    const wasHeld = row.escrow_status === 'held';
    const now = new Date();

    await t.none(
      `UPDATE bookings SET status = 'cancelled', updated_at = $2 WHERE id = $1`,
      [bookingId, now]
    );

    if (row.escrow_status && row.escrow_status !== 'none') {
      await t.none(
        `UPDATE payments
         SET escrow_status = $2,
             refunded_at = CASE WHEN $2 = 'refunded' THEN $3 ELSE refunded_at END,
             updated_at = $3
         WHERE booking_id = $1`,
        [bookingId, wasHeld ? 'refunded' : row.escrow_status, now]
      );
    }

    // Always free the timeslot from any cancellable state
    if (row.timeslot_id) {
      await t.none(`UPDATE time_slots SET is_booked = false WHERE id = $1`, [row.timeslot_id]);
    }

    await logTransaction(t, {
      bookingId,
      actorId,
      action: 'booking_cancelled',
      fromState: row.status,
      toState: 'cancelled',
      notes: `Cancelled by ${actorRole}${wasHeld ? '. Escrow refunded.' : ''}`,
    });

    setImmediate(() => {
      sendCancellationEmail({
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        businessName: row.business_name,
        serviceName: row.service_name,
        startTime,
        totalPrice: row.total_price,
        wasRefunded: wasHeld,
      }).catch(e => console.error('Email error:', e));
      sendCancellationToProvider({
        businessEmail: row.business_email,
        businessOwnerName: row.business_owner_name,
        customerName: row.customer_name,
        businessName: row.business_name,
        serviceName: row.service_name,
        startTime,
        totalPrice: row.total_price,
        wasRefunded: wasHeld,
      }).catch(e => console.error('Email error:', e));
    });

    return { cancelled: true, wasRefunded: wasHeld };
  });

  return details;
}

module.exports = {
  getFullBookingDetails,
  acceptBooking,
  rejectBooking,
  simulatePayment,
  markComplete,
  releaseEscrow,
  openDispute,
  adminReleaseEscrow,
  adminRefundCustomer,
  cancelBooking,
};
