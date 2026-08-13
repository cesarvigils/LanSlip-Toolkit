const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, fetchExecutor } = require('../utils/auditLogger');

module.exports = {
    name: 'messageDelete',
    once: false,
    async execute(message, client) {
        if (!message.guild) return; // ignore DMs
        if (message.author?.id === client.user.id) return; // don't log the bot deleting its own messages

        const isPartial = message.partial;
        const content = isPartial
            ? '*Content unavailable — message was not cached*'
            : message.content?.length
                ? message.content
                : '*No text content (embed/attachment only)*';

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor(0xED4245)
            .addFields(
                {
                    name: 'Author',
                    value: isPartial ? 'Unknown (uncached)' : `${message.author.tag} (${message.author})`,
                    inline: false,
                },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Message ID', value: message.id, inline: true },
                { name: 'Content', value: content.length > 1024 ? content.slice(0, 1021) + '...' : content },
            )
            .setTimestamp();

        if (!isPartial && message.attachments.size > 0) {
            embed.addFields({
                name: `Attachments (${message.attachments.size})`,
                value: message.attachments.map(a => a.url).join('\n').slice(0, 1024),
            });
        }

        // Only show "Deleted By" if it differs from the author (i.e. a mod deleted someone else's message)
        const entry = await fetchExecutor(
            message.guild,
            AuditLogEvent.MessageDelete,
            e => e.extra?.channel?.id === message.channel.id && (!message.author || e.target?.id === message.author.id),
        );
        if (entry?.executor && entry.executor.id !== message.author?.id) {
            embed.addFields({ name: 'Deleted By', value: entry.executor.tag });
        }

        await sendAuditLog(client, embed);
    },
};