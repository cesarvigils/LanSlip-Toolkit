const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'unlock',
    description: 'Unlocks the current channel.',

    async execute(message) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('You do not have permission to use this command.');
        }

        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('I do not have permission to manage channels.');
        }

        const everyone = message.guild.roles.everyone;

        try {
            await message.channel.permissionOverwrites.edit(everyone, {
                SendMessages: null
            });

            await message.reply('🔓 This channel has been unlocked.');
        } catch (error) {
            console.error(error);
            message.reply('Failed to unlock this channel.');
        }
    },
};