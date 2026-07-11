# MADIVA CBO Full Stack Platform

Welcome to the **MADIVA CBO** full-stack project! This platform provides a modern website, a powerful admin dashboard, and dedicated portals for volunteers and sponsors. It is powered by Node.js, Express, and fully integrated with Firebase for authentication, real-time data sync, and media storage.

## 🌟 Key Features

* **Three Portals in One:** Admin, Sponsor, and Volunteer dashboards.
* **Real-time Sync:** Powered by Firebase Realtime Database for live metrics.
* **Live Firebase Integrated:** Configured with real Firebase Admin SDK credentials for production.
* **Media Library:** Upload, view, and manage images/videos stored in Firebase Storage.
* **Donations & M-Pesa:** Process donations securely (M-Pesa Daraja API ready).
* **Role-Based Access Control:** Secure JWT authentication with role-based routing.

---

## 🛠️ 1. Local Testing Instructions

You can run the entire platform on your local machine to test it before deploying.

### Prerequisites
* Node.js (v16 or higher)
* A terminal or command prompt

### Steps to Run Locally

1. **Open the project folder:**
   Navigate to the backend directory where this `README.md` is located.
   ```bash
   cd madiva-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   *The server will start on port 5000. It will automatically attempt to connect to Firebase using the credentials provided in `.env`. If credentials are not set up, it will gracefully fall back to a DEMO in-memory mode.*

4. **Access the Website:**
   Open your browser and navigate to:
   [http://localhost:5000](http://localhost:5000)

5. **Test the Admin Dashboard:**
   * Click **Portal** -> **Admin Login**
   * Since this is a fresh setup, you can register an admin user first:
     * Use a tool like Postman, or temporarily modify the HTML to show the admin registration form.
     * Alternatively, in DEMO mode, any new registration works instantly.

---

## 🚀 2. Production Deployment Instructions

To make the platform live on the internet, you need to host the backend (Node.js) and the frontend (HTML/CSS/JS). The easiest and most cost-effective way is to use **Render.com** for the backend and **Firebase Hosting** (or Netlify) for the frontend.

### Step A: Deploy the Backend (Render.com)

1. **Push to GitHub:**
   Commit this entire project to a private GitHub repository. (Make sure `.env` is ignored and NOT uploaded).
2. **Create Web Service on Render:**
   * Go to [Render.com](https://render.com) and sign in.
   * Click **New** -> **Web Service**.
   * Connect your GitHub account and select the repository.
3. **Configure the Service:**
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
4. **Set Environment Variables:**
   In the Render dashboard, go to the **Environment** tab and copy everything from your local `.env` file into the Render environment variables. 
   *(Make sure to set `NODE_ENV=production` and update `FRONTEND_URL` to your actual live domain).*
5. **Deploy!** Render will give you a live URL (e.g., `https://madiva-api.onrender.com`).

### Step B: Deploy the Frontend (Firebase Hosting)

Since you are already using Firebase, Firebase Hosting is the best place for your frontend.

1. **Update API URLs:**
   In `public/madiva-cbo.html`, update the `API` constant to point to your new Render backend URL instead of localhost:
   ```javascript
   const API = 'https://madiva-api.onrender.com/api';
   ```
2. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```
3. **Login and Initialize:**
   ```bash
   firebase login
   firebase init hosting
   ```
   * Select your project (`madiva-cbo`).
   * When asked for the public directory, type `public`.
   * Configure as a single-page app? **No**.
   * Set up automatic builds with GitHub? **No**.
4. **Deploy:**
   ```bash
   firebase deploy --only hosting
   ```
   Firebase will give you a live URL (e.g., `https://madiva-cbo.web.app`).

---

## 🔐 Firebase Security Rules

