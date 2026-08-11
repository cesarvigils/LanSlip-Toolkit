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
        .setName('tacops-remove')
        .setDescription('Remove an officer from the TacOps list.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Officer to remove.')
                .setRequired(true)
        ),

    async execute(interaction) {

        const allowedRoleId = '1533623095271620759'; // Role allowed.

        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {

            const target = interaction.options.getUser('user');

            const db = await getConnection();

            const [existing] = await db.query(
                'SELECT id FROM tacopslist WHERE discord_id = ?',
                [target.id]
            );

            if (!existing.length) {
                return interaction.editReply({
                    content: `${target.tag} is not on the TacOps list.`
                });
            }

            await db.query(
                'DELETE FROM tacopslist WHERE discord_id = ?',
                [target.id]
            );

            const embed = new EmbedBuilder()
                .setTitle('TacOps List Updated')
                .setColor('#e74c3c')
                .addFields(
                    {
                        name: 'Officer Removed',
                        value: `${target.tag}\n(${target.id})`,
                        inline: true
                    },
                    {
                        name: 'Removed By',
                        value: interaction.user.tag,
                        inline: true
                    }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (err) {

            console.error(err);

            await interaction.editReply({
                content: `An error occurred: ${err.message}`
            });

        }
    }
};