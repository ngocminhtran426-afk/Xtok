const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function test() {
  console.log("Launching playwright...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to URL...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  // Wait a bit for Cloudflare to resolve
  console.log("Waiting 3 seconds for Cloudflare...");
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log("HTML Start:", html.substring(0, 300));
  
  const match = html.match(/https:\/\/[^"']*\.mp4/);
  console.log("MP4 Match:", match ? match[0] : "No match found");
  
  if (!match) {
    const videoElem = await page.$('video');
    if (videoElem) {
        const src = await videoElem.getAttribute('src');
        console.log("Video Tag src:", src);
    }
  }

  await browser.close();
}

test().catch(err => console.error(err));
