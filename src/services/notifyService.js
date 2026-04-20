// ============================================================
// notify.js -- Frontend WhatsApp/SMS helper
// Place at: src/notify.js
// ============================================================

/**
 * Send a WhatsApp or SMS notification via /api/notify
 * Never crashes your app -- all errors are swallowed silently.
 *
 * @param {Object} options
 * @param {'ticket_created'|'car_ready'|'car_requested'|'test'} options.type
 * @param {string} options.phone - Customer's phone number
 * @param {string} [options.ticketNumber]
 * @param {string} [options.customerName]
 * @param {string} [options.ticketUrl]
 * @param {string} [options.venueName]
 * @param {string} [options.valetName]
 * @param {number} [options.estimatedMinutes]
 * @param {'whatsapp'|'sms'} [options.channel='whatsapp']
 */
export async function sendNotification({ type, phone, channel = 'whatsapp', ...rest }) {
  if (!phone) return;
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, phone, channel, ...rest }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.warn('Notification failed:', err);
    }
  } catch (err) {
    console.warn('Notification error (non-fatal):', err);
    // Never crash the app for notification failures
  }
}

// Shorthand aliases
export const sendWhatsApp = (opts) => sendNotification({ ...opts, channel: 'whatsapp' });
export const sendSMS = (opts) => sendNotification({ ...opts, channel: 'sms' });
