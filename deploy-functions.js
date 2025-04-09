const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Preparing to deploy Firebase functions with CORS support...');

// Ensure necessary dependencies are installed
try {
  console.log('Installing CORS package...');
  execSync('npm install cors --save', { stdio: 'inherit' });
  console.log('CORS package installed successfully.');
} catch (error) {
  console.error('Error installing CORS package:', error);
  process.exit(1);
}

// Make sure Firebase CLI is installed
try {
  execSync('firebase --version', { stdio: 'inherit' });
} catch (error) {
  console.error('Firebase CLI not found. Please install it globally with:');
  console.error('npm install -g firebase-tools');
  process.exit(1);
}

// Prepare for deployment
console.log('Building project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Deploy functions
console.log('Deploying Firebase functions...');
try {
  execSync('firebase deploy --only functions', { stdio: 'inherit' });
  console.log('Firebase functions deployed successfully with CORS support.');
  
  console.log('\nTo test the WebSocket connection, visit:');
  console.log('http://localhost:3000/websocket');
  console.log('\nOr manually trigger the function with:');
  console.log('curl -X POST -H "Content-Type: application/json" -H "Origin: http://localhost:3000" https://us-central1-robotic-mower-agent.cloudfunctions.net/initiateWebSocketConnectionHttp');
} catch (error) {
  console.error('Deployment failed:', error);
  process.exit(1);
} 