// simple wrappers — fill with your provider (SendGrid, SES, Twilio, etc.)
const axios = require("axios");

async function sendEmail(to, subject, html) {
  // Example placeholder for SendGrid or your SMTP
  if (!process.env.SENDGRID_API_KEY) return;
  try {
    // implement SendGrid or nodemailer
    console.log(`📧 sendEmail -> ${to} ${subject}`);
  } catch (err) {
    console.error("❌ sendEmail error:", err.message || err);
  }
}

async function sendSMS(to, message) {
  // Example placeholder for Twilio
  if (!process.env.TWILIO_ACCOUNT_SID) return;
  try {
    console.log(`📲 sendSMS -> ${to} ${message}`);
  } catch (err) {
    console.error("❌ sendSMS error:", err.message || err);
  }
}

module.exports = { sendEmail, sendSMS };
