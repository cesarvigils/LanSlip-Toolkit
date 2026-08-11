const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    description: 'Displays bot statistics.',

    async execute(message) {
        const client = message.client;

        const totalMembers = client.guilds.cache.reduce(
            (acc, guild) => acc + guild.memberCount,
            0
        );

        const embed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setTitle(' Bot Statistics')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: 'Servers',
                    value: `${client.guilds.cache.size}`,
                    inline: true
                },
                {
                    name: 'Users',
                    value: `${totalMembers}`,
                    inline: true
                },
                {
                    name: 'Ping',
                    value: `${Math.round(client.ws.ping)}ms`,
                    inline: true
                },
                {
                    name: 'Prefix Commands',
                    value: `${client.prefixCommands.size}`,
                    inline: true
                },
                {
                    name: 'Slash Commands',
                    value: `${client.slashCommands.size}`,
                    inline: true
                },
                {
                    name: ' Uptime',
                    value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`,
                    inline: true
                },
                {
                    name: ' Discord.js',
                    value: `v${require('discord.js').version}`,
                    inline: true
                },
                {
                    name: 'Node.js',
                    value: process.version,
                    inline: true
                },
                {
                    name: 'Memory Usage',
                    value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
                    inline: true
                }
            )
            .setFooter({
                text: `Requested by ${message.author.tag}`,
                iconURL: message.author.displayAvatarURL()
            })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    },
};