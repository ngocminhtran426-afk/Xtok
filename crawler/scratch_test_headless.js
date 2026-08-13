const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function test() {
  console.log("Launching headless Playwright...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log("Navigating to embed page...");
  try {
    await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
    console.log("Waiting 15 seconds to see if Cloudflare auto-resolves in headless mode...");
    await page.waitForTimeout(15000);
    
    await page.screenshot({ path: 'headless_cf.png' });
    console.log("Saved screenshot to headless_cf.png");
    
    const title = await page.title();
    console.log("Page title after wait:", title);
    
    const cookies = await context.cookies();
    console.log("Cookies length:", cookies.length);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}
test().catch(console.error);
