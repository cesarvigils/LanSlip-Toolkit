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
        .setName('tacops')
        .setDescription('View the current TacOps list.'),

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

            const db = await getConnection();

            const [rows] = await db.query(`
                SELECT
                    officer_name,
                    discord_id,
                    added_by_name,
                    created_at
                FROM tacopslist
                ORDER BY officer_name ASC
            `);

            if (!rows.length) {
                return interaction.editReply({
                    content: 'The TacOps list is currently empty.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('TacOps List')
                .setColor('#0099ff')
                .setDescription(`Total Officers: **${rows.length}**`)
                .setTimestamp();

            rows.forEach((officer, index) => {

                embed.addFields({
                    name: `${index + 1}. ${officer.officer_name}`,
                    value:
`**Discord:** <@${officer.discord_id}>
**Added By:** ${officer.added_by_name}
**Added:** <t:${Math.floor(new Date(officer.created_at).getTime() / 1000)}:F>`,
                    inline: false
                });

            });

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