const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function test() {
  console.log("Launching playwright...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to URL...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  try {
    console.log("Waiting for video element...");
    // Wait up to 15 seconds for a video element or an mp4 link
    await page.waitForSelector('video, source', { timeout: 15000 });
    const html = await page.content();
    const match = html.match(/https:\/\/[^"']*\.mp4/);
    console.log("MP4 Match:", match ? match[0] : "No match found");
    
    const videoElem = await page.$('video source');
    if (videoElem) {
        const src = await videoElem.getAttribute('src');
        console.log("Source Tag src:", src);
    } else {
        const vid = await page.$('video');
        if (vid) console.log("Video Tag src:", await vid.getAttribute('src'));
    }
  } catch (err) {
    console.log("Timeout waiting for video:", err.message);
  }

  await browser.close();
}

test().catch(err => console.error(err));
