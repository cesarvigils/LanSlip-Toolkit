const { EmbedBuilder, ActivityType } = require('discord.js');

const STATUS_CHANNEL_ID = '1536818327241101445';

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            client.user.setPresence({
                activities: [{ name: 'LANSlip', type: ActivityType.Watching }],
                status: 'dnd',
            });

            await client.loadSlashCommands();
            await client.loadPrefixCommands();

            console.log(`Logged in as ${client.user.tag}`);

            const channel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
            if (!channel) {
                console.error(`Could not find/fetch status channel ${STATUS_CHANNEL_ID}`);
                return;
            }

            const uptimeSeconds = Math.floor(process.uptime());
            const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            const embed = new EmbedBuilder()
                .setTitle(' Bot Started')
                .setColor(0x57F287)
                .setDescription(`${client.user.tag} is now online and ready.`)
                .addFields(
                    { name: 'Status', value: 'Healthy', inline: true },
                    { name: 'Guilds', value: `${client.guilds.cache.size}`, inline: true },
                    { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                    { name: 'Uptime', value: `${uptimeSeconds}s`, inline: true },
                    { name: 'Memory', value: `${memoryMB} MB`, inline: true },
                    { name: 'Slash Commands', value: `${client.slashCommands?.size ?? 0}`, inline: true },
                    { name: 'Prefix Commands', value: `${client.prefixCommands?.size ?? 0}`, inline: true },
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error during ready event:', error);
        }
    },
};