const fetch = require('node-fetch');

async function test() {
  for (let i = 1; i <= 20; i++) {
    const res = await fetch(`https://api.dicebear.com/10.x/clay/svg?seed=${i}`);
    console.log(`Seed ${i}: ${res.status}`);
  }
}
test();
