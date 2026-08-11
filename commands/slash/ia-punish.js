    const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
    const mysql = require('mysql2/promise');
    require('dotenv').config();

    let connection;

    async function getConnection() {
        if (!connection || connection.state === 'disconnected') {
            connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });
        }
        return connection;
    }

    module.exports = {
        data: new SlashCommandBuilder()
            .setName('ia-punish')
            .setDescription('Assign a punishment to a user.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to punish.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('punishment')
                    .setDescription('Type of punishment.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Verbal Warning', value: 'Verbal Warning' },
                        { name: 'Written Warning', value: 'Written Warning' },
                        { name: 'Strike', value: 'Strike' },
                        { name: 'Termination', value: 'Termination' }
                    )
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Reason for the punishment.')
                    .setRequired(true)
            )
            .addStringOption(option =>
        option
            .setName('prooflink')
            .setDescription('Evidence link')
            .setRequired(true)
    )

    .addAttachmentOption(option =>
        option
            .setName('proofimg')
            .setDescription('Optional screenshot or image')
            .setRequired(false)
    ),
            
        async execute(interaction) {
            const allowedRoleId = '1533591659596742747'; // Replace with the role ID for IA role
            const punishedUser = interaction.options.getUser('user');
            const punishment = interaction.options.getString('punishment');
            const reason = interaction.options.getString('reason');
            const executor = interaction.user;
    const proofLink = interaction.options.getString('prooflink');
    const proofImage = interaction.options.getAttachment('proofimg');
            if (!interaction.member.roles.cache.has(allowedRoleId)) {
                return interaction.reply({
                    content: 'You do not have the required role to execute this command.',
                    ephemeral: true,
                });
            }
            try {
                await interaction.deferReply();

                const db = await getConnection();
                const timestamp = new Date();
    console.log({
        punishedUserId: punishedUser.id,
        punishedUserName: punishedUser.username,
        punishment,
        reason,
        executorId: executor.id,
        executorName: executor.username,
        proofLink,
        proofImage: proofImage ? proofImage.url : null,
        timestamp
    });
    await db.query(
    `INSERT INTO punishments
    (
        punished_user_id,
        punished_user_tag,
        punishment_type,
        reason,
        executor_id,
        executor_name,
        timestamp,
        proof_link,
        proof_image
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        punishedUser.id,
        punishedUser.tag,
        punishment,
        reason,
        executor.id,
        executor.tag,
        timestamp,
        proofLink,
        proofImage ? proofImage.url : null
    ]);
                const embed = new EmbedBuilder()
                    .setTitle('Punishment Assigned')
                    .addFields(
                        { name: 'Punished User', value: `${punishedUser.tag} (${punishedUser.id})`, inline: true },
                        { name: 'Punishment Type', value: punishment, inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Executor', value: `${executor.tag} (${executor.id})`, inline: true },
                        { name: 'Timestamp', value: timestamp.toLocaleString(), inline: true }
                    )
                    .setColor(punishment === 'Termination' ? '#FF0000' : '#FFA500')
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: `An error occurred while assigning the punishment: ${error.message}`, ephemeral: true });
            }
        },
    };
