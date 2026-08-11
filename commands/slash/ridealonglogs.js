require('dotenv').config();
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');
const mysql = require('mysql2/promise');

const LOG_CHANNEL_ID = '1533580122978910380';
const SUBMIT_ROLE_ID = '1533595553034801212';   // role required to run /ridealonglog
const APPROVER_ROLE_ID = '1533899611167527062'; // role required to approve/reject

const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h - buttons disable if unanswered

let connection;

async function getConnection() {
    if (connection) {
        try {
            await connection.ping();
            return connection;
        } catch (err) {
            connection = null;
        }
    }

    connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    return connection;
}

let tableEnsured = false;
async function ensureTable() {
    if (tableEnsured) return;

    const db = await getConnection();
    await db.query(`
        CREATE TABLE IF NOT EXISTS ridealong_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cadet_id VARCHAR(32) NOT NULL,
            submitted_by VARCHAR(32) NOT NULL,
            approved_by VARCHAR(32) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    tableEnsured = true;
}

function buildEmbed({ cadet, submitter, status, decidedBy }) {
    return new EmbedBuilder()
        .setTitle('Ride-Along Log')
        .setColor(
            status === 'Approved' ? 0x2f9e44 :
            status === 'Rejected' ? 0xc92a2a :
            0xf0a500 // pending
        )
        .addFields(
            { name: 'Cadet', value: `<@${cadet.id}>` },
            { name: 'Trained By', value: `<@${submitter.id}>` },
            { name: 'Status', value: decidedBy ? `${status} by <@${decidedBy.id}>` : status },
        )
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ridealonglog')
        .setDescription('Log a ride-along (requires approval).')
        .addUserOption(option =>
            option.setName('cadet')
                .setDescription('The cadet being logged')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(SUBMIT_ROLE_ID)) {
            await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        try {
            const cadet = interaction.options.getUser('cadet');
            const submitter = interaction.user;

            const pendingEmbed = buildEmbed({
                cadet, submitter,
                status: 'Pending Approval',
                decidedBy: null,
            });

            await interaction.editReply({
                content: 'Ride-Along log submitted for approval.',
                embeds: [pendingEmbed],
            });

            const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
            if (!logChannel) {
                console.error(`Could not find log channel ${LOG_CHANNEL_ID}`);
                return;
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ridealonglog_approve').setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ridealonglog_reject').setLabel('Reject').setStyle(ButtonStyle.Danger),
            );

            const sentMessage = await logChannel.send({ embeds: [pendingEmbed], components: [row] });

            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: APPROVAL_TIMEOUT_MS,
            });

            collector.on('collect', async buttonInteraction => {
                if (!buttonInteraction.member.roles.cache.has(APPROVER_ROLE_ID)) {
                    await buttonInteraction.reply({
                        content: 'You do not have permission to approve or reject RA logs.',
                        ephemeral: true,
                    });
                    return;
                }

                if (buttonInteraction.customId === 'ridealonglog_approve') {
                    try {
                        await ensureTable();
                        const db = await getConnection();

                        await db.query(
                            `INSERT INTO ridealong_logs (cadet_id, submitted_by, approved_by)
                             VALUES (?, ?, ?)`,
                            [cadet.id, submitter.id, buttonInteraction.user.id]
                        );
                    } catch (err) {
                        console.error(err);
                        await buttonInteraction.reply({
                            content: `Approved, but failed to log to the database: ${err.message}`,
                            ephemeral: true,
                        });
                        collector.stop();
                        return;
                    }

                    const approvedEmbed = buildEmbed({
                        cadet, submitter,
                        status: 'Approved',
                        decidedBy: buttonInteraction.user,
                    });

                    await sentMessage.edit({ embeds: [approvedEmbed], components: [] });
                    await buttonInteraction.reply({ content: `Approved by <@${buttonInteraction.user.id}>. Logged to the database.` });
                } else if (buttonInteraction.customId === 'ridealonglog_reject') {
                    const rejectedEmbed = buildEmbed({
                        cadet, submitter,
                        status: 'Rejected',
                        decidedBy: buttonInteraction.user,
                    });

                    await sentMessage.edit({ embeds: [rejectedEmbed], components: [] });
                    await buttonInteraction.reply({ content: `Rejected by <@${buttonInteraction.user.id}>.` });
                }

                collector.stop();
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    try {
                        await sentMessage.edit({ components: [] });
                    } catch (err) {
                        console.error('Failed to clear buttons after timeout:', err);
                    }
                }
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};