
async function fetchAllMessages(channel) {
    let messages = [];
    let lastId;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        if (batch.size === 0) break;

        messages = messages.concat([...batch.values()]);
        lastId = batch.last().id;

        if (batch.size < 100) break;
    }

    return messages.reverse(); 
}
function formatTranscript(channel, messages) {
    const lines = [];
    lines.push(`Transcript for #${channel.name} (${channel.id})`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total messages: ${messages.length}`);
    lines.push('-'.repeat(60));

    for (const msg of messages) {
        const time = new Date(msg.createdTimestamp).toISOString();
        const author = msg.author ? `${msg.author.tag} (${msg.author.id})` : 'Unknown user';

        let content = msg.content?.length ? msg.content : '';
        if (msg.embeds.length) content += ` [${msg.embeds.length} embed(s)]`;
        if (msg.attachments.size) {
            content += ' ' + msg.attachments.map(a => `[attachment: ${a.url}]`).join(' ');
        }
        if (!content) content = '[no text content]';

        lines.push(`[${time}] ${author}: ${content}`);
    }

    return lines.join('\n');
}

module.exports = { fetchAllMessages, formatTranscript };