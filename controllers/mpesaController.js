// controllers/mpesaController.js — M-Pesa Daraja STK Push
const axios  = require('axios');
const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendDonationReceipt } = require('../services/emailService');

// ── M-Pesa Configuration Validation ──────────────────────────────
const validateMpesaConfig = () => {
  const required = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn('⚠️  M-Pesa configuration incomplete:', missing.join(', '));
    return false;
  }
  return true;
};

const hasMpesaCreds = validateMpesaConfig();

const BASE_URL = () => process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

const getToken = async () => {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const res  = await axios.get(`${BASE_URL()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers:{ Authorization:`Basic ${auth}` } });
  return res.data.access_token;
};

const getPassword = () => {
  const ts  = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
  const pwd = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString('base64');
  return { password:pwd, timestamp:ts };
};

// POST /api/mpesa/stkpush
const stkPush = asyncHandler(async (req, res) => {
  if (!hasMpesaCreds) {
    return res.status(503).json({
      success: false,
      message: 'M-Pesa payment processing is not configured. Please contact support or add M-Pesa credentials to .env',
      requiredEnv: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL']
    });
  }

  let { phone, amount, program, donorName, donorEmail } = req.body;
  phone = phone.replace(/\s/g,'');
  if (phone.startsWith('0'))  phone = '254' + phone.slice(1);
  if (phone.startsWith('+'))  phone = phone.slice(1);
  if (!/^2547\d{8}$/.test(phone))
    return res.status(400).json({ success:false, message:'Invalid phone. Use format 07XXXXXXXX.' });
  if (!amount || isNaN(amount) || Number(amount) < 1)
    return res.status(400).json({ success:false, message:'Amount must be at least KES 1.' });

  const token = await getToken();
  const { password, timestamp } = getPassword();

  const mpesaRes = await axios.post(`${BASE_URL()}/mpesa/stkpush/v1/processrequest`, {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password, Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(Number(amount)), PartyA: phone, PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: phone, CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: 'MADIVA CBO', TransactionDesc: `Donation: ${program||'General Fund'}`,
  }, { headers:{ Authorization:`Bearer ${token}` } });

  const { CheckoutRequestID, ResponseCode, CustomerMessage } = mpesaRes.data;
  if (ResponseCode !== '0')
    return res.status(400).json({ success:false, message:'M-Pesa request failed.' });

  const id = `mpesa_${Date.now()}`;
  await collections.donations.doc(id).set({
    id, checkoutRequestId:CheckoutRequestID, phone, amount:Number(amount),
    program:program||'General Fund', donorName:donorName||req.user?.name||'Anonymous',
    donorEmail:donorEmail||req.user?.email||null, donorId:req.user?.uid||null,
    paymentMethod:'M-Pesa STK Push', status:'pending', createdAt:new Date().toISOString(),
  });

  res.json({ success:true, checkoutRequestId:CheckoutRequestID,
    message:CustomerMessage||'STK Push sent. Enter your M-Pesa PIN on your phone.' });
});

// POST /api/mpesa/callback
const mpesaCallback = asyncHandler(async (req, res) => {
  const cb = req.body?.Body?.stkCallback;
  if (!cb) return res.json({ ResultCode:0, ResultDesc:'Accepted' });
  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = cb;

  const snap = await collections.donations.where('checkoutRequestId','==',CheckoutRequestID).limit(1).get();
  if (snap.empty) return res.json({ ResultCode:0, ResultDesc:'Accepted' });

  const ref  = snap.docs[0].ref;
  const data = snap.docs[0].data();

  if (ResultCode === 0) {
    const meta = {};
    CallbackMetadata?.Item?.forEach(i => { meta[i.Name] = i.Value; });
    const reference = `MPESA-${meta.MpesaReceiptNumber||Date.now()}`;
    await ref.update({ status:'received', mpesaReceiptNumber:meta.MpesaReceiptNumber,
      reference, confirmedAt:new Date().toISOString() });
    if (data.donorEmail) sendDonationReceipt({ name:data.donorName, email:data.donorEmail,
      amount:data.amount, program:data.program, reference }).catch(()=>{});
  } else {
    await ref.update({ status:'failed', failReason:ResultDesc, updatedAt:new Date().toISOString() });
  }
  res.json({ ResultCode:0, ResultDesc:'Accepted' });
});

// GET /api/mpesa/status/:id
const checkStatus = asyncHandler(async (req, res) => {
  const snap = await collections.donations.where('checkoutRequestId','==',req.params.checkoutRequestId).limit(1).get();
  if (snap.empty) return res.status(404).json({ success:false, message:'Transaction not found.' });
  const d = snap.docs[0].data();
  res.json({ success:true, status:d.status, amount:d.amount, reference:d.reference||null,
    message: d.status==='received' ? `Payment of KES ${d.amount} confirmed! Receipt: ${d.mpesaReceiptNumber}`
           : d.status==='failed'   ? 'Payment was not completed.'
           : 'Processing…' });
});

module.exports = { stkPush, mpesaCallback, checkStatus, validateMpesaConfig };
