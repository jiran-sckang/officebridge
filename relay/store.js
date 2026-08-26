const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));
}

function saveJson(fileName, data) {
  fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2));
}

module.exports = { loadJson, saveJson, DATA_DIR };
