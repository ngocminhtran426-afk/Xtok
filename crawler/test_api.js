const fetch = require('node-fetch');

async function check() {
  const res = await fetch('http://localhost:4000/api/ping-db');
  const ping = await res.json();
  console.log('Ping:', ping);
}

check();
