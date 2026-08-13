const { EmbedBuilder } = require('discord.js');

function buildOrdersPanelEmbed(orders) {
    const embed = new EmbedBuilder()
        .setTitle('Active Orders')
        .setColor(0x5865F2)
        .setTimestamp();

    if (!orders.length) {
        embed.setDescription('No active orders right now.');
        return embed;
    }

    embed.setDescription(
        orders
            .map(o => `#${o.id} — Client: ${o.client_name} | Service: ${o.service} | ETA: ${o.eta}\nStatus: ${o.status}`)
            .join('\n\n'),
    );

    return embed;
}

module.exports = { buildOrdersPanelEmbed };