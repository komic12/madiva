// utils/email.js
const nodemailer = require('nodemailer');

const createTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

const sendWelcomeEmail = async ({ name, email, role, tempPassword }) => {
    const transporter = createTransporter();
    if (!transporter) return; // Email not configured — skip silently

    const roleLabel = role === 'sponsor' ? 'Sponsor' : role === 'volunteer' ? 'Volunteer' : 'Member';
    const mailOptions = {
        from: process.env.EMAIL_FROM || 'MADIVA CBO <noreply@madivacbo.org>',
        to: email,
        subject: `Welcome to MADIVA CBO — Your ${roleLabel} Account`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#E53E3E">Welcome to MADIVA CBO, ${name}!</h2>
                <p>Your ${roleLabel} account has been created.</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> <code style="background:#f5f5f5;padding:4px 8px;border-radius:4px">${tempPassword}</code></p>
                <p>Please log in and change your password as soon as possible.</p>
                <p style="color:#666;font-size:12px">MADIVA CBO — Empowering Communities</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.warn('Email send failed (non-critical):', err.message);
    }
};

const sendNotificationEmail = async ({ to, subject, html }) => {
    const transporter = createTransporter();
    if (!transporter) return;
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'MADIVA CBO <noreply@madivacbo.org>',
            to,
            subject,
            html,
        });
    } catch (err) {
        console.warn('Notification email failed (non-critical):', err.message);
    }
};

module.exports = { sendWelcomeEmail, sendNotificationEmail };
