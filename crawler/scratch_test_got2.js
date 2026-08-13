async function test() {
  try {
      const { gotScraping } = await import('got-scraping');
      console.log("got-scraping loaded!");
      
      const res = await gotScraping.get({
          url: 'https://xnhau.ink/video/37851.mp4',
          headers: {
              'Referer': 'https://xnhau.ink/'
          },
          responseType: 'buffer'
      });
      console.log("Status:", res.statusCode);
      console.log("Length:", res.body.length);
  } catch(e) {
      console.error(e);
  }
}
test();
