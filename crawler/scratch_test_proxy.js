const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const https = require('https');

async function test() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to embed to get clearance...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  console.log("Please click Captcha if it appears. Waiting 15 seconds...");
  await page.waitForTimeout(15000);
  
  const cookies = await context.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log("Cookies:", cookieStr ? "Got cookies" : "No cookies");
  
  const targetUrl = 'https://xnhau.ink/video/37851.mp4';
  
  console.log("Testing https.get proxy...");
  const headers = {
      'User-Agent': await page.evaluate(() => navigator.userAgent),
      'Referer': 'https://xnhau.ink/',
      'Cookie': cookieStr,
      'Accept': '*/*'
  };
  
  https.get(targetUrl, { headers }, (res) => {
      console.log("Proxy Status:", res.statusCode);
      if (res.statusCode >= 400) {
          res.on('data', chunk => console.log(chunk.toString().substring(0, 200)));
      }
      browser.close();
  }).on('error', err => {
      console.error(err);
      browser.close();
  });
}
test().catch(console.error);
