const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'tos.json');

function ensureStore() {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
        fs.writeFileSync(STORE_PATH, JSON.stringify({ panelMessageId: null }, null, 2));
    }
}

function getPanelMessageId() {
    ensureStore();
    try {
        return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')).panelMessageId;
    } catch {
        return null;
    }
}

function setPanelMessageId(id) {
    ensureStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify({ panelMessageId: id }, null, 2));
}

module.exports = { getPanelMessageId, setPanelMessageId };