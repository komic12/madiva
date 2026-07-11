# 🔥 Firebase Setup Guide - MADIVA CBO Backend

## ✅ Current Status

Your backend server is **RUNNING** on:
- **Port:** 5000
- **Health Check:** http://localhost:5000/health
- **API Config:** http://localhost:5000/api/firebase-config
- **Mode:** DEMO (in-memory, no persistence)

---

## 🚀 What's Working

- ✅ Express.js backend server running
- ✅ All routes initialized (auth, donations, volunteers, media, contacts, admin, mpesa)
- ✅ CORS configured
- ✅ Security headers (Helmet) enabled
- ✅ Error handling middleware active
- ✅ File upload middleware ready (Multer)
- ⚠️ Firebase: Currently in **DEMO MODE** (in-memory data only)

---

## 🔧 Setup Firebase for Production

### Step 1: Get Firebase Service Account Key

1. Go to **[Firebase Console](https://console.firebase.google.com)**
2. Select your project: **madiva-cbo**
3. Click the **⚙️ Settings** icon (top-left) → **Project Settings**
4. Navigate to the **"Service Accounts"** tab
5. Under **"Firebase Admin SDK"**, click **"Generate New Private Key"**
   - A JSON file will download automatically
6. Keep this file safe (contains sensitive credentials)

### Step 2: Update `.env` File

Your `.env` file is located at: `madiva-backend/.env`

The following values are **already configured** from your service account:

```env
FIREBASE_PROJECT_ID=madiva-cbo
FIREBASE_PRIVATE_KEY_ID=8ce14c82dcff98f7ac084145be6a4782ffa02dfc
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@madiva-cbo.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=100436991959773302748
FIREBASE_STORAGE_BUCKET=madiva-cbo.firebasestorage.app
FIREBASE_DATABASE_URL=https://madiva-cbo-default-rtdb.firebaseio.com
```

**⚠️ If the above values are placeholder text or empty:**

Open `madiva-backend/.env` and replace these values with those from your downloaded service account JSON:

```json
{
  "type": "service_account",
  "project_id": "your_project_id",
  "private_key_id": "your_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n",
  "client_email": "your_email@project.iam.gserviceaccount.com",
  "client_id": "1234567890",
  ...
}
```

### Step 3: Verify Credentials Format

The `FIREBASE_PRIVATE_KEY` must:
- ✅ Start with: `-----BEGIN PRIVATE KEY-----`
- ✅ End with: `-----END PRIVATE KEY-----`
- ✅ Have literal `\n` characters (not actual newlines)
- ✅ Be wrapped in quotes: `"-----BEGIN... -----END..."`

**Example:**
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...(many lines)...\n-----END PRIVATE KEY-----\n"
```

### Step 4: Restart the Server

```bash
# Kill the current server (Ctrl+C)
# Then restart:
node "c:\Users\user\Downloads\madiva_production_r\madiva-backend\server.js"
```

You should see:
```
✅ Firebase Admin SDK initialized successfully
   Project: madiva-cbo
   Firestore: Ready
   Storage: madiva-cbo.firebasestorage.app
```

---

## 🧪 Test Firebase Connection

### Health Check
```bash
curl http://localhost:5000/health
```

### Get Firebase Config (for frontend)
```bash
curl http://localhost:5000/api/firebase-config
```

### Create a Test User (Auth)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User",
    "role": "volunteer"
  }'
```

---

## 📋 Available Routes

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Donations
- `POST /api/donations` - Create donation
- `GET /api/donations` - List donations
- `GET /api/donations/:id` - Get donation details

### Volunteers
- `POST /api/volunteers` - Register volunteer
- `GET /api/volunteers` - List volunteers
- `PUT /api/volunteers/:id` - Update volunteer

### Media
- `POST /api/media/upload` - Upload image/video
- `GET /api/media` - List media
- `DELETE /api/media/:id` - Delete media

### Admin
- `GET /api/admin/dashboard` - Dashboard stats (admin only)
- `GET /api/admin/users` - Manage users (admin only)

### Contact
- `POST /api/contact` - Send contact message
- `GET /api/contact` - View messages (admin only)

### M-Pesa
- `POST /api/mpesa/stkpush` - Initiate payment
- `POST /api/mpesa/callback` - Payment callback

---

## 🔐 Environment Variables Checklist

### Firebase (Required for Production)
- [ ] `FIREBASE_PROJECT_ID` - ✅ madiva-cbo
- [ ] `FIREBASE_PRIVATE_KEY_ID` - ✅ Set
- [ ] `FIREBASE_PRIVATE_KEY` - ✅ Set (with `\n` characters)
- [ ] `FIREBASE_CLIENT_EMAIL` - ✅ Set
- [ ] `FIREBASE_CLIENT_ID` - ✅ Set
- [ ] `FIREBASE_STORAGE_BUCKET` - ✅ madiva-cbo.firebasestorage.app
- [ ] `FIREBASE_DATABASE_URL` - ✅ Set

### Server
- [ ] `PORT` - ✅ 5000
- [ ] `NODE_ENV` - ✅ development
- [ ] `JWT_SECRET` - ✅ Set

### Email (Optional - for contact forms)
- [ ] `EMAIL_HOST` - ✅ smtp.gmail.com
- [ ] `EMAIL_USER` - ⚠️ Set to your email
- [ ] `EMAIL_PASS` - ⚠️ Set to Gmail app password
- [ ] `ADMIN_EMAIL` - ✅ Set

### M-Pesa (Optional - for payments)
- [ ] `MPESA_CONSUMER_KEY` - ⚠️ Not configured
- [ ] `MPESA_CONSUMER_SECRET` - ⚠️ Not configured
- [ ] `MPESA_SHORTCODE` - ✅ 174379
- [ ] `MPESA_PASSKEY` - ✅ Set

### Africa's Talking SMS (Optional)
- [ ] `AT_USERNAME` - ⚠️ Not configured
- [ ] `AT_API_KEY` - ⚠️ Not configured

---

## 🆘 Troubleshooting

### Firebase Still in DEMO Mode?

**Check:**
1. Is the `.env` file in the correct location? `madiva-backend/.env`
2. Run:
   ```bash
   echo $env:FIREBASE_PROJECT_ID  # Should show: madiva-cbo
   ```
3. Are there spaces around the `=` sign? (Should be: `KEY=value`, not `KEY = value`)
4. Is the `FIREBASE_PRIVATE_KEY` formatted correctly with `\n` characters?

### Private Key Error?

**Solution:** The private key must be:
```env
# ❌ WRONG - actual newlines
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBA...
-----END PRIVATE KEY-----"

# ✅ CORRECT - escaped \n characters
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"
```

### Credentials Not Loading?

**Try:**
1. Delete the line: `require('dotenv').config();` appears at the top of `server.js`
2. Ensure `.env` is in the `madiva-backend/` folder (not parent directory)
3. Restart the server

---

## 🎯 Next Steps

1. ✅ Verify Firebase credentials are correct in `.env`
2. ✅ Restart server: `node server.js`
3. ✅ Test health endpoint: `http://localhost:5000/health`
4. ✅ Test auth route: Create a test user
5. ✅ Deploy to production (Render, Railway, Heroku)

---

## 📚 Useful Links

- [Firebase Console](https://console.firebase.google.com)
- [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Storage](https://firebase.google.com/docs/storage)

---

## ✨ Features Included

- 🔐 JWT Authentication
- 🗄️ Firestore Database
- 📦 Cloud Storage (file uploads)
- 💳 M-Pesa Integration
- 📧 Email Notifications (Nodemailer)
- 📱 SMS Notifications (Africa's Talking)
- 🔒 CORS & Security Headers
- 📊 Comprehensive Logging
- ❌ Global Error Handling

---

**Server Status:** 🟢 Running on http://localhost:5000
