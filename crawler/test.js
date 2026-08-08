const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  await page.goto('https://xnhau.tech/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log("Waiting 5s...");
  await page.waitForTimeout(5000);
  
  const body = await page.content();
  fs.writeFileSync('debug.html', body);
  console.log("Done");
  await browser.close();
})();
