const http = require('http');
http.get('http://localhost:4321/api/debug/chapters', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data); });
}).on('error', (err) => {
  console.error(err);
});
