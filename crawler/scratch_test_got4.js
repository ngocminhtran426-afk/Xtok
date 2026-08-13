const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function test() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to embed to get clearance...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  console.log("PLEASE CLICK THE CAPTCHA NOW IF IT APPEARS. Waiting 20 seconds...");
  await page.waitForTimeout(20000);
  
  const cookies = await context.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  console.log("Cookies length:", cookieStr.length);
  
  if (cookieStr.length < 10) {
      console.log("No cookies found. Did you click the captcha?");
      await browser.close();
      return;
  }
  
  const targetUrl = 'https://xnhau.ink/video/37851.mp4';
  
  console.log("Testing got-scraping with cookies...");
  const { gotScraping } = await import('got-scraping');
  try {
      const resStream = gotScraping.stream({
          url: targetUrl,
          headers: {
              'Referer': 'https://xnhau.ink/',
              'Cookie': cookieStr,
              'User-Agent': userAgent
          }
      });
      
      resStream.on('response', (response) => {
          console.log("got-scraping stream Status:", response.statusCode);
          resStream.destroy();
          browser.close();
      });
      
      resStream.on('error', (err) => {
          console.log("got-scraping stream error:", err.message);
          browser.close();
      });
  } catch(e) {
      console.log("got-scraping failed:", e.message);
      await browser.close();
  }
}
test().catch(console.error);
