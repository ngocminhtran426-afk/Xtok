const cloudscraper = require('cloudscraper');

const url = 'https://m.xnhau.ink/embed/37851';

cloudscraper.get(url)
  .then((html) => {
    console.log("Cloudscraper success on m.xnhau.ink!");
    console.log(html.substring(0, 500));
    const match = html.match(/https:\/\/[^"']*\.mp4/);
    console.log("Match:", match ? match[0] : "No match found");
  })
  .catch((err) => {
    console.error("Cloudscraper failed on m.xnhau.ink:", err.message);
  });
