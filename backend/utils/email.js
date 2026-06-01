const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const send = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `BookIt <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Email send error:', err?.message || err);
  }
};

const fmt = (date) => new Date(date).toLocaleString('en-UG', {
  dateStyle: 'medium', timeStyle: 'short'
});

// ── Booking requested ─────────────────────────────────────────────────────────
const sendBookingRequested = ({ customerName, businessEmail, businessOwnerName, businessName, serviceName, startTime, endTime, totalPrice, bookingId }) => {
  const timeDisplay = endTime ? `${fmt(startTime)} – ${fmt(endTime)}` : fmt(startTime);
  return send({
    to: businessEmail,
    subject: `New Booking Request — ${serviceName} (#${bookingId})`,
    html: `<p>Hi ${businessOwnerName},</p>
<p><strong>${customerName}</strong> has requested a booking for <strong>${serviceName}</strong> at your business <strong>${businessName}</strong>.</p>
<ul>
  <li><strong>Date/Time:</strong> ${timeDisplay}</li>
  <li><strong>Amount:</strong> UGX ${Number(totalPrice).toLocaleString()}</li>
  <li><strong>Booking ID:</strong> #${bookingId}</li>
</ul>
<p>Please log in to your dashboard and <strong>accept or reject</strong> this request. The customer cannot pay until you accept.</p>`
  });
};

// ── Booking accepted ──────────────────────────────────────────────────────────
const sendBookingAccepted = ({ customerEmail, customerName, businessName, serviceName, startTime, endTime, totalPrice, bookingId }) => {
  const timeDisplay = endTime ? `${fmt(startTime)} – ${fmt(endTime)}` : fmt(startTime);
  return send({
    to: customerEmail,
    subject: `Booking Accepted — ${serviceName} at ${businessName}`,
    html: `<p>Hi ${customerName},</p>
<p>Great news! <strong>${businessName}</strong> has accepted your booking request for <strong>${serviceName}</strong>.</p>
<ul>
  <li><strong>Date/Time:</strong> ${timeDisplay}</li>
  <li><strong>Amount:</strong> UGX ${Number(totalPrice).toLocaleString()}</li>
  <li><strong>Booking ID:</strong> #${bookingId}</li>
</ul>
<p>Please log in and <strong>complete payment</strong> to confirm your appointment. Your slot is reserved but will not be locked until payment is made.</p>`
  });
};

// ── Booking rejected ──────────────────────────────────────────────────────────
const sendBookingRejected = ({ customerEmail, customerName, businessName, serviceName, rejectionReason, bookingId }) => {
  return send({
    to: customerEmail,
    subject: `Booking Request Declined — ${serviceName} at ${businessName}`,
    html: `<p>Hi ${customerName},</p>
<p>Unfortunately, <strong>${businessName}</strong> has declined your booking request for <strong>${serviceName}</strong> (Booking #${bookingId}).</p>
${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
<p>Your time slot has been released. You may search for another available time or a different provider on BookIt.</p>`
  });
};

// ── Payment held ──────────────────────────────────────────────────────────────
const sendPaymentHeld = ({ customerEmail, customerName, businessEmail, businessOwnerName, businessName, serviceName, totalPrice, bookingId }) => {
  return Promise.all([
    send({
      to: customerEmail,
      subject: `Payment Held in Escrow — Booking #${bookingId}`,
      html: `<p>Hi ${customerName},</p>
<p>Your payment of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong> is now held in escrow for <strong>${serviceName}</strong> at <strong>${businessName}</strong>.</p>
<p>Funds will be released to the provider only after you confirm the service was completed to your satisfaction.</p>
<p><strong>Booking ID:</strong> #${bookingId}</p>`
    }),
    send({
      to: businessEmail,
      subject: `Payment Received — Appointment Confirmed (#${bookingId})`,
      html: `<p>Hi ${businessOwnerName},</p>
<p>Payment for <strong>${serviceName}</strong> (Booking #${bookingId}) has been received and is held in escrow.</p>
<p>Once you deliver the service, mark it as complete in your dashboard. The customer will then confirm and funds will be released to you.</p>
<p><strong>Amount:</strong> UGX ${Number(totalPrice).toLocaleString()}</p>`
    }),
  ]);
};

// ── Provider marked complete ──────────────────────────────────────────────────
const sendProviderMarkedComplete = ({ customerEmail, customerName, businessName, serviceName, totalPrice, bookingId }) =>
  send({
    to: customerEmail,
    subject: `Action Required: Confirm Your Service — Booking #${bookingId}`,
    html: `<p>Hi ${customerName},</p>
<p><strong>${businessName}</strong> has marked your <strong>${serviceName}</strong> appointment as completed.</p>
<p>Please log in and <strong>confirm the service was delivered</strong> to release the payment of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong>. If there is a problem, you can open a dispute instead.</p>
<p><strong>Booking ID:</strong> #${bookingId}</p>`
  });

