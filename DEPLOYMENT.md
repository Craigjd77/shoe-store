# Deployment Guide

Your shoe-store is a full-stack Node.js application that needs a platform that supports:
- Node.js runtime
- File system access (for images)
- SQLite database
- Express.js server

## Option 1: Vercel (Recommended - Free & Easy)

Vercel supports Node.js and is perfect for this app.

### Steps:

1. **Install Vercel CLI** (if you don't have it):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from your project folder**:
   ```bash
   cd /Users/craigdalessio/shoe-store
   vercel
   ```

3. **Follow the prompts:**
   - Link to existing project? No
   - Project name: shoe-store
   - Directory: ./
   - Override settings? No

4. **After deployment**, you'll get a URL like: `https://shoe-store.vercel.app`

5. **For production**, run:
   ```bash
   vercel --prod
   ```

### Note: File Storage
Vercel has read-only file system. For file uploads, you'll need to:
- Use a cloud storage service (AWS S3, Cloudinary, etc.)
- Or use Vercel Blob Storage
- Or keep using local storage for development

## Option 2: Render (Free Tier Available)

1. Go to https://render.com
2. Sign up/login
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Settings:
   - Name: shoe-store
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
6. Click "Create Web Service"

## Option 3: Railway (Easy Deployment)

1. Go to https://railway.app
2. Sign up/login
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your shoe-store repo
5. Railway auto-detects Node.js and deploys

## Option 4: Heroku (Classic Option)

1. Install Heroku CLI
2. Run:
   ```bash
   heroku create shoe-store
   git push heroku main
   ```

## Important Notes:

- **Database**: SQLite works on these platforms, but data may be ephemeral
- **File Uploads**: Consider using cloud storage for production
- **Environment Variables**: Set PORT if needed (most platforms auto-set)
- **Static Files**: Make sure `public/` folder is served correctly

## Quick Deploy to Vercel (Easiest):

```bash
cd /Users/craigdalessio/shoe-store
npm install -g vercel
vercel
```

That's it! Your app will be live in minutes.


