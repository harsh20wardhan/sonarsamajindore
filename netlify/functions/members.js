const { getPool } = require('./db');
const { requireAdmin } = require('./auth');
const nodemailer = require('nodemailer');

const NOTIFY_EMAIL = process.env.MEMBER_NOTIFY_EMAIL || 'sonarsamajindore@gmail.com';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendMemberNotificationEmail(member, rawData) {
  const gmailUser = process.env.GMAIL_USER || NOTIFY_EMAIL;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || '';
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpPass = process.env.SMTP_PASS || '';

  let transporter = null;
  if (smtpHost && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || gmailUser,
        pass: smtpPass
      }
    });
  } else if (gmailPass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });
  }

  if (!transporter) {
    console.warn('Email skipped: GMAIL_APP_PASSWORD or SMTP_HOST/SMTP_PASS is not configured.');
    return { sent: false, reason: 'missing_credentials' };
  }

  const rows = [
    ['पूर्ण नाव (Name)', rawData.name],
    ['मोबाईल (Phone)', rawData.phone],
    ['WhatsApp', rawData.whatsapp || rawData.phone],
    ['ईमेल (Email)', rawData.email],
    ['जन्म तारीख (DOB)', rawData.dob || rawData.date_of_birth],
    ['रक्तगट (Blood Group)', rawData.blood_group || rawData.bloodgroup],
    ['वडील / पतीचे नाव', rawData.father_or_husband],
    ['गोत्र (Gotra)', rawData.gotra],
    ['व्यवसाय / नोकरी (Occupation)', rawData.occupation],
    ['पत्ता (Address)', rawData.address],
    ['शहर / राज्य (City/State)', [rawData.city || 'Indore', rawData.state || 'Madhya Pradesh'].filter(Boolean).join(', ')],
    ['नोंद / सदस्य प्रकार (Notes)', rawData.notes || rawData.message],
    ['नोंदणी ID / वेळ', `#${member.id} • ${new Date(member.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`]
  ].filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '');

  const tableRowsHtml = rows.map(([label, val]) => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#fff7ed;font-weight:700;color:#7c2d12;width:36%;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a;font-size:13px;">${escapeHtml(val)}</td>
    </tr>
  `).join('');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #fed7aa;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#c2410c,#d97706);padding:18px 22px;color:#ffffff;">
        <h2 style="margin:0;font-size:18px;">नवीन सदस्य नोंदणी — सोनार समाज इंदूर</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">New Member Registration via sonarsamaj.com</p>
      </div>
      <div style="padding:20px;background:#ffffff;">
        <p style="margin:0 0 14px;font-size:14px;color:#334155;">वेबसाईटवरील सदस्य नोंदणी फॉर्मद्वारे नवीन अर्ज प्राप्त झाला आहे:</p>
        <table style="width:100%;border-collapse:collapse;">
          ${tableRowsHtml}
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b;">
          सर्व अर्ज पाहण्यासाठी <a href="https://sonarsamaj.com/admin/" style="color:#c2410c;font-weight:bold;">Admin Portal</a> वर लॉगिन करा.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Sonar Samaj Portal" <${gmailUser}>`,
    to: NOTIFY_EMAIL,
    replyTo: rawData.email || undefined,
    subject: `नवीन सदस्य नोंदणी: ${rawData.name} (${rawData.phone})`,
    html: htmlBody
  });

  return { sent: true };
}

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const pool = getPool();

  try {
    // ── GET: View all member registrations (for admin) ──
    if (event.httpMethod === 'GET') {
      const auth = requireAdmin(event, headers);
      if (!auth.ok) return auth.response;

      const res = await pool.query(`
        SELECT * FROM public.member_registrations 
        ORDER BY created_at DESC 
        LIMIT 200
      `);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ members: res.rows })
      };
    }

    // ── POST: Submit new membership application ──
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');
      if (!data.name || !data.phone) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Name and phone are required.' })
        };
      }

      const query = `
        INSERT INTO public.member_registrations (
          name, father_or_husband, gotra, phone, whatsapp, email,
          address, city, state, occupation, business_name, education,
          blood_group, family_members_count, notes, status, dob, date_of_birth, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        RETURNING id, name, phone, blood_group, dob, created_at;
      `;

      const values = [
        data.name,
        data.father_or_husband || '',
        data.gotra || '',
        data.phone,
        data.whatsapp || data.phone,
        data.email || '',
        data.address || '',
        data.city || 'Indore',
        data.state || 'Madhya Pradesh',
        data.occupation || '',
        data.business_name || '',
        data.education || '',
        data.blood_group || data.bloodgroup || '',
        parseInt(data.family_members_count) || 1,
        data.notes || data.message || '',
        'new',
        data.dob || data.date_of_birth || '',
        data.dob || data.date_of_birth || ''
      ];

      const res = await pool.query(query, values);
      const savedMember = res.rows[0];

      let emailResult = { sent: false };
      try {
        emailResult = await sendMemberNotificationEmail(savedMember, data);
      } catch (mailErr) {
        console.error('Failed to send member notification email:', mailErr);
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'सदस्यता नोंदणी यशस्वीरित्या झाली आहे! (Member registration submitted successfully)',
          member: savedMember,
          emailSent: emailResult.sent
        })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Error in members function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
