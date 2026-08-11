const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'purge',
    description: 'Deletes a specified number of messages.',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply(' You do not have permission to use this command.');
        }

        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply(' I do not have permission to manage messages.');
        }

        const amount = parseInt(args[0], 10);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply(' Please provide a number between **1** and **100**.');
        }

        try {
            await message.channel.bulkDelete(amount + 1, true);

            const confirmation = await message.channel.send(
                `🧹 Successfully deleted **${amount}** message(s).`
            );

            setTimeout(() => {
                confirmation.delete().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error(error);
            message.reply('❌ An error occurred while trying to delete messages.');
        }
    },
};