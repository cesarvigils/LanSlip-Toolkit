const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
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
const RANK_ROLES = {
    "Captain": ["1533615478772334713"],
    "1st Lieutenant": ["1533615506353946694"],
    "2nd Lieutenant": [
        "1533615448137142545",
        "1533591569591177437" // Low Command Role
    ],
    "Staff Sergeant": ["1533614289653469384"],
    "Sergeant": ["1533614039559573564", "1533615598758662214"], //Sergeant, Trial supervisor role
    "Corporal (Trial Supervisor)": [
        "1533613831488798831",
        "1533615644115865641"
    ],
    "Lead Constable": ["1533613756649836554"],
    "Senior Constable": ["1533613370031210526"],
    "Constable": ["1533591638507655318"],
    "Probationary Constable": ["1533617466230706326"],
    "Cadet": ["1533617559075553400"],
    "Master Sergeant": [
        "1533615409973170196",
        "1533615598758662214" //Trial LC role
    ]
};
const RANK_RANGES = {
    "Captain": "D18:D23",
    "1st Lieutenant": "D24:D30",
    "2nd Lieutenant": "D35:D43",
        "Master Sergeant": "D48:D54",

    "Staff Sergeant": "D55:D63",
    "Sergeant": "D64:D74",
    "Corporal (Trial Supervisor)": "D79:D99",
    "Lead Constable": "D124:D129",
    "Senior Constable": "D130:D144",
    "Constable": "D145:D169",
    "Probationary Constable": "D170:D181",
    "Cadet": "D186:D235",
    "Reserves": "Reserve Database!D7:D23"
};

