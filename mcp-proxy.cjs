const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const target = path.join(__dirname, 'node_modules', '@upstash', 'context7-mcp', 'dist', 'index.js');

if (!fs.existsSync(target)) {
  process.stderr.write(`[PROXY ERROR] Target not found: ${target}\n`);
  process.exit(1);
}

const env = {
  ...process.env,
  CONTEXT7_API_KEY: 'ctx7sk-8e08dbeb-53cc-47a0-a9d3-137982b76c7b',
  CLIENT_IP_ENCRYPTION_KEY: 'silence-warning-fix',
};

// Forzamos el transporte stdio para MCP
const child = spawn('node', [target, '--transport', 'stdio'], {
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  const msg = data.toString();
  // Solo logueamos si no es ruido
  if (msg.trim()) {
    process.stderr.write(`[SERVER]: ${msg}`);
  }
});

child.on('exit', (code) => {
  if (code !== 0) process.stderr.write(`[PROXY] Exit code: ${code}\n`);
  process.exit(code);
});

child.on('error', (err) => {
  process.stderr.write(`[PROXY] Start error: ${err.message}\n`);
  process.exit(1);
});
