const fs = require('fs');

function e(s) {
  // same logic as client
  return Buffer.from(encodeURIComponent(s)).toString('base64');
}

const file = fs.readFileSync('e:\\operagx\\thermodynamix\\tarot\\cards.js', 'utf8');

const jsCodeMatch = file.match(/const rawCards = (\[[\s\S]*?\]);\n/);
const jsCode = jsCodeMatch[1];
const rawCards = eval(jsCode);

const obfuscated = rawCards.map(card => ({
  id: card.id,
  name: e(card.name),
  img: card.img,
  upright_en: e(card.upright_en),
  upright_vi: e(card.upright_vi)
}));

// stringify beautifully
const obfuscatedStr = JSON.stringify(obfuscated, null, 2);

// Replace rawCards entirely with the obfuscated array
let newFile = file.replace(jsCodeMatch[0], `const encodedCards = ${obfuscatedStr};\n`);

// also fix the decoding map at the bottom
newFile = newFile.replace(/window.__tarotDb = rawCards.map[^;]+;/, `window.__tarotDb = encodedCards.map(card => ({
  id: card.id,
  name: d(card.name),
  img: card.img,
  upright_en: d(card.upright_en),
  upright_vi: d(card.upright_vi)
}));`);

newFile = newFile.replace(/function e\(s\) {[\s\S]*?}/, `function e(s) {
    try { return btoa(encodeURIComponent(s)); } catch (err) { return s; }
  }`);

newFile = newFile.replace(/function d\(s\) {[\s\S]*?}/, `function d(s) {
    try { return decodeURIComponent(atob(s)); } catch (err) { return s; }
  }`);

fs.writeFileSync('e:\\operagx\\thermodynamix\\tarot\\cards.js', newFile);
console.log('Successfully obfuscated cards.js');
