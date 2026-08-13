const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function test() {
  console.log("Launching playwright (headless: false)...");
  const browser = await chromium.launch({ headless: false }); // Hiển thị UI để qua mặt Cloudflare
  const page = await browser.newPage();
  
  console.log("Navigating to URL...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  try {
    console.log("Waiting for video element...");
    // Wait up to 10 seconds for a video element
    await page.waitForSelector('video, source', { timeout: 10000 });
    
    const html = await page.content();
    const match = html.match(/https:\/\/[^"']*\.mp4/);
    console.log("MP4 Match (Regex):", match ? match[0] : "No match found");
    
    const videoElem = await page.$('video source');
    if (videoElem) {
        const src = await videoElem.getAttribute('src');
        console.log("Source Tag src:", src);
    } else {
        const vid = await page.$('video');
        if (vid) console.log("Video Tag src:", await vid.getAttribute('src'));
    }
  } catch (err) {
    console.log("Error or Timeout:", err.message);
  } finally {
    console.log("Closing browser...");
    await browser.close();
  }
}

test().catch(err => console.error(err));
