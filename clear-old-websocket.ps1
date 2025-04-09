# Script to safely remove old WebSocket implementation files
# This script will create backups of the files before deleting them

# Create a backup directory with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_websocket_$timestamp"
mkdir -p $backupDir

Write-Host "Creating backup directory: $backupDir" -ForegroundColor Green

# Files to back up and remove
$filesToRemove = @(
    "src/services/husqvarnaWebSocket.ts", 
    "src/services/clientWebSocketService.ts",
    "src/services/mockWebSocketService.ts",
    "src/firebase/websocketConnector.ts",
    "src/firebase/websocketMonitor.ts",
    "src/components/WebSocketStatus.tsx",
    "src/components/MiniWebSocketStatus.tsx"
)

# Back up files before removing
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        $backupFile = "$backupDir/$($file -replace '/', '_')"
        Write-Host "Backing up $file to $backupFile" -ForegroundColor Yellow
        Copy-Item $file $backupFile
    } else {
        Write-Host "File $file does not exist, skipping backup" -ForegroundColor Gray
    }
}

# Ask for confirmation before removing files
Write-Host "`nThe following files will be removed:" -ForegroundColor Red
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host " - $file" -ForegroundColor Red
    }
}

$confirmation = Read-Host "`nAre you sure you want to remove these files? (y/N)"
if ($confirmation -ne "y") {
    Write-Host "Operation cancelled. Files are backed up in $backupDir but not deleted." -ForegroundColor Yellow
    exit
}

# Remove files
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host "Removing $file" -ForegroundColor Red
        Remove-Item $file
    }
}

Write-Host "`nCleanup complete. Old WebSocket implementation has been removed." -ForegroundColor Green
Write-Host "Backups of the removed files are available in the $backupDir directory." -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Make sure you've installed the WebSocket proxy dependencies:" -ForegroundColor Cyan
Write-Host "   cd websocket-proxy && npm install" -ForegroundColor White
Write-Host "2. Start the application with the WebSocket proxy:" -ForegroundColor Cyan
Write-Host "   .\start-with-proxy.ps1" -ForegroundColor White
Write-Host "3. Navigate to the WebSocket proxy status page:" -ForegroundColor Cyan
Write-Host "   http://localhost:3000/websocket-proxy" -ForegroundColor White 