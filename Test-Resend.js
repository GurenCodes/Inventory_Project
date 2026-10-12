require('dotenv').config();

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const recipient = process.argv[2];

  if (!recipient) {
    throw new Error(
      'Usage: node test-resend.js your-email@example.com'
    );
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error(
      'RESEND_API_KEY or EMAIL_FROM is missing from .env'
    );
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: recipient,
    subject: 'Floramagg Inventory — Resend Test',
    text: 'Email delivery from the Floramagg inventory system is being tested.',
  });

  if (error) {
    console.error('Resend rejected the email:', error);
    process.exitCode = 1;
    return;
  }

  console.log('Resend accepted the email.');
  console.log('Email ID:', data.id);
}

main().catch((error) => {
  console.error('Test failed:', error.message);
  process.exitCode = 1;
});