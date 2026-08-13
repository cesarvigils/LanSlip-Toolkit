const { EmbedBuilder } = require('discord.js');
const { sendAuditLog } = require('../utils/auditLogger');

module.exports = {
    name: 'guildMemberAdd',
    once: false,
    async execute(member, client) {
        const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);

        const embed = new EmbedBuilder()
            .setTitle('📥 Member Joined')
            .setColor(0x57F287)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member})`, inline: true },
                { name: 'User ID', value: member.id, inline: true },
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                {
                    name: 'Account Created',
                    value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (${accountAgeDays}d ago)`,
                    inline: false,
                },
            )
            .setFooter({ text: `Guild: ${member.guild.name}` })
            .setTimestamp();

        // Flag very new accounts, handy for spotting alts/raid bots
        if (accountAgeDays < 7) {
            embed.addFields({ name: '⚠️ Notice', value: 'Account is less than 7 days old.' });
        }

        await sendAuditLog(client, embed);
    },
};