@echo off
echo --------------------------------------------------------
echo Starting Robotic Mower Agent servers...
echo --------------------------------------------------------
echo This will start both:
echo 1. WebSocket Proxy (for real-time mower updates)
echo 2. Next.js Development Server
echo --------------------------------------------------------
echo.

rem Load environment variables for Husqvarna API credentials
set ENV_FILE=.env.local
if exist %ENV_FILE% (
  echo Loading environment variables from %ENV_FILE%...
  for /F "tokens=*" %%A in (%ENV_FILE%) do set %%A
  echo Environment variables loaded.
) else (
  echo Warning: %ENV_FILE% not found. Make sure Husqvarna API credentials are set.
)

rem Start WebSocket proxy server in a new window
echo Starting WebSocket Proxy Server on port 8000...
set PROXY_TITLE=Husqvarna WebSocket Proxy
start "%PROXY_TITLE%" cmd /c "npm run proxy:ws && pause"

rem Wait for the proxy to initialize
echo Waiting for proxy server to initialize...
timeout /t 3 /nobreak > nul

rem Check if proxy server started successfully (very basic check)
netstat -ano | find ":8000" > nul
if %ERRORLEVEL% EQU 0 (
  echo WebSocket Proxy Server started successfully!
) else (
  echo Warning: Could not verify WebSocket Proxy Server is running.
  echo The Next.js server will still start, but real-time updates may not work.
  echo.
  pause
)

rem Start Next.js development server
echo Starting Next.js development server...
npm run dev

rem If we get here, the Next.js server was closed
echo.
echo Next.js server stopped.
echo WebSocket Proxy Server might still be running in another window.
echo To completely stop all servers, close the WebSocket Proxy window.
echo.
pause 