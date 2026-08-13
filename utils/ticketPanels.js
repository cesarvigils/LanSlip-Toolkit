const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

function buildAdminPanelEmbed(categories) {
    return new EmbedBuilder()
        .setTitle('Ticket System - Admin Panel')
        .setColor(0x5865F2)
        .setDescription('Manage the ticket system from here. Only the configured admin role can use these buttons.')
        .addFields({
            name: `Current Categories (${categories.length})`,
            value: categories.length ? categories.map(c => `- ${c}`).join('\n') : 'None set',
        })
        .setFooter({ text: 'This panel stays live for as long as the bot is running.' })
        .setTimestamp();
}

function buildAdminPanelComponents() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_send_panel').setLabel('Send Ticket Panel').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket_add_category').setLabel('Add Category').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_remove_category_start').setLabel('Remove Category').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_reset_categories').setLabel('Reset to Defaults').setStyle(ButtonStyle.Secondary),
    );
    return [row];
}

function buildTicketPanelEmbed() {
    return new EmbedBuilder()
        .setTitle('Open a Ticket')
        .setColor(0x57F287)
        .setDescription('Select a category below to open a private ticket with our team.')
        .setTimestamp();
}

function buildTicketPanelComponents(categories) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_open_select')
        .setPlaceholder('Choose a ticket category...')
        .addOptions(categories.map(c => ({ label: c, value: c })));
    return [new ActionRowBuilder().addComponents(menu)];
}

function buildTicketWelcomeEmbed(category, user, claimedByTag = null) {
    const embed = new EmbedBuilder()
        .setTitle(`${category} Ticket`)
        .setColor(claimedByTag ? 0xFEE75C : 0x5865F2)
        .setDescription(`Thanks for reaching out, ${user}. Our team will be with you shortly.\n\nPlease describe your issue in detail below.`)
        .addFields(
            { name: 'Category', value: category, inline: true },
            { name: 'Opened By', value: `${user.tag}`, inline: true },
        )
        .setTimestamp();

    if (claimedByTag) {
        embed.addFields({ name: 'Claimed By', value: claimedByTag, inline: true });
    }

    return embed;
}

function buildTicketButtonsRow(claimedByTag = null) {
    const claimButton = claimedByTag
        ? new ButtonBuilder().setCustomId('ticket_unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary)
        : new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary);

    const closeButton = new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger);

    return [new ActionRowBuilder().addComponents(claimButton, closeButton)];
}

function buildAddCategoryModal() {
    const modal = new ModalBuilder().setCustomId('ticket_add_category_modal').setTitle('Add Ticket Category');
    const input = new TextInputBuilder()
        .setCustomId('category_name')
        .setLabel('New category name')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function buildRemoveCategorySelect(categories) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_remove_category_select')
        .setPlaceholder('Choose a category to remove...')
        .addOptions(categories.map(c => ({ label: c, value: c })));
    return [new ActionRowBuilder().addComponents(menu)];
}

module.exports = {
    buildAdminPanelEmbed,
    buildAdminPanelComponents,
    buildTicketPanelEmbed,
    buildTicketPanelComponents,
    buildTicketWelcomeEmbed,
    buildTicketButtonsRow,
    buildAddCategoryModal,
    buildRemoveCategorySelect,
};