// THROWAWAY — delete after testing. Do not commit.
require('dotenv').config();
const { Resend } = require('resend');

const recipient = process.argv[2];
if (!recipient) {
  console.error('Usage: node test-resend.js <recipient-email>');
  process.exit(1);
}

// Exact same init as backend/utils/email.js
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'BookIt <notifications@bookit.app>';

console.log('FROM address :', FROM);
console.log('TO address   :', recipient);
console.log('API key start:', (process.env.RESEND_API_KEY || '').slice(0, 4) + '...');
console.log('Sending...\n');

(async () => {
  try {
    const response = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: 'Resend test from booking app',
      html: `<p>This is a live test email from the BookIt backend.</p>
<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
<p>If you received this, Resend is configured correctly.</p>`,
    });
    console.log('SUCCESS — full response:');
    console.log(JSON.stringify(response, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('FAILURE — full error:');
    console.error('  name   :', err.name);
    console.error('  message:', err.message);
    console.error('  status :', err.statusCode ?? err.status ?? '(no status)');
    console.error('  full   :', JSON.stringify(err, null, 2));
    process.exit(1);
  }
})();
