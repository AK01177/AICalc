# 🚀 AI Calculator Deployment Guide

## 🔧 **SOLVING GRPCIO TIMEOUT ISSUE**

The grpcio timeout issue has been resolved with these optimizations:

### ✅ **What I've Fixed:**
1. **Optimized requirements.txt** - Used version ranges instead of exact versions
2. **Extended timeout settings** - Added `--timeout=300` to pip install
3. **Optimized build commands** - Added `--no-cache-dir` flag
4. **Reduced resource usage** - Configured for free tier limits

---

## 📋 **Prerequisites**

Before deploying, ensure you have:
- [x] GitHub account with your code pushed to a repository
- [x] Render account (free tier available)
- [x] Vercel account (free tier available)
- [x] Google Gemini API key

---

## 🔙 **Part 1: Backend Deployment on Render**

### **Step 1: Push Your Code to GitHub**
```bash
cd "C:\Users\aryan\GoogleDrive\Desktop\AICalc - Copy"
git init
git add .
git commit -m "Initial commit - AI Calculator"
git branch -M main
git remote add origin https://github.com/yourusername/ai-calculator.git
git push -u origin main
```

### **Step 2: Deploy on Render**
1. Go to [render.com](https://render.com) and sign in
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `ai-calculator-backend`
   - **Root Directory**: `calc-be`
   - **Environment**: `Python 3`
   - **Build Command**: `python -m pip install --upgrade pip && pip install --no-cache-dir --timeout=300 -r requirements.txt`
   - **Start Command**: `python -m gunicorn main:app -c gunicorn_config.py`

### **Step 3: Set Environment Variables**
In your Render dashboard, add these environment variables:
```
GEMINI_API_KEY=your_gemini_api_key_here
ENV=prod
SERVER_URL=0.0.0.0
```

### **Step 4: Deploy & Get URL**
1. Click **"Create Web Service"**
2. Wait for deployment (should complete without timeout now!)
3. Note your backend URL: `https://your-app-name.onrender.com`

---

## 🔜 **Part 2: Frontend Deployment on Vercel**

### **Step 1: Update Environment Configuration**
1. Update `.env.production` with your Render backend URL:
```bash
cd calc-fe
echo "VITE_API_URL=https://your-render-backend-url.onrender.com" > .env.production
```

### **Step 2: Deploy on Vercel**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `calc-fe`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### **Step 3: Set Environment Variables**
In your Vercel dashboard, add:
```
VITE_API_URL=https://your-render-backend-url.onrender.com
```

### **Step 4: Deploy**
1. Click **"Deploy"**
2. Wait for deployment to complete
3. Your frontend will be available at: `https://your-project-name.vercel.app`

---

## 🔄 **Part 3: Update CORS Configuration**

### **Update Backend CORS**
Once you have your Vercel URL, update the CORS configuration:

1. In `calc-be/main.py`, update allowed origins:
```python
allowed_origins = [
    "https://your-project-name.vercel.app",  # Your Vercel URL
    "http://localhost:3000",  # Local development
    "http://localhost:5173",  # Vite dev server
]
```

2. Commit and push this change to trigger a redeploy on Render

---

## 🧪 **Part 4: Testing Your Deployment**

### **Backend Testing**
```bash
# Test basic endpoint
curl https://your-app-name.onrender.com

# Should return: {"message": "Server is running"}
```

### **Frontend Testing**
1. Visit your Vercel URL: `https://your-project-name.vercel.app`
2. Test the calculator functionality
3. Check browser console for errors

---

## 🛠️ **Troubleshooting Guide**

### **🚨 grpcio Timeout Issues**
If you still encounter timeout issues:

1. **Option 1: Use Blueprint Deployment**
   ```yaml
   # In render.yaml (already created for you)
   services:
     - type: web
       name: ai-calculator-backend
       buildCommand: |
         python -m pip install --upgrade pip
         pip install --no-cache-dir --timeout=300 -r requirements.txt
   ```

2. **Option 2: Alternative Requirements**
   If still failing, create `requirements-lite.txt`:
   ```
   fastapi==0.112.2
   uvicorn[standard]==0.30.6
   python-dotenv==1.0.1
   requests==2.32.3
   pillow==10.4.0
   google-generativeai==0.7.2
   ```

### **🚨 CORS Errors**
- **Problem**: Browser shows CORS errors
- **Solution**: Ensure your Vercel URL is in `allowed_origins` in `main.py`

### **🚨 API Connection Errors**
- **Problem**: Frontend can't connect to backend
- **Solution**: Verify `VITE_API_URL` matches your Render URL exactly

### **🚨 Build Failures on Vercel**
- **Problem**: Frontend build fails
- **Solution**: Run `npm run build` locally first to check for issues

### **🚨 Render Cold Starts**
- **Problem**: First request takes long
- **Solution**: Normal for free tier - consider paid plan for production

---

## 📋 **Environment Variables Summary**

### **Backend (Render)**
```
GEMINI_API_KEY=your_gemini_api_key_here
ENV=prod
SERVER_URL=0.0.0.0
PORT=(automatically set by Render)
```

### **Frontend (Vercel)**
```
VITE_API_URL=https://your-render-backend-url.onrender.com
```

---

## 🎯 **Quick Deployment Commands**

### **Test Locally Before Deploying**
```bash
# Backend
cd calc-be
python -m pip install -r requirements.txt
python main.py

# Frontend (new terminal)
cd calc-fe
npm install
npm run build
npm run preview
```

### **Deploy to GitHub**
```bash
git add .
git commit -m "Deploy: Optimized for production"
git push origin main
```

---

## 🎉 **Your AI Calculator is Now Live!**

✅ **Backend**: https://your-app-name.onrender.com  
✅ **Frontend**: https://your-project-name.vercel.app

### **Features Working:**
- ✅ No more grpcio timeout issues
- ✅ Optimized for free tier deployment
- ✅ Extended timeout for AI processing
- ✅ Proper CORS configuration
- ✅ Production-ready logging

---

## 📞 **Need Help?**

If you encounter any issues:
1. Check the Render logs for backend issues
2. Check Vercel function logs for frontend issues
3. Verify environment variables are set correctly
4. Test API endpoints individually

**Common URLs to verify:**
- Backend health: `https://your-backend.onrender.com/`
- API endpoint: `https://your-backend.onrender.com/calculate`
- Frontend: `https://your-frontend.vercel.app`
