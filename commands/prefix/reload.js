const fs = require('fs');
const path = require('path');
const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'reload',
    description: 'Reloads a prefix command.',

    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('You do not have permission to use this command.');
        }

        const commandName = args[0]?.toLowerCase();

        if (!commandName) {
            return message.reply('Usage: `!reload <command>`');
        }

        const commandPath = path.join(__dirname, `${commandName}.js`);

        if (!fs.existsSync(commandPath)) {
            return message.reply(`Command \`${commandName}\` was not found.`);
        }

        try {
            delete require.cache[require.resolve(commandPath)];

            const newCommand = require(commandPath);

            client = message.client;
            client.prefixCommands.set(newCommand.name, newCommand);

            return message.reply(` Successfully reloaded \`${newCommand.name}\`.`);
        } catch (error) {
            console.error(error);
            return message.reply(` Failed to reload \`${commandName}\`.`);
        }
    },
};