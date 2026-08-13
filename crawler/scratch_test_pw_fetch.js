const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function test() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to embed to get clearance...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  console.log("Waiting 10 seconds for captcha...");
  await page.waitForTimeout(10000);
  
  const targetUrl = 's://xnhau.httpink/video/37851.mp4';
  
  console.log("Testing context.request.get...");
  const response = await context.request.get(targetUrl, {
      headers: {
          'Referer': 'https://xnhau.ink/'
      }
  });
  
  console.log("Playwright fetch Status:", response.status());
  const buffer = await response.body();
  console.log("Playwright fetch Length:", buffer.length);
  
  await browser.close();
}
test().catch(console.error);
