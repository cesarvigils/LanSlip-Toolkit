const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TOS_CHANNEL_ID, TOS_LINK } = require('../config/tosSettings');
const { getPanelMessageId, setPanelMessageId } = require('../utils/tosStore');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            const channel = await client.channels.fetch(TOS_CHANNEL_ID).catch(() => null);
            if (!channel) {
                console.error(`[tos] Channel ${TOS_CHANNEL_ID} not found.`);
                return;
            }

            const oldId = getPanelMessageId();
            if (oldId) {
                const oldMsg = await channel.messages.fetch(oldId).catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setTitle('Terms of Service')
                .setColor(0x5865F2)
                .setDescription('Please read our Terms of Service before continuing. By pressing Accept below, you confirm that you have read and agree to the terms.')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Read Terms of Service').setStyle(ButtonStyle.Link).setURL(TOS_LINK),
                new ButtonBuilder().setCustomId('tos_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
            );

            const message = await channel.send({ embeds: [embed], components: [row] });
            setPanelMessageId(message.id);
            console.log('[tos] Panel sent.');
        } catch (error) {
            console.error('[tos] Error sending panel on startup:', error);
        }
    },
};