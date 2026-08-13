const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function test() {
  console.log("Launching headless: false Playwright to test auto-click...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log("Navigating to embed page...");
  try {
    await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
    
    // Try to auto click turnstile
    console.log("Waiting for Turnstile iframe...");
    const iframe = await page.waitForSelector('iframe[src*="cloudflare"]', { timeout: 10000 }).catch(() => null);
    
    if (iframe) {
        console.log("Turnstile found! Wait 2s then click...");
        await page.waitForTimeout(2000);
        const box = await iframe.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            console.log("Clicked center of Turnstile!");
        }
    }
    
    console.log("Waiting 10s for resolution...");
    await page.waitForTimeout(10000);
    
    const cookies = await context.cookies();
    console.log("Cookies length after auto-click:", cookies.length);
    
    const title = await page.title();
    console.log("Page title:", title);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}
test().catch(console.error);
