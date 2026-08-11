require('dotenv').config();
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

let connection;

async function getConnection() {
    // mysql2/promise connections don't expose a reliable `.state` property.
    // Instead, try a lightweight ping and reconnect if it fails.
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

let credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
    version: 'v4',
    auth
});


const SPREADSHEET_ID = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';

async function getOfficerInfo(userId) {
    const db = await getConnection();

    const [rows] = await db.query(
        'SELECT name FROM officers WHERE user_id = ?',
        [userId]
    );

    if (!rows.length) {
        throw new Error('Officer not found.');
    }

    const officerName = rows[0].name;

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DPS | Main Roster!B18:F235'
    });

    const roster = response.data.values || [];

    let callsign = null;
    let badgeType = 'patrol';
    let rank = null;

    const CALLSIGN_COL = 0; // B
    const NAME_COL = 2;     // D
    const RANK_COL = 4;     // F

    for (let i = 0; i < roster.length; i++) {
        const row = roster[i];

        if ((row[NAME_COL] || '').trim().toLowerCase() === officerName.trim().toLowerCase()) {
            callsign = row[CALLSIGN_COL];
            rank = row[RANK_COL];

            const sheetRow = i + 18;

            if (sheetRow >= 18 && sheetRow <= 34)
                badgeType = 'hc';
            else if (sheetRow >= 35 && sheetRow <= 54)
                badgeType = 'lowcmd';
            else if (sheetRow >= 55 && sheetRow <= 99)
                badgeType = 'supervisor';
            else if (sheetRow >= 100 && sheetRow <= 123)
                badgeType = 'triallowcmd';
            else
                badgeType = 'patrol';

            break;
        }
    }

    if (!callsign)
        throw new Error('Officer not found in Main Roster.');

    return {
        callsign,
        rank,
        name: officerName,
        badgeType
    };
}

async function generateBadgeImage(badgeNumber, rank, name, badgeType) {

    const baseColors = {
        hc: 'gold',
        lowcmd: 'gold',
        patrol: 'silver',
        supervisor: 'gons',
        triallowcmd: 'gons',
    };

    const base = baseColors[badgeType];
    if (!base) {
        throw new Error('Invalid badge type.');
    }

    const params = new URLSearchParams({
        textcolor: 'black',
        enamel_type: 'soft',
        base,
        textfont: 'block',
        text1: 'SAN ANDREAS',
        text2: badgeNumber,
        text3: 'DEPARTMENT OF PUBLIC SAFETY',
        text4: name,
        text5: rank,
        seal: 'EUREKA',
        textsep: 'none',
    });

    const url = `https://www.badgeandwallet.com/badge-builder/image/SW-S680USE_P103?${params.toString()}`;

    const response = await axios({
        url,
        responseType: 'arraybuffer',
    });

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    const filePath = path.join(tempDir, `badge_${badgeNumber}.png`);
    const imageBuffer = await sharp(response.data)
        .resize(469, 469, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();

    fs.writeFileSync(filePath, imageBuffer);
    return filePath;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('badge')
        .setDescription('Generate a badge with your badge number, rank, and type.'),

    async execute(interaction) {
        await interaction.deferReply();

        let filePath;
        try {
            const userId = interaction.user.id;
            const { callsign, rank, name, badgeType } = await getOfficerInfo(userId);

            filePath = await generateBadgeImage(callsign, rank, name, badgeType);

            const attachment = new AttachmentBuilder(filePath, { name: 'badge.png' });

            await interaction.editReply({
                content: 'Here is your badge!',
                files: [attachment],
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        } finally {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    },
};