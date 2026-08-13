const { ChannelType, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const {
    ADMIN_PANEL_CHANNEL_ID,
    ADMIN_ROLE_ID,
    TICKET_ACCESS_ROLE_ID,
    TICKET_PANEL_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID,
    DEFAULT_CATEGORIES,
} = require('../config/ticketSettings');
const { getCategories, setCategories, getAdminPanelMessageId } = require('../utils/ticketStore');
const { getOwnerId, getClaimerId, setClaimerId, getCategory } = require('../utils/ticketTopic');
const { fetchAllMessages, formatTranscript } = require('../utils/ticketTranscript');
const {
    buildAdminPanelEmbed,
    buildAdminPanelComponents,
    buildTicketPanelEmbed,
    buildTicketPanelComponents,
    buildTicketWelcomeEmbed,
    buildTicketButtonsRow,
    buildAddCategoryModal,
    buildRemoveCategorySelect,
} = require('../utils/ticketPanels');

function isPanelAdmin(interaction) {
    return interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID) ?? false;
}

function isTicketStaff(interaction) {
    return interaction.member?.roles?.cache?.has(TICKET_ACCESS_ROLE_ID) ?? false;
}

async function refreshAdminPanel(client) {
    const channel = await client.channels.fetch(ADMIN_PANEL_CHANNEL_ID).catch(() => null);
    const msgId = getAdminPanelMessageId();
    if (!channel || !msgId) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) return;
    await msg
        .edit({ embeds: [buildAdminPanelEmbed(getCategories())], components: buildAdminPanelComponents() })
        .catch(() => {});
}

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        // ---------------- Buttons ----------------
        if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId === 'ticket_send_panel') {
                if (!isPanelAdmin(interaction)) {
                    return interaction.reply({ content: 'You do not have permission to do that.', ephemeral: true });
                }
                const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID).catch(() => null);
                if (!channel) {
                    return interaction.reply({ content: 'Ticket panel channel not found.', ephemeral: true });
                }
                await channel.send({
                    embeds: [buildTicketPanelEmbed()],
                    components: buildTicketPanelComponents(getCategories()),
                });
                return interaction.reply({ content: `Ticket panel sent to ${channel}.`, ephemeral: true });
            }

            if (customId === 'ticket_add_category') {
                if (!isPanelAdmin(interaction)) {
                    return interaction.reply({ content: 'You do not have permission to do that.', ephemeral: true });
                }
                return interaction.showModal(buildAddCategoryModal());
            }

            if (customId === 'ticket_remove_category_start') {
                if (!isPanelAdmin(interaction)) {
                    return interaction.reply({ content: 'You do not have permission to do that.', ephemeral: true });
                }
                const categories = getCategories();
                if (!categories.length) {
                    return interaction.reply({ content: 'There are no categories to remove.', ephemeral: true });
                }
                return interaction.reply({
                    content: 'Select a category to remove:',
                    components: buildRemoveCategorySelect(categories),
                    ephemeral: true,
                });
            }

            if (customId === 'ticket_reset_categories') {
                if (!isPanelAdmin(interaction)) {
                    return interaction.reply({ content: 'You do not have permission to do that.', ephemeral: true });
                }
                setCategories([...DEFAULT_CATEGORIES]);
                return interaction.update({
                    embeds: [buildAdminPanelEmbed(getCategories())],
                    components: buildAdminPanelComponents(),
                });
            }

            if (customId === 'ticket_claim') {
                if (!isTicketStaff(interaction)) {
                    return interaction.reply({ content: 'You do not have permission to claim tickets.', ephemeral: true });
                }

                const topic = interaction.channel.topic || '';
                const existingClaimer = getClaimerId(topic);
                if (existingClaimer) {
                    return interaction.reply({ content: 'This ticket has already been claimed.', ephemeral: true });
                }

                const newTopic = setClaimerId(topic, interaction.user.id);
                await interaction.channel.setTopic(newTopic).catch(() => {});

                const oldEmbed = interaction.message.embeds[0];
                const embed = EmbedBuilder.from(oldEmbed)
                    .setColor(0xFEE75C)
                    .addFields({ name: 'Claimed By', value: interaction.user.tag, inline: true });

                await interaction.update({ embeds: [embed], components: buildTicketButtonsRow(interaction.user.tag) });
                return;
            }

            if (customId === 'ticket_unclaim') {
                const topic = interaction.channel.topic || '';
                const claimerId = getClaimerId(topic);

                if (!claimerId) {
                    return interaction.reply({ content: 'This ticket is not currently claimed.', ephemeral: true });
                }
                const canUnclaim = interaction.user.id === claimerId || isPanelAdmin(interaction);
                if (!canUnclaim) {
                    return interaction.reply({ content: 'Only the staff member who claimed this ticket (or an admin) can unclaim it.', ephemeral: true });
                }

                const newTopic = setClaimerId(topic, null);
                await interaction.channel.setTopic(newTopic).catch(() => {});

                const oldEmbed = interaction.message.embeds[0];
                const fields = oldEmbed.fields.filter(f => f.name !== 'Claimed By');
                const embed = EmbedBuilder.from(oldEmbed).setColor(0x5865F2).setFields(fields);

                await interaction.update({ embeds: [embed], components: buildTicketButtonsRow(null) });
                return;
            }

            if (customId === 'ticket_close') {
                const topic = interaction.channel.topic || '';
                const ownerId = getOwnerId(topic);
                const allowed = isTicketStaff(interaction) || isPanelAdmin(interaction) || interaction.user.id === ownerId;
                if (!allowed) {
                    return interaction.reply({ content: 'Only the ticket opener or staff can close this ticket.', ephemeral: true });
                }

                await interaction.reply({ content: 'Generating transcript and closing this ticket in 5 seconds...' });

                try {
                    const messages = await fetchAllMessages(interaction.channel);
                    const transcriptText = formatTranscript(interaction.channel, messages);
                    // Built as an in-memory Buffer and uploaded directly — never written to disk.
                    const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
                        name: `transcript-${interaction.channel.name}.txt`,
                    });

                    const logChannel = await client.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Ticket Transcript')
                            .setColor(0x5865F2)
                            .addFields(
                                { name: 'Channel', value: `#${interaction.channel.name}`, inline: true },
                                { name: 'Category', value: getCategory(topic) || 'Unknown', inline: true },
                                { name: 'Closed By', value: interaction.user.tag, inline: true },
                                { name: 'Message Count', value: `${messages.length}`, inline: true },
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                    } else {
                        console.error(`[tickets] Transcript channel ${TRANSCRIPT_CHANNEL_ID} not found — check TRANSCRIPT_CHANNEL_ID in config.`);
                    }
                } catch (error) {
                    console.error('[tickets] Failed to generate/send transcript:', error);
                }

                setTimeout(() => {
                    interaction.channel.delete().catch(err => console.error('[tickets] Failed to delete ticket channel:', err));
                }, 5000);
                return;
            }

            return;
        }

        // ---------------- Select menus ----------------
        if (interaction.isStringSelectMenu()) {
            const { customId } = interaction;

            if (customId === 'ticket_open_select') {
                const category = interaction.values[0];
                const guild = interaction.guild;

                const existing = guild.channels.cache.find(c => getOwnerId(c.topic) === interaction.user.id);
                if (existing) {
                    return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });

                const safeName =
                    `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) ||
                    `ticket-${interaction.user.id}`;

                try {
                    const ticketChannel = await guild.channels.create({
                        name: safeName,
                        type: ChannelType.GuildText,
                        topic: `Ticket for ${interaction.user.tag} | Category: ${category} | Owner:${interaction.user.id}`,
                        permissionOverwrites: [
                            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                            {
                                id: interaction.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                            },
                            {
                                id: TICKET_ACCESS_ROLE_ID,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                            },
                            {
                                id: client.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageChannels,
                                ],
                            },
                        ],
                    });

                    await ticketChannel.send({
                        content: `${interaction.user} | <@&${TICKET_ACCESS_ROLE_ID}>`,
                        embeds: [buildTicketWelcomeEmbed(category, interaction.user)],
                        components: buildTicketButtonsRow(null),
                    });

                    await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
                } catch (error) {
                    console.error('[tickets] Failed to create ticket channel:', error);
                    await interaction.editReply({ content: 'Something went wrong creating your ticket. Please contact staff.' });
                }
                return;
            }

            if (customId === 'ticket_remove_category_select') {
                if (!isPanelAdmin(interaction)) {
                    return interaction.reply({ content: 'You do not have permission to do that.', ephemeral: true });
                }
                const toRemove = interaction.values[0];
                setCategories(getCategories().filter(c => c !== toRemove));
                await refreshAdminPanel(client);
                return interaction.update({ content: `Removed ${toRemove}.`, components: [] });
            }

            return;
        }

        // ---------------- Modals ----------------
        if (interaction.isModalSubmit() && interaction.customId === 'ticket_add_category_modal') {
            if (!isPanelAdmin(interaction)) {
                return interaction.reply({ content: 'You do not have permission to do that.', ephemeral: true });
            }

            const name = interaction.fields.getTextInputValue('category_name').trim();
            const categories = getCategories();

            if (!name) {
                return interaction.reply({ content: 'Category name cannot be empty.', ephemeral: true });
            }
            if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
                return interaction.reply({ content: `${name} already exists.`, ephemeral: true });
            }
            if (categories.length >= 25) {
                return interaction.reply({ content: 'Maximum of 25 categories reached (Discord select menu limit).', ephemeral: true });
            }

            categories.push(name);
            setCategories(categories);

            if (interaction.isFromMessage()) {
                await interaction.update({ embeds: [buildAdminPanelEmbed(categories)], components: buildAdminPanelComponents() });
            } else {
                await interaction.reply({ content: `Added ${name}.`, ephemeral: true });
                await refreshAdminPanel(client);
            }
            return;
        }
    },
};