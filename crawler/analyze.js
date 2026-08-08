const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('debug.html', 'utf-8');
const $ = cheerio.load(html);

console.log("TITLE:", $('title').text());
console.log("--- Links ---");
$('a').slice(0, 10).each((i, el) => {
  console.log(`Href: ${$(el).attr('href')}, Text: ${$(el).text().trim().substring(0, 50)}`);
});

console.log("--- Classes ---");
const classCounts = {};
$('*').each((i, el) => {
  const cls = $(el).attr('class');
  if (cls) {
    cls.split(/\s+/).forEach(c => {
      classCounts[c] = (classCounts[c] || 0) + 1;
    });
  }
});
const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(sortedClasses);
