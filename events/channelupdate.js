const { EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { sendAuditLog, fetchExecutor } = require('../utils/auditLogger');

function diffOverwrites(oldChannel, newChannel) {
    const oldOverwrites = oldChannel.permissionOverwrites.cache;
    const newOverwrites = newChannel.permissionOverwrites.cache;
    const changes = [];

    for (const [id, newOw] of newOverwrites) {
        const oldOw = oldOverwrites.get(id);
        if (!oldOw) {
            changes.push({ id, type: newOw.type, kind: 'created', allow: newOw.allow, deny: newOw.deny });
            continue;
        }
        if (oldOw.allow.bitfield !== newOw.allow.bitfield || oldOw.deny.bitfield !== newOw.deny.bitfield) {
            changes.push({
                id,
                type: newOw.type,
                kind: 'updated',
                oldAllow: oldOw.allow,
                oldDeny: oldOw.deny,
                newAllow: newOw.allow,
                newDeny: newOw.deny,
            });
        }
    }
    for (const [id, oldOw] of oldOverwrites) {
        if (!newOverwrites.has(id)) {
            changes.push({ id, type: oldOw.type, kind: 'deleted', allow: oldOw.allow, deny: oldOw.deny });
        }
    }
    return changes;
}

function formatPermList(bitfield) {
    const flags = new PermissionsBitField(bitfield).toArray();
    return flags.length ? flags.join(', ') : 'None';
}

function formatPermDiff(oldAllow, oldDeny, newAllow, newDeny) {
    const lines = [];
    for (const flag of Object.keys(PermissionsBitField.Flags)) {
        const bit = PermissionsBitField.Flags[flag];
        const before = oldAllow.has(bit) ? '✅' : oldDeny.has(bit) ? '❌' : '⬜';
        const after = newAllow.has(bit) ? '✅' : newDeny.has(bit) ? '❌' : '⬜';
        if (before !== after) lines.push(`**${flag}**: ${before} → ${after}`);
    }
    return lines.length ? lines.join('\n') : 'No effective change';
}

async function resolveTargetLabel(guild, id, type) {
    // type 0 = role overwrite, 1 = member overwrite
    if (type === 0) {
        const role = await guild.roles.fetch(id).catch(() => null);
        return role ? `Role: @${role.name}` : `Role: ${id}`;
    }
    const member = await guild.members.fetch(id).catch(() => null);
    return member ? `Member: ${member.user.tag}` : `User: ${id}`;
}

module.exports = {
    name: 'channelUpdate',
    once: false,
    async execute(oldChannel, newChannel, client) {
        if (!newChannel.guild || !oldChannel.permissionOverwrites || !newChannel.permissionOverwrites) return;

        const changes = diffOverwrites(oldChannel, newChannel);
        if (!changes.length) return; // channelUpdate also fires for name/topic/etc changes we don't care about here

        // Try the three overwrite audit log types in order; Discord only logs one per actual change
        const entry =
            (await fetchExecutor(newChannel.guild, AuditLogEvent.ChannelOverwriteUpdate, e => e.target?.id === newChannel.id)) ||
            (await fetchExecutor(newChannel.guild, AuditLogEvent.ChannelOverwriteCreate, e => e.target?.id === newChannel.id)) ||
            (await fetchExecutor(newChannel.guild, AuditLogEvent.ChannelOverwriteDelete, e => e.target?.id === newChannel.id));

        for (const change of changes) {
            const targetLabel = await resolveTargetLabel(newChannel.guild, change.id, change.type);

            const embed = new EmbedBuilder()
                .setTitle('🔐 Channel Permissions Updated')
                .setColor(change.kind === 'created' ? 0x57F287 : change.kind === 'deleted' ? 0xED4245 : 0xFEE75C)
                .addFields(
                    { name: 'Channel', value: `${newChannel} (#${newChannel.name})`, inline: false },
                    { name: 'Target', value: targetLabel, inline: true },
                    { name: 'Change Type', value: change.kind, inline: true },
                )
                .setFooter({ text: `Channel ID: ${newChannel.id}` })
                .setTimestamp();

            if (change.kind === 'created') {
                embed.addFields(
                    { name: 'Allowed', value: formatPermList(change.allow.bitfield) },
                    { name: 'Denied', value: formatPermList(change.deny.bitfield) },
                );
            } else if (change.kind === 'deleted') {
                embed.addFields({ name: 'Result', value: 'This permission overwrite was removed entirely.' });
            } else {
                embed.addFields({
                    name: 'Permission Changes',
                    value: formatPermDiff(change.oldAllow, change.oldDeny, change.newAllow, change.newDeny),
                });
            }

            if (entry?.executor) {
                embed.addFields({ name: 'Changed By', value: entry.executor.tag });
            }

            await sendAuditLog(client, embed);
        }
    },
};