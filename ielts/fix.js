
const fs = require('fs');
const lisHtml = fs.readFileSync('listening/index.html', 'utf8');
const lines = lisHtml.split('\n');
let start = 0, end = 0;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('<div id="options-menu"')) start = i;
  if (lines[i].includes('<!-- -- 5. Launch Creator Test Modal -- -->')) { end = i; break; }
}
const block = lines.slice(start, end).join('\n');
let mainHtml = fs.readFileSync('index.html', 'utf8');
mainHtml = mainHtml.replace('<div id="creator-test-modal"', block + '\n\n  <div id="creator-test-modal"');
fs.writeFileSync('index.html', mainHtml);
console.log('done');

