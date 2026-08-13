const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  console.log("Navigating to xnhau.ink...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'networkidle2' });
  
  console.log("Waiting for cloudflare challenge to pass...");
  await new Promise(r => setTimeout(r, 5000)); // wait a bit
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('xnhau_debug.html', html);
  console.log("HTML saved to xnhau_debug.html");
  
  const match = html.match(/https:\/\/[^"']*\.mp4/);
  console.log("Regex match:", match ? match[0] : "No match");
  
  await browser.close();
})();
