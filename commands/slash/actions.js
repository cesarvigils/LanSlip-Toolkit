const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DEV_ROLE_ID, QA_ROLE_ID } = require('../../config/actionsSettings');
const { createOrder, getOrder, setStatus } = require('../../utils/ordersRepo');
const { refreshOrdersPanel } = require('../../utils/refreshOrdersPanel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('actions')
        .setDescription('Manage the order workflow')
        .addSubcommand(sub =>
            sub
                .setName('start')
                .setDescription('Start a new order')
                .addStringOption(o => o.setName('client').setDescription('Client name').setRequired(true))
                .addStringOption(o => o.setName('service').setDescription('Service being provided').setRequired(true))
                .addStringOption(o => o.setName('eta').setDescription('Estimated completion time').setRequired(true)),
        )
        .addSubcommand(sub =>
            sub
                .setName('progress')
                .setDescription('Mark an order as Work In Progress')
                .addIntegerOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true)),
        )
        .addSubcommand(sub =>
            sub
                .setName('handoff')
                .setDescription('Hand an order off to QA')
                .addIntegerOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true)),
        )
        .addSubcommand(sub =>
            sub
                .setName('finish')
                .setDescription('Mark an order as finished')
                .addIntegerOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true)),
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ---------------- start ----------------
        if (sub === 'start') {
            if (!interaction.member.roles.cache.has(DEV_ROLE_ID)) {
                return interaction.reply({ content: 'You are not authorized to run this command.', ephemeral: true });
            }

            const clientName = interaction.options.getString('client');
            const service = interaction.options.getString('service');
            const eta = interaction.options.getString('eta');

            // Defer immediately — DB writes + panel refresh can take longer than Discord's 3s reply window
            await interaction.deferReply({ ephemeral: false });

            try {
                const orderId = await createOrder({ clientName, service, eta, startedBy: interaction.user.id });
                await refreshOrdersPanel(interaction.client);

                const embed = new EmbedBuilder()
                    .setTitle('Order Started')
                    .setColor(0x5865F2)
                    .addFields(
                        { name: 'Order ID', value: `#${orderId}`, inline: true },
                        { name: 'Client', value: clientName, inline: true },
                        { name: 'Service', value: service, inline: true },
                        { name: 'ETA', value: eta, inline: true },
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('[actions] Error starting order:', error);
                return interaction.editReply({ content: 'Failed to start the order. Check the database connection.' });
            }
        }

        // ---------------- progress ----------------
        if (sub === 'progress') {
            if (!interaction.member.roles.cache.has(DEV_ROLE_ID)) {
                return interaction.reply({ content: 'You are not authorized to run this command.', ephemeral: true });
            }

            const orderId = interaction.options.getInteger('order_id');
            await interaction.deferReply({ ephemeral: false });

            const order = await getOrder(orderId).catch(() => null);
            if (!order) {
                return interaction.editReply({ content: `Order #${orderId} not found.` });
            }
            if (order.status !== 'Started') {
                return interaction.editReply({
                    content: `Order #${orderId} is currently "${order.status}" and can't be moved to Work In Progress from there.`,
                });
            }

            await setStatus(orderId, 'Work In Progress');
            await refreshOrdersPanel(interaction.client);
            return interaction.editReply({ content: `Order #${orderId} marked as Work In Progress.` });
        }

        // ---------------- handoff ----------------
        if (sub === 'handoff') {
            if (!interaction.member.roles.cache.has(DEV_ROLE_ID)) {
                return interaction.reply({ content: 'You are not authorized to run this command.', ephemeral: true });
            }

            const orderId = interaction.options.getInteger('order_id');
            await interaction.deferReply({ ephemeral: false });

            const order = await getOrder(orderId).catch(() => null);
            if (!order) {
                return interaction.editReply({ content: `Order #${orderId} not found.` });
            }
            if (order.status === 'QA Waiting' || order.status === 'Finished') {
                return interaction.editReply({ content: `Order #${orderId} is already "${order.status}".` });
            }

            await setStatus(orderId, 'QA Waiting');
            await refreshOrdersPanel(interaction.client);

            await interaction.editReply({ content: `Order #${orderId} handed off to QA.` });
            return interaction.followUp({
                content: `<@&${QA_ROLE_ID}> Order #${orderId} (${order.client_name} — ${order.service}) is ready for QA.`,
            });
        }

        // ---------------- finish ----------------
        if (sub === 'finish') {
            if (!interaction.member.roles.cache.has(QA_ROLE_ID)) {
                return interaction.reply({ content: 'You are not authorized to run this command.', ephemeral: true });
            }

            const orderId = interaction.options.getInteger('order_id');
            await interaction.deferReply({ ephemeral: false });

            const order = await getOrder(orderId).catch(() => null);
            if (!order) {
                return interaction.editReply({ content: `Order #${orderId} not found.` });
            }
            if (order.status !== 'QA Waiting') {
                return interaction.editReply({
                    content: `Order #${orderId} must be "QA Waiting" before it can be finished (currently "${order.status}").`,
                });
            }

            await setStatus(orderId, 'Finished', { finishedBy: interaction.user.id });
            await refreshOrdersPanel(interaction.client);
            return interaction.editReply({ content: `Order #${orderId} marked as finished.` });
        }
    },
};