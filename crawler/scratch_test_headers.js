const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function test() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to embed...");
  
  page.on('response', async (response) => {
      if (response.url().includes('/embed/')) {
          console.log("Embed Response Headers:", response.headers());
      }
  });

  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  console.log("Please solve captcha in 15s...");
  await page.waitForTimeout(15000);
  
  console.log("Reloading embed to see headers after clearance...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  await browser.close();
}
test().catch(console.error);
