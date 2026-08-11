const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
data: new SlashCommandBuilder()
    .setName('requestrole')
    .setDescription('Request a role in the server.')
    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('The role you want to request.')
            .setRequired(true)
    )
    .addUserOption(option =>
        option
            .setName('approvedby')
            .setDescription('Officer who approved this request.')
            .setRequired(true)
    ),
    async execute(interaction) {
        const requestedRole = interaction.options.getRole('role');
        const user = interaction.user;
        const guild = interaction.guild;
const approvedBy = interaction.options.getUser('approvedby');
        const approverRoleId = '1533623095271620759'; // Role ID for approvers
        const roleRequestChannelId = '1533623167153737728'; // Replace with DPS role req channel

        if (!requestedRole) {
            return interaction.reply({ content: 'Invalid role selected.', ephemeral: true });
        }

const embed = new EmbedBuilder()
    .setTitle('Role Request')
    .setDescription(`${user} has requested the role **${requestedRole.name}**.`)
    .addFields(
        {
            name: 'Approved By',
            value: `<@${approvedBy.id}>`,
            inline: true
        },
        {
            name: 'Status',
            value: 'Pending',
            inline: true
        }
    )
    .setColor('#f2c14e')
    .setTimestamp();
        const approveButton = new ButtonBuilder()
            .setCustomId(`approve-${user.id}-${requestedRole.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
            .setCustomId(`decline-${user.id}-${requestedRole.id}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, declineButton);

        const roleRequestChannel = guild.channels.cache.get(roleRequestChannelId);
        if (!roleRequestChannel) {
            return interaction.reply({ content: 'The role request channel could not be found.', ephemeral: true });
        }

const requestMessage = await roleRequestChannel.send({
    content: `<@${approvedBy.id}>`,
    embeds: [embed],
    components: [row],
});
        await interaction.reply({ content: `Your role request has been sent to <#${roleRequestChannelId}>.`, ephemeral: true });
try {
    await approvedBy.send({
        embeds: [
            new EmbedBuilder()
                .setTitle('New Role Request')
                .setDescription(
                    `${user.tag} has requested **${requestedRole.name}**.\n\n` +
                    `Please review the request in **${guild.name}**.`
                )
                .setColor('#031a8c')
                .setTimestamp()
        ]
    });
} catch {
    console.log(`Couldn't DM ${approvedBy.tag}.`);
}
        const collector = requestMessage.createMessageComponentCollector({ time: 86400000 }); // 24 hours

        collector.on('collect', async i => {
            if (!i.member.roles.cache.has(approverRoleId)) {
                return i.reply({ content: 'You are not authorized to approve or decline role requests.', ephemeral: true });
            }

            const [action, userId, roleId] = i.customId.split('-');
            const targetUser = await guild.members.fetch(userId);
            const targetRole = guild.roles.cache.get(roleId);

            if (!targetUser || !targetRole) {
                return i.reply({ content: 'Invalid user or role.', ephemeral: true });
            }

            if (action === 'approve') {
                await targetUser.roles.add(targetRole);
                embed.setFields({ name: 'Status', value: `Approved by ${i.user.tag}`, inline: true }).setColor('#00ff08');
                await requestMessage.edit({ embeds: [embed], components: [] });
                return i.reply({ content: `Role **${targetRole.name}** has been approved and assigned to ${targetUser}.`, ephemeral: true });
            } else if (action === 'decline') {
                embed.setFields({ name: 'Status', value: `Declined by ${i.user.tag}`, inline: true }).setColor('#ff000d');
                await requestMessage.edit({ embeds: [embed], components: [] });
                return i.reply({ content: `Role request for **${targetRole.name}** has been declined.`, ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                embed.setFields({ name: 'Status', value: 'Timed Out', inline: true }).setColor('#a8a7a5');
                requestMessage.edit({ embeds: [embed], components: [] });
            }
        });
    },
};
