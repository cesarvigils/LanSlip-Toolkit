const { ADMIN_PANEL_CHANNEL_ID } = require('../config/ticketSettings');
const { getCategories, getAdminPanelMessageId, setAdminPanelMessageId } = require('../utils/ticketStore');
const { buildAdminPanelEmbed, buildAdminPanelComponents } = require('../utils/ticketPanels');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            const channel = await client.channels.fetch(ADMIN_PANEL_CHANNEL_ID).catch(() => null);
            if (!channel) {
                console.error(`[tickets] Admin panel channel ${ADMIN_PANEL_CHANNEL_ID} not found.`);
                return;
            }

            // Delete the previous panel (if it still exists) so restarts leave exactly one live panel,
            // not a growing pile of old ones.
            const oldId = getAdminPanelMessageId();
            if (oldId) {
                const oldMsg = await channel.messages.fetch(oldId).catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => {});
            }

            const categories = getCategories();
            const message = await channel.send({
                embeds: [buildAdminPanelEmbed(categories)],
                components: buildAdminPanelComponents(),
            });

            setAdminPanelMessageId(message.id);
            console.log('[tickets] Admin panel sent.');
        } catch (error) {
            console.error('[tickets] Error sending admin panel on startup:', error);
        }
    },
};