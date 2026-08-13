const { initDb } = require('../utils/db');
const { refreshOrdersPanel } = require('../utils/refreshOrdersPanel');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            await initDb();
            await refreshOrdersPanel(client);
            console.log('[actions] Orders panel initialized.');
        } catch (error) {
            console.error('[actions] Error during startup (check DB credentials in .env):', error);
        }
    },
};