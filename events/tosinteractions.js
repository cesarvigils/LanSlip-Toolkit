const { EmbedBuilder } = require('discord.js');
const { TOS_ROLE_ID } = require('../config/tosSettings');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        if (!interaction.isButton() || interaction.customId !== 'tos_accept') return;

        try {
            if (interaction.member.roles.cache.has(TOS_ROLE_ID)) {
                return interaction.reply({ content: 'You have already accepted the Terms of Service.', ephemeral: true });
            }

            await interaction.member.roles.add(TOS_ROLE_ID, 'Accepted Terms of Service');

            const embed = new EmbedBuilder()
                .setTitle('Terms of Service Accepted')
                .setColor(0x57F287)
                .setDescription('Thank you for accepting the Terms of Service. You now have full access.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('[tos] Error assigning TOS role:', error);
            await interaction.reply({ content: 'Something went wrong assigning your role. Please contact staff.', ephemeral: true }).catch(() => {});
        }
    },
};