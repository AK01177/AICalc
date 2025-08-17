# Deployment Guide: AI Calculator

This guide will help you deploy your AI Calculator application with the backend on **Render** and the frontend on **Vercel**.

## Architecture Overview
- **Backend**: FastAPI application deployed on Render
- **Frontend**: React/Vite application deployed on Vercel
- **Database**: Not required for this application
- **External APIs**: Google Gemini AI API

## Prerequisites

Before deploying, ensure you have:
1. A GitHub account with your code pushed to a repository
2. A Render account (free tier available)
3. A Vercel account (free tier available)
4. A Google Gemini API key

## Part 1: Backend Deployment on Render

### Step 1: Prepare Your Repository
1. Ensure your code is pushed to GitHub
2. Make sure the `render.yaml` file is in your `calc-be` directory

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `ai-calculator-backend` (or your preferred name)
   - **Root Directory**: `calc-be`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 3: Set Environment Variables
In your Render dashboard, add these environment variables:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `ENV`: `prod`
- `SERVER_URL`: `0.0.0.0`

### Step 4: Deploy
1. Click "Create Web Service"
2. Wait for the deployment to complete
3. Note your backend URL (e.g., `https://your-app-name.onrender.com`)

## Part 2: Frontend Deployment on Vercel

### Step 1: Update Environment Configuration
1. In your `calc-fe` directory, create a `.env.production` file:
   ```
   VITE_API_URL=https://your-render-backend-url.onrender.com
   ```
   Replace `your-render-backend-url` with your actual Render URL from Step 1.

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `calc-fe`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Set Environment Variables
In your Vercel dashboard, add this environment variable:
- `VITE_API_URL`: `https://your-render-backend-url.onrender.com`

### Step 4: Deploy
1. Click "Deploy"
2. Wait for the deployment to complete
3. Your frontend will be available at `https://your-project-name.vercel.app`

## Part 3: Update CORS Configuration

### Step 1: Update Backend CORS
Once you have your Vercel URL, update the CORS configuration in your backend:

1. In `calc-be/main.py`, replace the wildcard CORS with your specific Vercel URL:
   ```python
   allowed_origins = [
       "https://your-project-name.vercel.app",  # Your Vercel URL
       "http://localhost:3000",  # Local development
       "http://localhost:5173",  # Vite dev server
   ]
   ```

2. Commit and push this change to trigger a redeploy on Render

## Part 4: Testing Your Deployment

### Backend Testing
1. Visit your Render URL: `https://your-app-name.onrender.com`
2. You should see: `{"message": "Server is running"}`
3. Test the API endpoint: `https://your-app-name.onrender.com/calculate`

### Frontend Testing
1. Visit your Vercel URL: `https://your-project-name.vercel.app`
2. Test the calculator functionality
3. Check browser console for any CORS or API connection errors

## Troubleshooting

### Common Issues and Solutions

#### 1. CORS Errors
- **Problem**: Browser shows CORS errors when making API calls
- **Solution**: Ensure your Vercel URL is added to the CORS `allowed_origins` in `main.py`

#### 2. API Connection Errors
- **Problem**: Frontend can't connect to backend
- **Solution**: Verify the `VITE_API_URL` environment variable in Vercel matches your Render URL exactly

#### 3. Build Failures on Vercel
- **Problem**: Frontend build fails
- **Solution**: Check that all dependencies are listed in `package.json` and run `npm run build` locally first

#### 4. Gemini API Errors
- **Problem**: Backend returns errors related to Gemini API
- **Solution**: Verify your `GEMINI_API_KEY` is correctly set in Render environment variables

#### 5. Cold Start Delays on Render (Free Tier)
- **Problem**: First request takes a long time
- **Solution**: This is normal for free tier services. Consider upgrading to a paid plan for production use

## Environment Variables Summary

### Backend (Render)
- `GEMINI_API_KEY`: Your Google Gemini API key
- `ENV`: `prod`
- `SERVER_URL`: `0.0.0.0`

### Frontend (Vercel)
- `VITE_API_URL`: Your Render backend URL

## Post-Deployment Steps

1. **Custom Domain** (Optional): Add a custom domain in both Render and Vercel dashboards
2. **SSL Certificate**: Both platforms provide free SSL certificates automatically
3. **Monitoring**: Set up monitoring and alerts for your services
4. **Analytics**: Consider adding analytics to track usage

## Updating Your Deployment

### Backend Updates
1. Push changes to your GitHub repository
2. Render will automatically redeploy

### Frontend Updates
1. Push changes to your GitHub repository
2. Vercel will automatically redeploy

## Cost Considerations

### Free Tier Limits
- **Render**: 750 hours/month, 512MB RAM, automatic sleeping after 15 minutes of inactivity
- **Vercel**: 100 deployments/month, 6,000 minutes build time, 100GB bandwidth

### When to Upgrade
Consider upgrading to paid plans when you need:
- No cold starts/sleeping
- More compute resources
- Custom domains
- Priority support
- Higher usage limits

## Security Best Practices

1. **Environment Variables**: Never commit API keys to your repository
2. **CORS**: Use specific origins instead of wildcards in production
3. **API Keys**: Regularly rotate your Gemini API key
4. **Monitoring**: Set up logging and monitoring for your services

---

Your AI Calculator is now deployed and accessible worldwide! 🎉

**Frontend**: https://your-project-name.vercel.app
**Backend**: https://your-app-name.onrender.com
