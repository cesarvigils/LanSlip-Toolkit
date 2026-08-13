const { PANEL_CHANNEL_ID } = require('../config/actionsSettings');
const { getActiveOrders, getPanelMessageId, setPanelMessageId } = require('./ordersRepo');
const { buildOrdersPanelEmbed } = require('./actionsPanel');

async function refreshOrdersPanel(client) {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.error(`[actions] Panel channel ${PANEL_CHANNEL_ID} not found.`);
        return;
    }

    const orders = await getActiveOrders();
    const embed = buildOrdersPanelEmbed(orders);

    const existingId = await getPanelMessageId();
    if (existingId) {
        const existingMsg = await channel.messages.fetch(existingId).catch(() => null);
        if (existingMsg) {
            await existingMsg.edit({ embeds: [embed] }).catch(() => {});
            return;
        }
    }

    const message = await channel.send({ embeds: [embed] });
    await setPanelMessageId(message.id);
}

module.exports = { refreshOrdersPanel };