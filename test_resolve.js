fetch('https://xnhau.ink/embed/447352', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}).then(r => r.text()).then(h => {
  const match = h.match(/https:\/\/[^"']*\.mp4/);
  console.log(match ? match[0] : 'Not Found');
});
