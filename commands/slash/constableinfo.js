require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const { google } = require('googleapis');

const SPREADSHEET_ID = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';

let credentials;
try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
} catch (error) {
    throw new Error('Invalid GOOGLE_CREDENTIALS in .env');
}

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

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

async function getOfficerRecord(userId) {
    const db = await getConnection();

    const [rows] = await db.query(
        'SELECT name, timezone, badge_number FROM officers WHERE user_id = ?',
        [userId]
    );

    if (!rows.length) {
        throw new Error('Officer not found in the database.');
    }

    return rows[0];
}


async function getMainRosterInfo(officerName) {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DPS | Main Roster!B18:F235',
    });

    const roster = response.data.values || [];

    // Columns within range B:F -> index 0=B, 2=D, 4=F
    const CALLSIGN_COL = 0; // B
    const NAME_COL = 2;     // D
    const RANK_COL = 4;     // F

    for (let i = 0; i < roster.length; i++) {
        const row = roster[i];

        if ((row[NAME_COL] || '').trim().toLowerCase() === officerName.trim().toLowerCase()) {
            const sheetRow = i + 18;

            let badgeType = 'patrol';
            if (sheetRow >= 18 && sheetRow <= 34)
                badgeType = 'hc';
            else if (sheetRow >= 35 && sheetRow <= 54)
                badgeType = 'lowcmd';
            else if (sheetRow >= 55 && sheetRow <= 99)
                badgeType = 'supervisor';
            else if (sheetRow >= 100 && sheetRow <= 123)
                badgeType = 'triallowcmd';

            return {
                callsign: row[CALLSIGN_COL] || null,
                rank: row[RANK_COL] || null,
                badgeType,
            };
        }
    }

    return null; // not on the roster - not fatal
}

// Mirrors the Employee Database column layout from roster-onboard.js:
// B=Name, C=Badge, D=Discord, E=Hire Date, F=Promo Date, G=Timezone
async function getEmployeeDatabaseInfo(officerName) {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DPS | Employee Database!B31:G',
    });

    const rows = response.data.values || [];

    for (const row of rows) {
        if ((row[0] || '').trim().toLowerCase() === officerName.trim().toLowerCase()) {
            return {
                badgeNumber: row[1] || null,
                discordId: row[2] || null,
                hireDate: row[3] || null,
                promoDate: row[4] || null,
                timezone: row[5] || null,
            };
        }
    }

    return null; // not on the employee database - not fatal
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('constable')
        .setDescription("View a constable's full info.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The constable to look up (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;

            const officer = await getOfficerRecord(targetUser.id);
            const rosterInfo = await getMainRosterInfo(officer.name);
            const employeeInfo = await getEmployeeDatabaseInfo(officer.name);

            const embed = new EmbedBuilder()
                .setTitle(`Constable Info — ${officer.name}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor('#f2c14e')
                .addFields(
                    { name: 'User', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Badge Number', value: String(officer.badge_number ?? employeeInfo?.badgeNumber ?? 'N/A'), inline: true },
                    { name: 'Timezone', value: officer.timezone || employeeInfo?.timezone || 'N/A', inline: true },
                );

            if (rosterInfo) {
                embed.addFields(
                    { name: 'Callsign', value: rosterInfo.callsign || 'N/A', inline: true },
                    { name: 'Rank', value: rosterInfo.rank || 'N/A', inline: true },
                );
            }

            if (employeeInfo) {
                embed.addFields(
                    { name: 'Hire Date', value: employeeInfo.hireDate || 'N/A', inline: true },
                    { name: 'Promotion Date', value: employeeInfo.promoDate || 'N/A', inline: true },
                );
            }

            embed.setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};