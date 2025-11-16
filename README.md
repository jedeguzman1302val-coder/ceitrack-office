# CEITRACK - OJT Management System

## 🔐 Security Setup

### Firebase Admin SDK Setup

**IMPORTANT:** The Firebase Admin SDK key file is NOT included in this repository for security reasons.

To set up the server:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `project-6675709483481122019`
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Rename it to match the pattern in `server.js` (or update `server.js` with your filename)
7. Place it in the `server/` directory

**File structure:**
```
backend/
├── server/
│   ├── server.js
│   ├── your-firebase-adminsdk-key.json  ← Place your key here
│   └── ...
```

### Frontend Firebase Configuration

Update the Firebase config in your frontend files with your own credentials:

**Files to update:**
- `adviserchat/adviserchat.js`
- `advisertrack/advisertrack.js`
- Any other files using Firebase

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

## 📦 Installation

```bash
# Install server dependencies
cd server
npm install

# Start the server
node server.js
```

## ⚠️ Before Pushing to GitHub

Make sure these files are in `.gitignore`:
- ✅ Firebase Admin SDK keys (*.json)
- ✅ node_modules/
- ✅ .env files
- ✅ generated_documents/

**Double check:**
```bash
# View what will be committed
git status

# Make sure no .json files are listed!
```

## 🚀 Running the Application

1. Start the backend server (port 3000)
2. Open any HTML file in a browser or use Live Server
3. Login with your credentials

## 📂 Project Structure

```
backend/
├── server/              # Node.js backend
├── adviserdashboard/    # Adviser dashboard page
├── adviserannouncement/ # Announcements management
├── adviserstudents/     # Student management
├── adviserchat/         # Chat system
├── advisertrack/        # Student tracking
├── officelogin/         # Login page
└── assets/              # Shared assets
```

## 🔒 Security Best Practices

1. **Never commit** Firebase Admin SDK keys
2. **Never commit** API keys or credentials
3. Use environment variables for sensitive data
4. Regularly rotate your keys
5. Limit Firebase security rules appropriately

## 📝 License

Private project - All rights reserved
