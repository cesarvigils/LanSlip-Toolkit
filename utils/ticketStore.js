const fs = require('fs');
const path = require('path');
const { DEFAULT_CATEGORIES } = require('../config/ticketSettings');

const STORE_PATH = path.join(__dirname, '..', 'data', 'tickets.json');

function ensureStore() {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
        const initial = { categories: [...DEFAULT_CATEGORIES], adminPanelMessageId: null };
        fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    }
}

function readStore() {
    ensureStore();
    try {
        return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    } catch (error) {
        console.error('[tickets] Store was corrupted, resetting to defaults:', error);
        const fallback = { categories: [...DEFAULT_CATEGORIES], adminPanelMessageId: null };
        fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2));
        return fallback;
    }
}

function writeStore(data) {
    ensureStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function getCategories() {
    return readStore().categories;
}

function setCategories(categories) {
    const store = readStore();
    store.categories = categories;
    writeStore(store);
}

function getAdminPanelMessageId() {
    return readStore().adminPanelMessageId;
}

function setAdminPanelMessageId(id) {
    const store = readStore();
    store.adminPanelMessageId = id;
    writeStore(store);
}

module.exports = { getCategories, setCategories, getAdminPanelMessageId, setAdminPanelMessageId };