async function getAuth() {
    const rawCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    rawCredentials.private_key = rawCredentials.private_key.replace(/\\n/g, '\n');

    return new google.auth.GoogleAuth({
        credentials: rawCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function getBadgeNumberByDiscordIdFromSQL(discordId) {
    const db = await getConnection();
    const [rows] = await db.query(
        'SELECT badge_number FROM officers WHERE user_id = ?',
        [discordId]
    );
    if (rows.length === 0) {
        throw new Error(`Badge number not found for Discord ID: ${discordId}`);
    }
    return rows[0].badge_number.toString().padStart(5, '0');
}

async function moveOfficer(auth, spreadsheetId, badgeNumber, rank) {
    const sheets = google.sheets({ version: 'v4', auth });

    const employeeRange = 'DPS | Employee Database!B31:C';

    const employeeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: employeeRange,
    });

    const employeeRows = employeeResponse.data.values || [];

    let officerName = null;
    let employeeRowIndex = null; // actual sheet row number

    for (let i = 0; i < employeeRows.length; i++) {
        const row = employeeRows[i];
        const badge = row[1]?.toString().padStart(5, '0');

        if (badge === badgeNumber) {
            officerName = row[0];
            employeeRowIndex = 31 + i;
            break;
        }
    }

    if (!officerName)
        throw new Error(`Officer with badge ${badgeNumber} not found.`);

    // Stamp today's date in the Promo Date column (F) on the Employee Database sheet.
    const todayDate = new Date().toISOString().split('T')[0];

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `DPS | Employee Database!F${employeeRowIndex}`,
        valueInputOption: 'RAW',
        resource: {
            values: [[todayDate]]
        },
    });

    // Main Roster
    const masterRosterRange = 'DPS | Main Roster!D2:D300';
    const newRankRange = `DPS | Main Roster!${RANK_RANGES[rank]}`;

    const masterResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: masterRosterRange,
    });

    const rows = masterResponse.data.values || [];

    let currentCell = null;

    for (let i = 0; i < rows.length; i++) {
        if (rows[i]?.[0]?.trim() === officerName) {
            currentCell = `D${i + 2}`;
            break;
        }
    }

    if (!currentCell) {
        throw new Error(`Officer "${officerName}" not found in Main Roster.`);
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `DPS | Main Roster!${currentCell}`,
        valueInputOption: 'RAW',
        resource: {
            values: [['']]
        },
    });

    const newRankResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: newRankRange,
        
    });
    console.log(newRankResponse.data.values);

    const newRows = newRankResponse.data.values || [];

    const startRow = parseInt(
        RANK_RANGES[rank].split(':')[0].substring(1)
    );

    let targetRow = null;

    for (let i = 0; i < newRows.length; i++) {
        if (!newRows[i]?.[0]?.trim()) {
            targetRow = startRow + i;
            break;
        }
    }

    if (!targetRow)
        targetRow = startRow + newRows.length;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `DPS | Main Roster!D${targetRow}`,
        valueInputOption: 'RAW',
        resource: {
            values: [[officerName]]
        },
    });

    const rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `DPS | Main Roster!B${targetRow}:C${targetRow}`,
    });

    const rowData = rowResponse.data.values || [];

    return {
        prefix: rowData[0][0],
    name: officerName,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roster-move')
        .setDescription('Move a user to a new rank.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to move.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('The new rank to assign.')
                .setRequired(true)
                .addChoices(
    { name: 'Captain', value: 'Captain' },
    { name: '1st Lieutenant', value: '1st Lieutenant' },
    { name: '2nd Lieutenant', value: '2nd Lieutenant' },
        { name: 'Master Sergeant', value: 'Master Sergeant' },

    { name: 'Staff Sergeant', value: 'Staff Sergeant' },
    { name: 'Sergeant', value: 'Sergeant' },
    { name: 'Corporal (Trial Supervisor)', value: 'Corporal (Trial Supervisor)' },
    { name: 'Lead Constable', value: 'Lead Constable' },
    { name: 'Senior Constable', value: 'Senior Constable' },
    { name: 'Constable', value: 'Constable' },
    { name: 'Probationary Constable', value: 'Probationary Constable' },
    { name: 'Cadet', value: 'Cadet' }
)
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const allowedRoleId = '1533611765160743162';
        const rank = interaction.options.getString('rank');
        const auth = await getAuth();
        const spreadsheetId = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';

        try {
            await interaction.deferReply();
    const member = interaction.guild.members.cache.get(interaction.user.id);
if (!member || !member.roles.cache.has(allowedRoleId)) {
        return await interaction.editReply({
            content: 'You do not have permission to use this command.',
            ephemeral: true,
        });
    }
            const badgeNumber = await getBadgeNumberByDiscordIdFromSQL(user.id);
const { prefix, name } = await moveOfficer(auth, spreadsheetId, badgeNumber, rank);
            await interaction.guild.members.cache.get(user.id).setNickname(`${prefix} | ${name}`);
            
const movementChannelId = '1533576786481254583';

const movementChannel = interaction.guild.channels.cache.get(movementChannelId);

const member1 = await interaction.guild.members.fetch(user.id);

const rolesToAdd = RANK_ROLES[rank];

if (!rolesToAdd) {
    throw new Error(`No roles configured for rank: ${rank}`);
}

console.log("Adding roles:", rolesToAdd);

await member1.roles.add(rolesToAdd);
if (movementChannel) {
    await movementChannel.send({
        content: `<@${user.id}> ---> **${rank}** | <@${interaction.user.id}> Movement`
    });
}
            const embed = new EmbedBuilder()
                .setTitle('User Moved')
                .setThumbnail('https://media.discordapp.net/attachments/1528160041293713548/1529327853156565022/image.png?ex=6a70b24d&is=6a6f60cd&hm=ab78d6d3deab94ff2d09a668b3a1166eb1610774c23f152ac6fd8b4eb460dfc3&=&format=webp&quality=lossless')
                .setDescription(`**${user.username}** has been moved to the rank **${rank}**.`)
                .addFields({ name: 'Badge Number', value: badgeNumber, inline: true })
                .setColor('#f2c14e')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: `An error occurred: ${error.message}`,
                ephemeral: false,
            });
        }
    },
};