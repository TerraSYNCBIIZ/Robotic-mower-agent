/**
 * Deployment helper script for Firebase Functions
 * 
 * This script assists with deploying the WebSocket integration functions.
 * Run with `node deploy-firebase-functions.js`
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper for console output
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`)
};

// Execute command and return output
function execute(command) {
  try {
    log.info(`Executing: ${command}`);
    return execSync(command, { stdio: 'inherit' });
  } catch (error) {
    log.error(`Command failed: ${command}`);
    log.error(error.message);
    process.exit(1);
  }
}

// Check if required files exist
function checkRequiredFiles() {
  log.step('Checking required files...');
  
  const requiredFiles = [
    'src/services/husqvarnaWebSocket.ts',
    'src/services/throttleService.ts',
    'src/firebase/websocketConnector.ts',
    'src/firebase/websocketMonitor.ts',
    'src/lib/errorCodes.ts'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (!fs.existsSync(path.resolve(process.cwd(), file))) {
      log.error(`Missing required file: ${file}`);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    log.error('Please make sure all required files exist before deploying');
    process.exit(1);
  }
  
  log.success('All required files exist');
}

// Check if dependencies are installed
function checkDependencies() {
  log.step('Checking dependencies...');
  
  // Check for ws package
  try {
    require.resolve('ws');
    log.success('WebSocket dependency found');
  } catch (e) {
    log.warning('WebSocket dependency not found, installing...');
    execute('npm install ws @types/ws');
  }
  
  // Check for Firebase Admin SDK
  try {
    require.resolve('firebase-admin');
    log.success('Firebase Admin SDK found');
  } catch (e) {
    log.warning('Firebase Admin SDK not found, installing...');
    execute('npm install firebase-admin');
  }
  
  // Check for Firebase Functions
  try {
    require.resolve('firebase-functions');
    log.success('Firebase Functions SDK found');
  } catch (e) {
    log.warning('Firebase Functions SDK not found, installing...');
    execute('npm install firebase-functions');
  }
}

// Deploy the functions
function deployFunctions() {
  log.step('Deploying Firebase Functions...');
  
  // Build TypeScript files
  log.info('Building project...');
  execute('npm run build');
  
  // Deploy functions
  log.info('Deploying WebSocket functions...');
  execute('firebase deploy --only functions:initiateWebSocketConnection,functions:monitorWebSocketHealth');
  
  log.success('WebSocket functions deployed successfully!');
  log.info('The WebSocket connection will be automatically initiated on deployment.');
  log.info('You do not need to manually call initiateWebSocketConnection() for the initial connection.');
}

// Main function
function main() {
  console.log('\n');
  log.info(`${colors.magenta}========= WebSocket Integration Deployment =========`);
  console.log('\n');
  
  checkRequiredFiles();
  console.log('\n');
  
  checkDependencies();
  console.log('\n');
  
  deployFunctions();
  console.log('\n');
  
  log.success('Deployment completed successfully!');
  log.info('The WebSocket connection is now active:');
  log.info('1. Initial connection was automatically established during deployment');
  log.info('2. The monitorWebSocketHealth function will run every 8 minutes to ensure it stays alive');
  log.info('3. Check the Firestore database for updated mower data');
  console.log('\n');
}

// Run the script
main(); 