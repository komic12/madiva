const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendContactEmail } = require('../services/emailService');

// POST /api/contact
const submitContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const contactId = `contact_${Date.now()}`;
  const contact = {
    id: contactId,
    name,
    email,
    subject,
    message,
    status: 'new',
    ip,
    createdAt: new Date().toISOString(),
  };

  // Save to database (Firebase/Demo)
  if (collections && collections.contacts) {
    await collections.contacts.doc(contactId).set(contact);
  }

  // Send emails
  try {
    await sendContactEmail({ name, email, subject, message, ip });
    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully.'
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    // Even if email fails, we saved the message to the DB
    res.status(500).json({
      success: false,
      message: 'An error occurred while sending your message.'
    });
  }
});

// GET /api/contact (Admin only)
const getContacts = asyncHandler(async (req, res) => {
  const { status, limit = 50 } = req.query;
  let query = collections.contacts.orderBy('createdAt', 'desc').limit(Number(limit));
  if (status) query = query.where('status', '==', status);

  const snapshot = await query.get();
  const contacts = snapshot.docs.map(doc => doc.data());

  res.json({ success: true, count: contacts.length, contacts });
});

// PATCH /api/contact/:id (Admin — mark read/replied)
const updateContactStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'new' | 'read' | 'replied'

  await collections.contacts.doc(id).update({ status, updatedAt: new Date().toISOString() });
  res.json({ success: true, message: 'Contact status updated.' });
});

// DELETE /api/contact/:id (Admin)
const deleteContact = asyncHandler(async (req, res) => {
  await collections.contacts.doc(req.params.id).delete();
  res.json({ success: true, message: 'Contact deleted.' });
});

module.exports = { submitContact, getContacts, updateContactStatus, deleteContact };
