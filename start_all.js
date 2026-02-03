const { spawn } = require('child_process');
const path = require('path');

function runCommand(command, args, cwd) {
    const child = spawn(command, args, {
        cwd: cwd,
        shell: true,
        stdio: 'inherit'
    });

    child.on('error', (err) => {
        console.error(`Failed to start ${command}:`, err);
    });

    return child;
}

console.log('Starting Backend...');
runCommand('npm', ['start'], path.join(__dirname, 'backend'));

console.log('Starting Frontend...');
runCommand('npm', ['run', 'dev'], path.join(__dirname, 'frontend'));

// Open Browser automatically after 5 seconds
setTimeout(() => {
    console.log('Opening Browser...');
    const url = 'http://localhost:5173';
    // Windows: start, Mac: open, Linux: xdg-open
    const startCmd = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');

    require('child_process').exec(`${startCmd} ${url}`, (err) => {
        if (err) console.error('Failed to open browser:', err);
    });
}, 5000);
