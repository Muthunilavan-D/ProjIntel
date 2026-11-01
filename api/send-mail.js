import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'ProjIntel Live Mail Relay' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text, from, secret } = req.body || {};

    if (secret !== 'projintel_mail_relay_secret_2026') {
      return res.status(401).json({ success: false, error: 'Unauthorized relay invocation' });
    }

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ success: false, error: 'Missing required mail parameters (to, subject, content)' });
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER || 'muthunilavand555@gmail.com';
    const pass = process.env.SMTP_PASS || 'fpzb viva duul pzuj';
    const fromAddress = from || user;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000
    });

    const info = await transporter.sendMail({
      from: `"ProjIntel Admin Cell" <${fromAddress}>`,
      to,
      subject,
      text: text || '',
      html: html || ''
    });

    console.log(`[MAIL RELAY] ✅ Successfully delivered live email to ${to}! MessageId: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      deliveredLive: true,
      messageId: info.messageId,
      recipient: to
    });
  } catch (err) {
    console.error(`[MAIL RELAY] ❌ Failed to dispatch email via relay:`, err.message);
    return res.status(500).json({
      success: false,
      deliveredLive: false,
      error: err.message
    });
  }
}