For production, ensure your Firebase Realtime Database has the following security rules to prevent unauthorized access:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "media": {
      ".read": true
    }
  }
}
```
*(This allows anyone to read public media, but requires authentication for everything else. The backend Admin SDK bypasses these rules automatically).*

---

## 📞 Support

If you need any further assistance with deployment or modifications, please refer to the Firebase Documentation or contact the development team.

Built with 💜 for **MADIVA CBO**.


# New Contact Us System Integration

This section details the newly integrated backend-powered Contact Us system.

## 1. Features
- **Backend:** Node.js with Express.js.
- **Emailing:** Nodemailer for sending contact notifications and auto-replies.
- **Security:** Dotenv for secure credential storage, input sanitization, HTML injection protection, and rate limiting.
- **API Endpoint:** `POST /api/contact` for submitting contact forms.
- **Validation:** Server-side validation for name, email, subject, and message fields.
- **Responses:** Standardized JSON success/failure responses.
- **Frontend Integration:** Asynchronous form submission using Fetch API.

## 2. Project Structure Updates

```
madiva-backend/
├── controllers/
│   ├── contactController.js    # Updated: Handles contact form submission logic.
├── middleware/
│   ├── rateLimiter.js          # New: Rate limiting for contact endpoint.
│   ├── validation.js           # New: Input validation for contact form.
├── routes/
│   ├── contact.js              # Updated: Defines contact API routes with middleware.
├── services/
│   ├── emailService.js         # New: Centralized email sending logic using Nodemailer.
├── .env.example                # New: Example environment variables for configuration.
├── README.md                   # Updated: This documentation.
├── server.js                   # Existing: Main server file, no changes to existing functionality.
└── package.json                # Updated: Includes new dependencies and scripts.
```

## 3. Installation

To set up the project locally, follow these steps:

1.  **Navigate to the backend directory:**
    ```bash
    cd /home/ubuntu/madiva-project/madiva-backend
    ```

2.  **Install dependencies:**
    The project uses `pnpm` for package management. If you don't have `pnpm` installed, you can install it globally:
    ```bash
    npm install -g pnpm
    ```
    Then, install the project dependencies:
    ```bash
    pnpm install
    ```
    This will install `express`, `nodemailer`, `dotenv`, `cors`, `express-rate-limit`, `validator`, and other existing dependencies.

## 4. Configuration

1.  **Create a `.env` file:**
    Copy the `.env.example` file to `.env` in the `madiva-backend` directory:
    ```bash
    cp .env.example .env
    ```

2.  **Edit the `.env` file:**
    Open the newly created `.env` file and configure the following variables:

    -   **`NODE_ENV`**: Set to `development` for local development.
    -   **`PORT`**: The port your server will run on (e.g., `5000`).
    -   **`FRONTEND_URL`**: The URL of your frontend application (e.g., `http://localhost:5500`).

    -   **Email Configuration (Nodemailer):**
        -   `EMAIL_HOST`: Your SMTP host (e.g., `smtp.gmail.com`).
        -   `EMAIL_PORT`: Your SMTP port (e.g., `587` for TLS, `465` for SSL).
        -   `EMAIL_USER`: The email address used to send emails.
        -   `EMAIL_PASS`: The password or app-specific password for the email address.

    Example `.env` configuration for email:
    ```
    EMAIL_HOST=smtp.mailtrap.io
    EMAIL_PORT=2525
    EMAIL_USER=your_mailtrap_username
    EMAIL_PASS=your_mailtrap_password
    ```
    *(Note: For development, consider using services like [Mailtrap](https://mailtrap.io/) to test email sending without spamming real inboxes.)*

## 5. Running the Project

To run the backend server:

1.  **Development Mode (with Nodemon):**
    ```bash
    pnpm run dev
    ```
    This will start the server using `nodemon`, which automatically restarts the server when file changes are detected.

2.  **Production Mode:**
    ```bash
    pnpm start
    ```
    This will start the server using Node.js directly.

Once the server is running, the contact form will be accessible at `http://localhost:<PORT>/api/contact`.

## 6. Deployment Notes

-   **Environment Variables:** Ensure all sensitive environment variables (especially `EMAIL_USER`, `EMAIL_PASS`, `JWT_SECRET`) are securely configured in your deployment environment (e.g., Render, Heroku, AWS, etc.). Do not commit your `.env` file to version control.
-   **CORS:** The `server.js` file already includes a CORS configuration that allows `FRONTEND_URL` and `manus.computer` domains. Ensure your production frontend URL is correctly set in the `FRONTEND_URL` environment variable.
-   **Rate Limiting:** The `express-rate-limit` middleware is applied to the `/api/contact` endpoint to prevent abuse. Adjust `windowMs` and `max` values in `middleware/rateLimiter.js` as needed for your production traffic.
-   **Email Service:** For production, use a robust email service provider (e.g., SendGrid, Mailgun, AWS SES) instead of a personal email account for `EMAIL_USER` and `EMAIL_PASS`.
-   **Firebase:** The contact submissions are stored in Firebase (or an in-memory demo if Firebase is not configured). Ensure your Firebase credentials are correctly set in the `.env` file for production data persistence.

---

*Generated by Manus AI*
