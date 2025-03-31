@echo off
echo Starting Husqvarna Robotic Mower application...

REM Set environment variables from .env.local
for /F "tokens=1,2 delims==" %%G in (.env.local) do (
    IF NOT "%%G"=="" (
        IF NOT "%%G:~0,1%"=="#" (
            set "%%G=%%H"
            echo Set %%G
        )
    )
)

echo Starting WebSocket proxy server...
start cmd /k "set HUSQVARNA_APP_KEY=PVS8dXYLf9gTXu4ASPPH3uzJyqf4EXFT && set HUSQVARNA_CLIENT_SECRET=GJRzvmUvMr6be3AF && node websocket-proxy/server.js"

echo Starting Next.js development server...
start cmd /k "set HUSQVARNA_APP_KEY=PVS8dXYLf9gTXu4ASPPH3uzJyqf4EXFT && set HUSQVARNA_CLIENT_SECRET=GJRzvmUvMr6be3AF && npx next dev -p 3000"

echo Both servers started! Access the application at http://localhost:3000 