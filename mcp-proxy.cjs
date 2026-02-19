const { spawn } = require('node:child_process');
const path = require('node:path');

const target = path.join(__dirname, 'node_modules', '@upstash', 'context7-mcp', 'dist', 'index.js');

const env = {
  ...process.env,
  CONTEXT7_API_KEY: 'ctx7sk-8e08dbeb-53cc-47a0-a9d3-137982b76c7b',
  CLIENT_IP_ENCRYPTION_KEY: 'silence-warning-fix',
};

const child = spawn('node', [target], {
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

function processOutput(stream, label) {
  let buffer = '';
  stream.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        process.stdout.write(`${trimmed}\n`);
      } else if (trimmed !== '') {
        process.stderr.write(`[PROXY LOG]: ${trimmed}\n`);
      }
    }
  });
}

processOutput(child.stdout, 'STDOUT');

child.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed !== '') {
      process.stderr.write(`[SERVER ERR]: ${trimmed}\n`);
    }
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
