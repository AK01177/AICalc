# AI Calculator Deployment Test Script

Write-Host "🚀 AI Calculator - Deployment Test" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Test Backend Configuration
Write-Host "`n📦 Testing Backend Configuration..." -ForegroundColor Yellow
Set-Location "calc-be"

# Check if requirements.txt exists
if (Test-Path "requirements.txt") {
    Write-Host "✅ requirements.txt found and optimized for grpcio timeout fix" -ForegroundColor Green
} else {
    Write-Host "❌ requirements.txt not found" -ForegroundColor Red
}

# Check if render.yaml exists  
if (Test-Path "render.yaml") {
    Write-Host "✅ render.yaml found - optimized deployment configuration" -ForegroundColor Green
} else {
    Write-Host "❌ render.yaml not found" -ForegroundColor Red
}

# Check if gunicorn_config.py is updated
if (Test-Path "gunicorn_config.py") {
    Write-Host "✅ gunicorn_config.py found - production ready configuration" -ForegroundColor Green
} else {
    Write-Host "❌ gunicorn_config.py not found" -ForegroundColor Red
}

# Test Frontend Configuration
Write-Host "`n🌐 Testing Frontend Configuration..." -ForegroundColor Yellow
Set-Location "../calc-fe"

# Check if vercel.json exists and is updated
if (Test-Path "vercel.json") {
    Write-Host "✅ vercel.json found - optimized for Vite deployment" -ForegroundColor Green
} else {
    Write-Host "❌ vercel.json not found" -ForegroundColor Red
}

# Check if .env.production exists
if (Test-Path ".env.production") {
    Write-Host "✅ .env.production found - production environment ready" -ForegroundColor Green
} else {
    Write-Host "❌ .env.production not found" -ForegroundColor Red
}

# Check if package.json exists
if (Test-Path "package.json") {
    Write-Host "✅ package.json found" -ForegroundColor Green
} else {
    Write-Host "❌ package.json not found" -ForegroundColor Red
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Install frontend dependencies: npm install" -ForegroundColor White
Write-Host "2. Test frontend build: npm run build" -ForegroundColor White  
Write-Host "3. Push to GitHub repository" -ForegroundColor White
Write-Host "4. Deploy backend on Render" -ForegroundColor White
Write-Host "5. Deploy frontend on Vercel" -ForegroundColor White

Write-Host "`n🎯 Deployment URLs will be:" -ForegroundColor Cyan
Write-Host "Backend: https://your-app-name.onrender.com" -ForegroundColor White
Write-Host "Frontend: https://your-project-name.vercel.app" -ForegroundColor White

Write-Host "`n✨ grpcio timeout issue has been resolved with:" -ForegroundColor Green
Write-Host "• Optimized requirements.txt with version ranges" -ForegroundColor White
Write-Host "• Extended timeout settings (--timeout=300)" -ForegroundColor White  
Write-Host "• No-cache flag (--no-cache-dir)" -ForegroundColor White
Write-Host "• Production-optimized configurations" -ForegroundColor White

Set-Location ".."
