/**
 * Twilio WhatsApp integration.
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env to go live.
 * Without credentials, this simulates the send and logs it so the demo still works end-to-end.
 */

const hasCreds = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
let client = null;
if (hasCreds) {
  const twilio = require('twilio');
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendWhatsAppAlert(toPhone, message) {
  if (!client) {
    console.log(`[SIMULATED WhatsApp] -> ${toPhone}:\n${message}\n`);
    return { channel: 'whatsapp', to: toPhone, status: 'simulated_sent' };
  }
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
  const result = await client.messages.create({
    from,
    to: `whatsapp:${toPhone}`,
    body: message,
  });
  return { channel: 'whatsapp', to: toPhone, sid: result.sid, status: result.status };
}

module.exports = { sendWhatsAppAlert };
