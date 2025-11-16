# Render Deployment Guide for CEITrack Office Backend

## 📋 Pre-Deployment Checklist

- ✅ Removed `node_modules` from git
- ✅ Updated `package.json` with production scripts
- ✅ Added environment variable support for Firebase credentials
- ✅ Added dynamic PORT configuration

## 🚀 Render Dashboard Configuration

### Basic Settings

```
Service Name:      ceitrack-office-backend
Region:            Singapore (closest to Philippines)
Branch:            main
Root Directory:    server
Runtime:           Node
Build Command:     (leave empty)
Start Command:     npm start
```

### Environment Variables

Click **"Add Environment Variable"** and add the following:

#### 1. FIREBASE_BASE64 (REQUIRED)
```
Key:   FIREBASE_BASE64
Value: (copy from firebase-base64.txt file)
```

**How to get the value:**
1. Open the file `server/firebase-base64.txt` on your local machine
2. Copy the ENTIRE content (it's a very long string)
3. Paste it as the value in Render

**⚠️ IMPORTANT:** 
- This is your Firebase Admin SDK credentials encoded in Base64
- Keep it secret! Never share or commit this value
- Delete `firebase-base64.txt` after copying (it's in .gitignore)

#### 2. PORT (Auto-set by Render)
```
Key:   PORT
Value: (Render sets this automatically)
```
You don't need to add this - Render provides it automatically.

#### 3. NODE_ENV (Optional but recommended)
```
Key:   NODE_ENV
Value: production
```

#### 4. MAPTILER_API_KEY (if you use MapTiler)
```
Key:   MAPTILER_API_KEY
Value: 1GJ94oYVxT0kOUf6u8hC
```

#### 5. Other Optional Variables
```
FIREBASE_PROJECT_ID=project-6675709483481122019
FIREBASE_DATABASE_URL=https://project-6675709483481122019-default-rtdb.firebaseio.com
```

## 🔧 How Firebase Credentials Work

### Local Development (Your Computer)
```javascript
// Loads from: project-6675709483481122019-firebase-adminsdk-yug2x-400507615f.json
serviceAccount = require('./project-...-firebase-adminsdk-....json');
```

### Production (Render)
```javascript
// Loads from: FIREBASE_BASE64 environment variable
const jsonCredentials = Buffer.from(process.env.FIREBASE_BASE64, 'base64').toString('utf8');
serviceAccount = JSON.parse(jsonCredentials);
```

## 📝 Step-by-Step Deployment

1. **Push your code to GitHub** (already done ✅)
   ```bash
   git push origin main
   ```

2. **Create Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo: `jedeguzman1302val-coder/ceitrack-office`

3. **Configure Settings** (use values from above)
   - Set Root Directory to `server`
   - Leave Build Command empty
   - Set Start Command to `npm start`

4. **Add Environment Variables**
   - Copy content from `server/firebase-base64.txt`
   - Add as `FIREBASE_BASE64` in Render dashboard
   - Add other environment variables as needed

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (usually 2-5 minutes)
   - Check logs for any errors

## 🧪 Testing Your Deployment

Once deployed, Render will give you a URL like:
```
https://ceitrack-office-backend.onrender.com
```

Test endpoints:
```bash
# Health check (if you have one)
curl https://your-app.onrender.com/api/health

# Or test any public API endpoint
curl https://your-app.onrender.com/api/dashboard-data/BSIT
```

## 🐛 Troubleshooting

### "Firebase initialization failed"
- Check if `FIREBASE_BASE64` is set correctly
- Verify the base64 string is complete (no truncation)
- Check Render logs: click your service → "Logs" tab

### "Cannot find module"
- Make sure `Root Directory` is set to `server`
- Check if all dependencies are in `package.json`
- Render auto-runs `npm install` before starting

### "Port already in use"
- Remove hardcoded `const port = 3000`
- Use `const port = process.env.PORT || 3000` (already done ✅)

### "CORS errors from frontend"
- Update CORS settings in `server.js` to allow your frontend domain
- Example:
  ```javascript
  app.use(cors({
    origin: ['https://your-frontend.com', 'http://localhost:5500']
  }));
  ```

## 📌 Important Notes

1. **Free Tier Limitations:**
   - Render free tier spins down after 15 minutes of inactivity
   - First request after spin-down takes ~30 seconds to wake up
   - Consider paid tier for production use

2. **Security:**
   - Never commit Firebase JSON files to git (already in `.gitignore` ✅)
   - Never share your `FIREBASE_BASE64` value
   - Delete `firebase-base64.txt` after deployment

3. **Updates:**
   - Any push to `main` branch auto-deploys to Render
   - Check deployment status in Render dashboard

## 🔗 Useful Links

- [Render Dashboard](https://dashboard.render.com)
- [Render Docs - Environment Variables](https://render.com/docs/environment-variables)
- [Render Docs - Deploy Node.js](https://render.com/docs/deploy-node-express-app)

---

**Need help?** Check Render logs first:
1. Go to your service in Render dashboard
2. Click "Logs" tab
3. Look for error messages
