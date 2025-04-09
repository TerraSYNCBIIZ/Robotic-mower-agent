const { execSync } = require('child_process');

/**
 * Kill processes using specific ports (Windows version)
 */
function killPortWindows(port) {
  try {
    // Find PID of process using the port
    const findCommand = `netstat -ano | findstr :${port}`;
    console.log(`Running: ${findCommand}`);
    
    const result = execSync(findCommand, { encoding: 'utf8' });
    console.log(`Result: ${result}`);
    
    // Extract PIDs
    const lines = result.split('\n').filter(line => line.includes(`LISTENING`));
    
    if (lines.length === 0) {
      console.log(`No process found using port ${port}`);
      return;
    }
    
    // Extract and kill each PID
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) {
        console.log(`Killing process ${pid} using port ${port}`);
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Process ${pid} killed successfully`);
      }
    }
  } catch (error) {
    if (error.status === 1 && error.stderr.includes('No tasks')) {
      console.log(`No process found using port ${port}`);
    } else {
      console.error(`Error killing process on port ${port}:`, error.message);
    }
  }
}

// Kill processes on port 3000
try {
  console.log('Checking for processes using port 3000...');
  killPortWindows(3000);
  
  console.log('All done! You can now start the application.');
} catch (error) {
  console.error('Error in port killing script:', error);
} 