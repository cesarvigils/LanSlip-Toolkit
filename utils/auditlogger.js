const { AUDIT_LOG_CHANNEL_ID } = require('../config');

/**
 * Sends an embed to the configured audit log channel.
 */
async function sendAuditLog(client, embed) {
    try {
        const channel = await client.channels.fetch(AUDIT_LOG_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.error(`[audit] Channel ${AUDIT_LOG_CHANNEL_ID} not found or bot can't access it.`);
            return;
        }
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[audit] Error sending log:', error);
    }
}

/**
 * Looks up the most recent matching audit log entry for a given action type.
 * Requires the bot to have "View Audit Log" permission — fails silently (returns null) if not.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').AuditLogEvent} type
 * @param {(entry) => boolean} [matchFn] optional filter, e.g. match on entry.target.id
 * @param {number} [withinMs] only consider entries created within this many ms (avoids stale matches)
 */
async function fetchExecutor(guild, type, matchFn, withinMs = 6000) {
    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 5 });
        const entry = logs.entries.find(e => {
            const isRecent = Date.now() - e.createdTimestamp < withinMs;
            return isRecent && (!matchFn || matchFn(e));
        });
        return entry ?? null;
    } catch (error) {
        console.error('[audit] Could not fetch audit logs (missing "View Audit Log" permission?):', error.message);
        return null;
    }
}

module.exports = { sendAuditLog, fetchExecutor };