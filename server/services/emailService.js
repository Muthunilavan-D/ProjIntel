const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Creates and returns configured Nodemailer transport with fast socket timeouts
 */
function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
    dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // SMTP not configured in .env
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user,
      pass
    },
    // Strict connection timeouts to prevent hanging on cloud hosts (e.g. Render Free tier)
    connectionTimeout: 3500,
    greetingTimeout: 3500,
    socketTimeout: 4500
  });
}

/**
 * Optional HTTPS-based email delivery (Vercel Relay / Brevo / Resend)
 */
async function sendViaHttpApi({ toEmail, subject, htmlContent, textBody, fromEmail }) {
  // 1. Try Vercel Serverless Mail Relay (HTTPS Port 443 — uses Gmail SMTP from Vercel without cloud port blocks)
  try {
    const relayUrl = process.env.MAIL_RELAY_URL || 'https://proj-intel.vercel.app/api/send-mail';
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(relayUrl, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toEmail,
        subject,
        html: htmlContent,
        text: textBody,
        from: fromEmail,
        secret: 'projintel_mail_relay_secret_2026'
      })
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        console.log(`[EMAIL SERVICE] ✅ Live email delivered via Vercel HTTPS Relay! MessageId: ${data.messageId}`);
        return { success: true, messageId: data.messageId };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn(`[EMAIL SERVICE] Vercel Relay HTTP ${res.status}:`, errData.error || res.statusText);
    }
  } catch (err) {
    console.warn(`[EMAIL SERVICE] Vercel Relay attempt:`, err.message);
  }

  // 2. Try Brevo HTTPS API (Port 443 — never blocked by cloud hosts)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'ProjIntel Admin Cell', email: fromEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent,
          textContent: textBody
        })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data.messageId || 'brevo-api' };
      }
    } catch (err) {
      console.warn('[EMAIL SERVICE] Brevo HTTP dispatch failed:', err.message);
    }
  }

  // 3. Try Resend HTTPS API (Port 443 — never blocked by cloud hosts)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail.includes('@') ? `ProjIntel <${fromEmail}>` : 'ProjIntel <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          html: htmlContent,
          text: textBody
        })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data.id || 'resend-api' };
      }
    } catch (err) {
      console.warn('[EMAIL SERVICE] Resend HTTP dispatch failed:', err.message);
    }
  }

  return null;
}

/**
 * Send Password Reset OTP and Link to Admin email
 */
