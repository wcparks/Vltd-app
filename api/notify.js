// ============================================================
// notify.js — WhatsApp + SMS notifications via Twilio
// Place at: api/notify.js  (project ROOT, not src/)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    type, phone, ticketNumber, customerName, ticketUrl,
    venueName, valetName, estimatedMinutes, channel = 'whatsapp'
  } = req.body;

  if (!phone || !type) return res.status(400).json({ error: 'Missing phone or type' });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('TWILIO credentials missing from env vars');
    return res.status(500).json({ error: 'Twilio not configured' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;

  let message = '';
  switch (type) {
    case 'ticket_created':
      message = `🚗 *VLTD Valet*\nHi ${customerName || 'there'}! Ticket #${ticketNumber} at ${venueName || 'the event'}.\n\nTrack your car:\n${ticketUrl}\n\nWe'll message when your car is ready 🙏`;
      break;
    case 'car_ready':
      message = `🚗 *Your car is ready!*\nTicket #${ticketNumber}${valetName ? ` — Valet: ${valetName}` : ''}\n\nPlease head to the valet stand 🙌\n${ticketUrl}`;
      break;
    case 'car_requested':
      message = `🔔 *Car Requested!*\nTicket #${ticketNumber} — ${customerName || 'Guest'} needs their car${estimatedMinutes ? ` in ~${estimatedMinutes} min` : ' NOW'}`;
      break;
    case 'test':
      message = '✅ VLTD WhatsApp notifications working!';
      break;
    default:
      return res.status(400).json({ error: 'Unknown type' });
  }

  const isWhatsApp = channel === 'whatsapp';
  const from = isWhatsApp
    ? (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886')
    : process.env.TWILIO_SMS_FROM;

  // For car_requested — send to manager number, not customer
  const managerNumber = process.env.MANAGER_WHATSAPP
    ? `whatsapp:+${process.env.MANAGER_WHATSAPP.replace(/\D/g, '')}`
    : null;

  const to = type === 'car_requested' && managerNumber
    ? managerNumber
    : (isWhatsApp ? `whatsapp:${formattedPhone}` : formattedPhone);

  console.log(`Sending ${channel} to ${to} from ${from}, type: ${type}`);

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      console.error('Twilio error:', data);
      return res.status(500).json({ error: data.message, code: data.code, details: data });
    }
    return res.status(200).json({ success: true, sid: data.sid });
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
