require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const { google } = require('googleapis');

let credentials;
try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
} catch (error) {
    throw new Error('Invalid GOOGLE_CREDENTIALS in .env');
}

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

async function getBadgeNumberAndUpdateSheet(timezone, name, discordId, date) {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';

    // B = Name
    // C = Badge
    // D = Discord
    // E = Hire Date
    // F = Promo Date
    // G = Timezone
    const employeeRange = 'DPS | Employee Database!B31:G';

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: employeeRange,
    });

    const rows = response.data.values || [];

    let badgeNumber = null;
    let rowIndex = 31;

    for (const row of rows) {
        if (!row[0]?.trim()) {

            badgeNumber = row[1];

            if (!badgeNumber)
                throw new Error(`No badge number found on row ${rowIndex}.`);
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `DPS | Employee Database!B${rowIndex}:G${rowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[
                        name,
                        badgeNumber,
                        discordId,
                        date,
                        date,
                        timezone
                    ]]
                }
            });
            return badgeNumber;
        }
        rowIndex++;
    }
    throw new Error('No available employee slot.');
}
async function updateMasterRoster(name) {

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';

    const range = 'DPS | Main Roster!D186:D';

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range
    });

    const rows = response.data.values || [];

    let row = 186;

    for (const r of rows) {
        if (!r[0]?.trim())
            break;

        row++;
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `DPS | Main Roster!D${row}`,
        valueInputOption: 'RAW',
        resource: {
            values: [[name]]
        }
    });

    return row;
}
async function getMasterRosterValue(row) {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const rosterSpreadsheetId = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';
    const range = `DPS | Main Roster!B${row}`;

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: rosterSpreadsheetId, range });
    const value = response.data.values ? response.data.values[0][0] : null;

    if (!value) {
        throw new Error(`No value found in column B for row ${row}`);
    }

    return value;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roster-onboard')
        .setDescription('Onboard a constable and update the roster.')
        .addStringOption(option =>
            option.setName('name_constable')
                .setDescription('The name of the constable.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('Timezone of the constable.')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user of the constable.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const name = interaction.options.getString('name_constable');
        const timezone = interaction.options.getString('timezone');
        const user = interaction.options.getUser('user');
        const date = new Date().toISOString().split('T')[0];
const onboardChannelId = '1533576786481254583';
        const allowedRoleId = '1533595553034801212';

        try {
            await interaction.deferReply({ ephemeral: false });

            const member = interaction.guild.members.cache.get(interaction.user.id);
            if (!member || !member.roles.cache.has(allowedRoleId)) {
                return await interaction.editReply({
                    content: 'You do not have the required role to use this command.',
                    ephemeral: false,
                });
            }

            const db = await getConnection();

            const badgeNumber = await getBadgeNumberAndUpdateSheet(timezone, name, user.id, date);

            const row = await updateMasterRoster(name);
            const rosterValue = await getMasterRosterValue(row);

            await db.query(
                'INSERT INTO officers (name, timezone, user_id, badge_number) VALUES (?, ?, ?, ?)',
                [name, timezone, user.id, badgeNumber]
            );

            const nickname = `${rosterValue} | ${name}`;
            const userMember = interaction.guild.members.cache.get(user.id);
            if (userMember) await userMember.setNickname(nickname);
const onboardChannel = interaction.guild.channels.cache.get(onboardChannelId);

if (onboardChannel) {
    await onboardChannel.send({
        content: `<@${user.id}> ---> **Cadet (Needs Training)** | Onboarded by <@${interaction.user.id}>`
    });
}
            const embed = new EmbedBuilder()
                .setTitle('Constable Onboarded')
                .setThumbnail('https://media.discordapp.net/attachments/1528160041293713548/1529327853156565022/image.png?ex=6a70b24d&is=6a6f60cd&hm=ab78d6d3deab94ff2d09a668b3a1166eb1610774c23f152ac6fd8b4eb460dfc3&=&format=webp&quality=lossless')
                .setDescription(`Constable **${name}** has been successfully onboarded..`)
                .addFields(
                    { name: 'Badge Number', value: badgeNumber, inline: true },
                    { name: 'Timezone', value: timezone, inline: true },
                    { name: 'User', value: `<@${user.id}>`, inline: true }
                )
                .setColor('#f2c14e')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}`, ephemeral: false });
        }
    }
};