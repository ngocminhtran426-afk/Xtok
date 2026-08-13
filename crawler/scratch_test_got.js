const { gotScraping } = require('got-scraping');

async function test() {
  try {
    const response = await gotScraping({
        url: 'https://xnhau.ink/embed/37851',
        headerGeneratorOptions: {
            browsers: ['chrome', 'firefox', 'safari'],
            devices: ['desktop'],
            locales: ['en-US', 'vi-VN']
        }
    });
    const html = response.body;
    console.log("Status:", response.statusCode);
    const match = html.match(/https:\/\/[^"']*\.mp4/);
    console.log("MP4 Match:", match ? match[0] : "No match found");
    if (!match) {
        console.log("Got Cloudflare challenge? :", html.includes('challenge-platform'));
    }
  } catch (err) {
    console.error(err.message);
  }
}
test();