async function sendPasswordResetOtp({ toEmail, name = 'Administrator', otp, resetToken, clientBaseUrl = 'http://localhost:5173' }) {
  const resetLink = `${clientBaseUrl}?resetToken=${resetToken}&email=${encodeURIComponent(toEmail)}`;
  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'admin@projintel.edu';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #0B0F19; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; overflow: hidden; color: #F9FAFB;">
      <div style="background: linear-gradient(135deg, #1E1B4B 0%, #0B0F19 100%); padding: 24px 30px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
          🎓 ProjIntel Academic Portal
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #9CA3AF;">Administrative Security & Authentication Cell</p>
      </div>

      <div style="padding: 30px;">
        <h2 style="font-size: 18px; margin-top: 0; color: #F9FAFB;">Administrative Password Reset Request</h2>
        <p style="font-size: 14px; color: #D1D5DB; line-height: 1.6;">
          Hello <strong>${name}</strong>,<br>
          We received a security request to reset the password for the primary administrator account (<strong>${toEmail}</strong>).
        </p>

        <div style="margin: 24px 0; background: rgba(99, 102, 241, 0.12); border: 1px dashed #6366F1; border-radius: 8px; padding: 20px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #A5B4FC; font-weight: 700;">
            One-Time Security Verification Code (OTP)
          </p>
          <div style="font-size: 36px; font-family: monospace; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; margin: 10px 0;">
            ${otp}
          </div>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9CA3AF;">Valid for <strong>15 minutes</strong>. Do not disclose this OTP to anyone.</p>
        </div>

        <div style="text-align: center; margin: 26px 0;">
          <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%); color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
            Direct Password Reset Link
          </a>
        </div>

        <p style="font-size: 12px; color: #9CA3AF; line-height: 1.5;">
          Or copy and paste this verification URL into your browser:<br>
          <a href="${resetLink}" style="color: #818CF8; word-break: break-all;">${resetLink}</a>
        </p>

        <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;">

        <p style="font-size: 12px; color: #6B7280; margin: 0;">
          ⚠️ If you did not request this password reset, please secure your administrative account immediately.
        </p>
      </div>

      <div style="background: rgba(15, 23, 42, 0.6); padding: 14px 24px; text-align: center; font-size: 11px; color: #6B7280; border-top: 1px solid rgba(255, 255, 255, 0.05);">
        Velammal College of Engineering & Technology • AI-Assisted Academic Project Management System
      </div>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`[EMAIL SERVICE] 🔐 PASSWORD RESET OTP TRIGGERED`);
  console.log(`Recipient: ${toEmail}`);
  console.log(`6-Digit OTP: ${otp}`);
  console.log(`Reset Link: ${resetLink}`);
  console.log(`======================================================\n`);

  // 1. Check HTTP-based transactional mail APIs first (port 443 — reliable across cloud hosts)
  const httpResult = await sendViaHttpApi({
    toEmail,
    subject: `[ProjIntel] Admin Password Reset Code: ${otp}`,
    htmlContent,
    textBody: `Hello ${name},\n\nWe received a request to reset the password for your ProjIntel administrator account (${toEmail}).\n\nYour 6-Digit Verification Code (OTP) is: ${otp}\n\nValid for 15 minutes.\nAlternatively, open this direct reset link:\n${resetLink}\n\nProjIntel Academic Project Management System`,
    fromEmail
  });

  if (httpResult && httpResult.success) {
    console.log(`[EMAIL SERVICE] ✅ Live email delivered via HTTPS API! MessageId: ${httpResult.messageId}`);
    return {
      success: true,
      deliveredLive: true,
      messageId: httpResult.messageId,
      otp,
      resetToken,
      resetLink
    };
  }

  if (!transporter) {
    console.log(`[EMAIL SERVICE] ℹ️ SMTP credentials not detected in .env. Live OTP recorded above for immediate verification.`);
    return {
      success: true,
      deliveredLive: false,
      otp,
      resetToken,
      resetLink,
      note: 'OTP logged to server console (SMTP not configured in .env)'
    };
  }

  try {
    const sendPromise = transporter.sendMail({
      from: `"ProjIntel Admin Cell" <${fromEmail}>`,
      to: toEmail,
      subject: `[ProjIntel] Admin Password Reset Code: ${otp}`,
      text: `Hello ${name},\n\nWe received a request to reset the password for your ProjIntel administrator account (${toEmail}).\n\nYour 6-Digit Verification Code (OTP) is: ${otp}\n\nValid for 15 minutes.\nAlternatively, open this direct reset link:\n${resetLink}\n\nProjIntel Academic Project Management System`,
      html: htmlContent
    });

    // 3.5s timeout safeguard against cloud provider outbound port blocks (e.g. Render Free tier)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP connection timed out (outbound port blocked by host)')), 3500)
    );

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[EMAIL SERVICE] ✅ Live email delivered successfully! MessageId: ${info.messageId}`);
    return {
      success: true,
      deliveredLive: true,
      messageId: info.messageId,
      otp,
      resetToken,
      resetLink
    };
  } catch (err) {
    console.warn(`[EMAIL SERVICE] ⚠️ SMTP delivery bypassed (${err.message}). Instant code verification available.`);
    return {
      success: true,
      deliveredLive: false,
      otp,
      resetToken,
      resetLink,
      error: err.message
    };
  }
}

/**
 * Send Email Change Verification Link & OTP Code to New Admin Email
 */
async function sendEmailChangeVerification({ newEmail, currentEmail, name = 'Administrator', verificationToken, verificationOtp, clientBaseUrl = 'http://localhost:5173' }) {
  const verifyLink = `${clientBaseUrl}?verifyEmailToken=${verificationToken}`;
  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'admin@projintel.edu';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #0B0F19; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; overflow: hidden; color: #F9FAFB;">
      <div style="background: linear-gradient(135deg, #064E3B 0%, #0B0F19 100%); padding: 24px 30px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
          🎓 ProjIntel Academic Portal
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #6EE7B7;">Administrator Email Verification</p>
      </div>

      <div style="padding: 30px;">
        <h2 style="font-size: 18px; margin-top: 0; color: #F9FAFB;">Verify Your New Administrator Email</h2>
        <p style="font-size: 14px; color: #D1D5DB; line-height: 1.6;">
          Hello <strong>${name}</strong>,<br>
          A request was initiated in ProjIntel to update the primary administrative email address from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.
        </p>

        <p style="font-size: 14px; color: #D1D5DB; line-height: 1.6;">
          To ensure that this new email address is valid and under your control, use either of the two verification options below:
        </p>

        ${verificationOtp ? `
        <!-- Option 1: 6-Digit OTP Code (Mobile-Friendly) -->
        <div style="margin: 22px 0; background: rgba(16, 185, 129, 0.12); border: 1px dashed #10B981; border-radius: 8px; padding: 20px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #6EE7B7; font-weight: 700;">
            Option 1: 6-Digit Verification Code (OTP)
          </p>
          <div style="font-size: 36px; font-family: monospace; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; margin: 10px 0;">
            ${verificationOtp}
          </div>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #D1D5DB;">
            📲 <em>Checking email on your phone?</em> Simply enter this 6-digit code in the <strong>Account Security</strong> modal on your computer.
          </p>
        </div>
        ` : ''}

        <!-- Option 2: Direct Link (PC Browser) -->
        <div style="text-align: center; margin: 24px 0 16px 0;">
          <p style="margin: 0 0 10px 0; font-size: 12px; color: #9CA3AF; font-weight: 600;">
            Option 2: Direct Confirmation Link (if reading on your computer)
          </p>
          <a href="${verifyLink}" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
            ✅ Confirm Email Address (on this PC)
          </a>
        </div>

        <p style="font-size: 11px; color: #9CA3AF; line-height: 1.5; text-align: center;">
          Direct PC URL: <a href="${verifyLink}" style="color: #34D399; word-break: break-all;">${verifyLink}</a>
        </p>

        <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;">

        <p style="font-size: 12px; color: #6B7280; margin: 0;">
          ⏳ This verification code and link will expire in <strong>24 hours</strong>. If you did not initiate this change, you can safely disregard this email.
        </p>
      </div>

      <div style="background: rgba(15, 23, 42, 0.6); padding: 14px 24px; text-align: center; font-size: 11px; color: #6B7280; border-top: 1px solid rgba(255, 255, 255, 0.05);">
        Velammal College of Engineering & Technology • AI-Assisted Academic Project Management System
      </div>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`[EMAIL SERVICE] 📧 EMAIL CHANGE VERIFICATION TRIGGERED`);
  console.log(`New Email to Verify: ${newEmail}`);
  console.log(`Current Email: ${currentEmail}`);
  if (verificationOtp) console.log(`6-Digit OTP Code: ${verificationOtp}`);
  console.log(`Verification Link: ${verifyLink}`);
  console.log(`======================================================\n`);

  const textBody = `Hello ${name},\n\nA request was initiated to update the ProjIntel administrator email from ${currentEmail} to ${newEmail}.\n\n` +
    (verificationOtp ? `Your 6-Digit Email Verification Code: ${verificationOtp}\n(Enter this code in the Account Security modal on your computer)\n\n` : '') +
    `Or if you are on your computer, click this link to confirm:\n${verifyLink}\n\nThis verification expires in 24 hours.\n\nProjIntel Academic Project Management System`;
  const emailSubject = `[ProjIntel] Confirm Your New Admin Email Address${verificationOtp ? ` (Code: ${verificationOtp})` : ''}`;

  // 1. Check HTTP-based transactional mail APIs first (port 443 — reliable across cloud hosts)
  const httpResult = await sendViaHttpApi({
    toEmail: newEmail,
    subject: emailSubject,
    htmlContent,
    textBody,
    fromEmail
  });

  if (httpResult && httpResult.success) {
    console.log(`[EMAIL SERVICE] ✅ Live verification email delivered via HTTPS API! MessageId: ${httpResult.messageId}`);
    return {
      success: true,
      deliveredLive: true,
      messageId: httpResult.messageId,
      verificationToken,
      verificationOtp,
      verifyLink
    };
  }

  if (!transporter) {
    console.log(`[EMAIL SERVICE] ℹ️ SMTP credentials not detected in .env. Verification link logged above for immediate testing.`);
    return {
      success: true,
      deliveredLive: false,
      verificationToken,
      verificationOtp,
      verifyLink,
      note: 'Verification link logged to server console (SMTP not configured in .env)'
    };
  }

  try {
    const sendPromise = transporter.sendMail({
      from: `"ProjIntel Admin Cell" <${fromEmail}>`,
      to: newEmail,
      subject: emailSubject,
      text: textBody,
      html: htmlContent
    });

    // 3.5s timeout safeguard against cloud provider outbound port blocks (e.g. Render Free tier)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP connection timed out (outbound port blocked by host)')), 3500)
    );

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[EMAIL SERVICE] ✅ Live verification email delivered successfully! MessageId: ${info.messageId}`);
    return {
      success: true,
      deliveredLive: true,
      messageId: info.messageId,
      verificationToken,
      verificationOtp,
      verifyLink
    };
  } catch (err) {
    console.warn(`[EMAIL SERVICE] ⚠️ SMTP delivery bypassed (${err.message}). Instant code verification available.`);
    return {
      success: true,
      deliveredLive: false,
      verificationToken,
      verificationOtp,
      verifyLink,
      error: err.message
    };
  }
}

module.exports = {
  sendPasswordResetOtp,
  sendEmailChangeVerification
};

