const cloudscraper = require('cloudscraper');

const urls = [
    'https://xnhau.ink/api/video/37851',
    'https://xnhau.ink/api/source/37851',
    'https://xnhau.ink/video/37851.mp4'
];

async function test() {
  for (const url of urls) {
      try {
        const res = await cloudscraper.get(url);
        console.log("Success on:", url);
        console.log(res.substring(0, 100));
      } catch (err) {
        console.log("Failed on:", url, err.message);
      }
  }
}
test();
