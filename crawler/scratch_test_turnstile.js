const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function test() {
  console.log("Launching playwright (headless: false)...");
  const browser = await chromium.launch({ headless: false }); 
  const page = await browser.newPage();
  
  console.log("Navigating to URL...");
  await page.goto('https://xnhau.ink/embed/37851', { waitUntil: 'domcontentloaded' });
  
  try {
    console.log("Waiting for cloudflare challenge to settle...");
    await page.waitForTimeout(5000);
    
    // Attempt to click the Turnstile checkbox if it exists
    const frames = page.frames();
    for (const frame of frames) {
        if (frame.url().includes('cloudflare')) {
            console.log("Found Cloudflare frame. Attempting to click...");
            try {
                // The Turnstile checkbox is usually a wrapper or input
                const body = await frame.$('body');
                if (body) {
                    const box = await body.boundingBox();
                    if (box) {
                        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                        console.log("Clicked inside Cloudflare frame.");
                    }
                }
            } catch(e) { console.log(e.message); }
        }
    }

    console.log("Waiting up to 15 seconds for video element...");
    await page.waitForSelector('video, source', { timeout: 15000 });
    
    const html = await page.content();
    const match = html.match(/https:\/\/[^"']*\.mp4/);
    console.log("MP4 Match (Regex):", match ? match[0] : "No match found");
    
    const videoElem = await page.$('video source');
    if (videoElem) {
        const src = await videoElem.getAttribute('src');
        console.log("Source Tag src:", src);
    }
  } catch (err) {
    console.log("Error or Timeout:", err.message);
  } finally {
    console.log("Closing browser...");
    await browser.close();
  }
}

test().catch(err => console.error(err));
