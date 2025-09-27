const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Digital Mail Letter server...');
console.log('📂 Working directory:', process.cwd());
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 Database URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
console.log('🚪 Port:', process.env.PORT || 4000);

// Start the main application
const server = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`🔄 Server exited with code ${code}`);
  process.exit(code);
});
