# Quick Deploy Instructions

## ⚠️ Important Note

Your app uses local file storage (SHOES folder, uploads, SQLite database). For a production deployment, consider:
- Using cloud storage (AWS S3, Cloudinary) for images
- Using a cloud database (PostgreSQL, MongoDB) instead of SQLite

However, for a quick demo/test deployment, we can use **Render** or **Railway** which provide persistent storage.

## 🚀 Easiest Option: Render (Recommended)

### Step 1: Create Account
1. Go to https://render.com
2. Sign up with GitHub (easiest)

### Step 2: Deploy
1. Click "New +" → "Web Service"
2. Connect your GitHub account if not already
3. Select repository: `Craigjd77/shoe-store`
4. Configure:
   - **Name**: `shoe-store`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free (or paid if you want)
5. Click "Create Web Service"

### Step 3: Wait & Access
- Render will build and deploy (takes 2-5 minutes)
- You'll get a URL like: `https://shoe-store.onrender.com`
- Your app will be live! 🎉

## Alternative: Railway

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `shoe-store`
5. Railway auto-detects Node.js and deploys automatically

## After Deployment

Your app will be accessible at the provided URL, just like localhost:3000!

**Note**: File uploads will work, but data may be reset if the service restarts (free tier limitation). For production, use cloud storage.


