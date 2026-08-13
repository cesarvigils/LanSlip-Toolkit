const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, fetchExecutor } = require('../utils/auditLogger');

module.exports = {
    name: 'guildMemberUpdate',
    once: false,
    async execute(oldMember, newMember, client) {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
        const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

        // Nothing role-related changed (nickname/avatar/etc updates are ignored here)
        if (addedRoles.size === 0 && removedRoles.size === 0) return;

        const entry = await fetchExecutor(
            newMember.guild,
            AuditLogEvent.MemberRoleUpdate,
            e => e.target?.id === newMember.id,
        );

        const embed = new EmbedBuilder()
            .setTitle('🔧 Member Roles Updated')
            .setColor(addedRoles.size && !removedRoles.size ? 0x57F287 : removedRoles.size && !addedRoles.size ? 0xED4245 : 0xFEE75C)
            .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
            .addFields({ name: 'User', value: `${newMember.user.tag} (${newMember})`, inline: false })
            .setFooter({ text: `User ID: ${newMember.id}` })
            .setTimestamp();

        if (addedRoles.size) {
            embed.addFields({ name: '➕ Roles Added', value: addedRoles.map(r => `${r}`).join(', ') });
        }
        if (removedRoles.size) {
            embed.addFields({ name: '➖ Roles Removed', value: removedRoles.map(r => `${r}`).join(', ') });
        }
        if (entry?.executor) {
            embed.addFields({ name: 'Changed By', value: `${entry.executor.tag}` });
        }

        await sendAuditLog(client, embed);
    },
};