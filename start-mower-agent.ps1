Write-Host "Starting Robotic Mower Agent..." -ForegroundColor Green

Write-Host "===== Step 1: Killing any processes on ports 3000 =====" -ForegroundColor Yellow
npm run kill-ports

Write-Host "===== Step 2: Cleaning build cache =====" -ForegroundColor Yellow
if (Test-Path -Path ".next") {
    Write-Host "Removing .next directory..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force .next
} else {
    Write-Host ".next directory doesn't exist, skipping..." -ForegroundColor Cyan
}

Write-Host "===== Step 3: Installing dependencies if needed =====" -ForegroundColor Yellow
npm install

Write-Host "===== Step 4: Starting application on port 3000 =====" -ForegroundColor Green
npm run dev

pause 