const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function test() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to embed to get clearance...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  console.log("Waiting 15 seconds for captcha...");
  await page.waitForTimeout(15000);
  
  const cookies = await context.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  console.log("Cookies length:", cookieStr.length);
  
  const targetUrl = 'https://xnhau.ink/video/37851.mp4';
  
  console.log("Testing got-scraping with cookies...");
  const { gotScraping } = await import('got-scraping');
  try {
      const res = await gotScraping.get({
          url: targetUrl,
          headers: {
              'Referer': 'https://xnhau.ink/',
              'Cookie': cookieStr,
              'User-Agent': userAgent
          },
          responseType: 'buffer'
      });
      console.log("got-scraping Status:", res.statusCode);
      console.log("got-scraping Length:", res.body.length);
  } catch(e) {
      console.log("got-scraping failed:", e.message);
  }
  
  await browser.close();
}
test().catch(console.error);
