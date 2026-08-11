const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'lockdown',
    description: 'Locks the current channel.',

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
                SendMessages: false
            });

            await message.reply('🔒 This channel has been locked.');
        } catch (error) {
            console.error(error);
            message.reply('Failed to lock this channel.');
        }
    },
};