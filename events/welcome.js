const { EmbedBuilder } = require('discord.js');

const WELCOME_CHANNEL_ID = '1536804449882734697';

module.exports = {
    name: 'guildMemberAdd',
    once: false,
    async execute(member, client) {
        try {
            const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
            if (!channel) {
                console.error(`[welcome] Could not find/fetch channel ${WELCOME_CHANNEL_ID}`);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`👋 Welcome to ${member.guild.name}!`)
                .setColor(0x5865F2)
                .setDescription(`Welcome, ${member}! We're glad to have you here.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Member Count', value: `You're member #${member.guild.memberCount}`, inline: true },
                )
                .setFooter({ text: `User ID: ${member.id}` })
                .setTimestamp();

            await channel.send({ content: `${member}`, embeds: [embed] });
        } catch (error) {
            console.error('[welcome] Error sending welcome embed:', error);
        }
    },
};