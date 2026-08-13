const id = '123'; // some random id or let's use the one in DB, or just fetch the homepage to see if it's protected
const mainDomain = 'https://xnhau.ink';

async function test() {
  try {
    const response = await fetch(mainDomain, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    console.log("Status:", response.status);
    console.log("HTML Start:", html.substring(0, 500));
    
    // Also test an embed URL
    const embedRes = await fetch('https://xnhau.ink/embed/37851', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const embedHtml = await embedRes.text();
    console.log("Embed Status:", embedRes.status);
    const match = embedHtml.match(/https:\/\/[^"']*\.mp4/);
    console.log("Match:", match ? match[0] : "No match found");
    if (!match) {
        console.log("Embed HTML contains m3u8?", embedHtml.includes('.m3u8'));
        console.log("Embed HTML snippet:", embedHtml.substring(0, 500));
        
        // try to find any video link
        const vidMatch = embedHtml.match(/https:\/\/[^"']*\.(mp4|m3u8)/);
        if (vidMatch) console.log("Alternative Match:", vidMatch[0]);
    }

  } catch (err) {
    console.error(err);
  }
}
test();
