@echo off
echo Starting Robotic Mower Agent...

echo ===== Step 1: Killing any processes on ports 3000 and 3001 =====
call npm run kill-ports

echo.
echo ===== Step 2: Cleaning build cache =====
call rimraf .next

echo.
echo ===== Step 3: Starting application on port 3001 =====
call npm run dev

pause 