// services/emailService.js
// Centralised email service — delegates to utils/email.js
const { sendWelcomeEmail, sendNotificationEmail } = require('../utils/email');

const sendContactEmail = async ({ name, email, subject, message }) => {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) return;
    await sendNotificationEmail({
        to: adminEmail,
        subject: `[MADIVA CBO Contact] ${subject || 'New message'}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h3 style="color:#E53E3E">New Contact Form Submission</h3>
                <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
                <p><strong>Subject:</strong> ${subject || '(no subject)'}</p>
                <hr>
                <p>${(message || '').replace(/\n/g, '<br>')}</p>
                <hr>
                <p style="color:#666;font-size:12px">Sent via MADIVA CBO website contact form</p>
            </div>
        `,
    });
};

const sendDonationReceipt = async ({ name, email, amount, program, reference }) => {
    if (!email) return;
    await sendNotificationEmail({
        to: email,
        subject: `MADIVA CBO — Donation Receipt ${reference}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#E53E3E">Thank You for Your Donation!</h2>
                <p>Dear ${name},</p>
                <p>We have received your donation of <strong>KES ${Number(amount).toLocaleString()}</strong> for <strong>${program || 'General Fund'}</strong>.</p>
                <p><strong>Reference:</strong> ${reference}</p>
                <p>Your generosity helps us empower communities across Kisii County.</p>
                <p style="color:#666;font-size:12px">MADIVA CBO — Empowering Communities</p>
            </div>
        `,
    });
};

module.exports = { sendContactEmail, sendDonationReceipt, sendWelcomeEmail };
