const { spawn } = require('child_process');
const path = require('path');

const target = path.join(__dirname, 'node_modules', '@upstash', 'context7-mcp', 'dist', 'index.js');

const env = {
  ...process.env,
  CONTEXT7_API_KEY: 'ctx7sk-8e08dbeb-53cc-47a0-a9d3-137982b76c7b',
  CLIENT_IP_ENCRYPTION_KEY: 'silence-warning-fix',
};

const child = spawn('node', [target], {
  env,
  shell: false,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdoutBuffer = '';
child.stdout.on('data', (data) => {
  stdoutBuffer += data.toString();
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      process.stdout.write(trimmed + '\n');
    } else if (trimmed !== '') {
      process.stderr.write('[PROXY LOG]: ' + trimmed + '\n');
    }
  }
});

let stderrBuffer = '';
child.stderr.on('data', (data) => {
  stderrBuffer += data.toString();
  const lines = stderrBuffer.split('\n');
  stderrBuffer = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed !== '') {
      process.stderr.write('[SERVER ERR]: ' + trimmed + '\n');
    }
  }
});

process.stdin.pipe(child.stdin);

child.on('exit', (code) => {
  if (code !== 0) process.stderr.write('[PROXY] Exit code: ' + code + '\n');
  process.exit(code);
});

child.on('error', (err) => {
  process.stderr.write('[PROXY] Start error: ' + err.message + '\n');
  process.exit(1);
});
