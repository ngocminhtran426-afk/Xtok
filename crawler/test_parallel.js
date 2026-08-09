const fetch = require('node-fetch');

async function testParallel() {
  const promises = [];
  for (let i = 1; i <= 20; i++) {
    promises.push(
      fetch(`https://api.dicebear.com/10.x/clay/svg?seed=${i}`)
        .then(res => `Seed ${i}: ${res.status}`)
        .catch(err => `Seed ${i}: Error`)
    );
  }
  const results = await Promise.all(promises);
  console.log(results.join('\n'));
}

testParallel();
