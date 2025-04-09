# Start both the Next.js application and WebSocket proxy server
Write-Host "Starting Robotic Mower Agent with WebSocket Proxy" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

# Function to check if port is in use
function Test-PortInUse {
    param (
        [int]$Port
    )
    $portInUse = $false
    $connections = netstat -ano | findstr ":$Port "
    
    if ($connections) {
        $portInUse = $true
    }
    
    return $portInUse
}

# Kill processes on ports if needed
function Kill-ProcessOnPort {
    param (
        [int]$Port
    )
    if (Test-PortInUse -Port $Port) {
        Write-Host "Port $Port is in use. Attempting to kill process..." -ForegroundColor Yellow
        $connections = netstat -ano | findstr ":$Port "
        
        foreach ($line in $connections) {
            $parts = $line -split '\s+', 6
            if ($parts.Length -gt 4) {
                # Make sure we have a valid process ID (numeric)
                $procId = $parts[4]
                if ($procId -match '^\d+$') {
                    Write-Host "Killing process ID: $procId" -ForegroundColor Yellow
                    taskkill /PID $procId /F
                } else {
                    Write-Host "Skipping non-process state: $procId" -ForegroundColor Gray
                }
            }
        }
    }
}

# Kill processes on port 3000 and 8080 if in use
Kill-ProcessOnPort -Port 3000
Kill-ProcessOnPort -Port 8080

# Create new .env file for the WebSocket proxy if it doesn't exist
$envPath = ".\websocket-proxy\.env"
if (-Not (Test-Path $envPath)) {
    Write-Host "Creating .env file for WebSocket proxy..." -ForegroundColor Yellow
    
    # Get values from main .env.local file if available
    $mainEnvPath = ".\.env.local"
    $apiKey = ""
    $clientId = ""
    $clientSecret = ""
    
    if (Test-Path $mainEnvPath) {
        $envContent = Get-Content $mainEnvPath
        foreach ($line in $envContent) {
            if ($line -match "HUSQVARNA_API_KEY=(.*)") {
                $apiKey = $matches[1]
            }
            if ($line -match "HUSQVARNA_CLIENT_ID=(.*)") {
                $clientId = $matches[1]
            }
            if ($line -match "HUSQVARNA_CLIENT_SECRET=(.*)") {
                $clientSecret = $matches[1]
            }
        }
    }
    
    $proxyEnvContent = @"
HUSQVARNA_API_KEY=$apiKey
HUSQVARNA_CLIENT_ID=$clientId
HUSQVARNA_CLIENT_SECRET=$clientSecret
FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json
PORT=8080
"@
    
    Set-Content -Path $envPath -Value $proxyEnvContent
    Write-Host "WebSocket proxy .env file created. Please verify the credentials." -ForegroundColor Yellow
}

# Install dependencies for WebSocket proxy if needed
if (-Not (Test-Path ".\websocket-proxy\node_modules")) {
    Write-Host "Installing WebSocket proxy dependencies..." -ForegroundColor Yellow
    Push-Location ".\websocket-proxy"
    npm install
    Pop-Location
}

# Start WebSocket proxy in a new terminal
Write-Host "Starting WebSocket proxy server..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-Command cd '$PWD\websocket-proxy' && npm start"

# Wait a moment for the proxy to start
Start-Sleep -Seconds 3

# Start the main application
Write-Host "Starting main application..." -ForegroundColor Green
npm run dev

# This script will end when the main application is closed
# The proxy server will continue running in its own window 