// ── Escrow released ───────────────────────────────────────────────────────────
const sendEscrowReleased = ({ customerEmail, customerName, businessEmail, businessOwnerName, businessName, serviceName, totalPrice, bookingId }) => {
  return Promise.all([
    send({
      to: customerEmail,
      subject: `Payment Released — Booking #${bookingId} Complete`,
      html: `<p>Hi ${customerName},</p>
<p>You have confirmed completion of <strong>${serviceName}</strong> at <strong>${businessName}</strong>. The escrow of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong> has been released to the provider.</p>
<p>Thank you for using BookIt! You can leave a review from your booking page.</p>`
    }),
    send({
      to: businessEmail,
      subject: `Funds Released — Booking #${bookingId}`,
      html: `<p>Hi ${businessOwnerName},</p>
<p>The customer has confirmed completion of <strong>${serviceName}</strong>.</p>
<p><strong>UGX ${Number(totalPrice).toLocaleString()}</strong> has been released from escrow to you.</p>
<p><strong>Booking ID:</strong> #${bookingId}</p>`
    }),
  ]);
};

// ── Dispute opened ────────────────────────────────────────────────────────────
const sendDisputeOpened = ({ customerEmail, customerName, businessEmail, businessOwnerName, serviceName, reason, bookingId }) => {
  return Promise.all([
    send({
      to: customerEmail,
      subject: `Dispute Opened — Booking #${bookingId}`,
      html: `<p>Hi ${customerName},</p>
<p>Your dispute for <strong>${serviceName}</strong> (Booking #${bookingId}) has been received.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>Our admin team will review and resolve the dispute. Funds remain held in escrow until resolution.</p>`
    }),
    send({
      to: businessEmail,
      subject: `Dispute Filed Against Your Service — Booking #${bookingId}`,
      html: `<p>Hi ${businessOwnerName},</p>
<p>A customer has opened a dispute for <strong>${serviceName}</strong> (Booking #${bookingId}).</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>An admin will review and resolve this. Funds remain in escrow until resolved.</p>`
    }),
  ]);
};

// ── Refund processed ──────────────────────────────────────────────────────────
const sendRefundProcessed = ({ customerEmail, customerName, businessEmail, businessOwnerName, serviceName, totalPrice, bookingId, adminNotes }) => {
  return Promise.all([
    send({
      to: customerEmail,
      subject: `Dispute Resolved — Refund Issued for Booking #${bookingId}`,
      html: `<p>Hi ${customerName},</p>
<p>The dispute for <strong>${serviceName}</strong> (Booking #${bookingId}) has been resolved in your favour.</p>
<p>A simulated refund of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong> has been processed.</p>
${adminNotes ? `<p><strong>Admin notes:</strong> ${adminNotes}</p>` : ''}`
    }),
    send({
      to: businessEmail,
      subject: `Dispute Resolved — Refund Issued to Customer — Booking #${bookingId}`,
      html: `<p>Hi ${businessOwnerName},</p>
<p>The dispute for <strong>${serviceName}</strong> (Booking #${bookingId}) has been resolved in the customer's favour.</p>
<p>The escrow of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong> has been refunded to the customer.</p>
${adminNotes ? `<p><strong>Admin notes:</strong> ${adminNotes}</p>` : ''}`
    }),
  ]);
};

// ── Cancellation ──────────────────────────────────────────────────────────────
const sendCancellationEmail = ({ customerEmail, customerName, businessName, serviceName, startTime, totalPrice, wasRefunded }) =>
  send({
    to: customerEmail,
    subject: `Booking Cancelled — ${serviceName}`,
    html: `<p>Hi ${customerName},</p>
<p>Your booking for <strong>${serviceName}</strong> at <strong>${businessName}</strong>${startTime ? ` on ${fmt(startTime)}` : ''} has been cancelled.</p>
${wasRefunded ? `<p>A simulated refund of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong> has been issued.</p>` : ''}
<p>You can make a new booking any time on BookIt.</p>`
  });

// ── Cancellation (provider copy) ──────────────────────────────────────────────
const sendCancellationToProvider = ({ businessEmail, businessOwnerName, customerName, businessName, serviceName, startTime, totalPrice, wasRefunded }) =>
  send({
    to: businessEmail,
    subject: `Booking Cancelled — ${serviceName} (${businessName})`,
    html: `<p>Hi ${businessOwnerName},</p>
<p>A booking by <strong>${customerName}</strong> for <strong>${serviceName}</strong> at <strong>${businessName}</strong>${startTime ? ` on ${fmt(startTime)}` : ''} has been cancelled.</p>
${wasRefunded ? `<p>The escrow of <strong>UGX ${Number(totalPrice).toLocaleString()}</strong> has been refunded to the customer.</p>` : ''}
<p>The time slot has been released and is available for new bookings.</p>`
  });

module.exports = {
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
};
