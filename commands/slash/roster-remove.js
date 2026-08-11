const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();

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

async function getAuth() {
    const rawCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    rawCredentials.private_key = rawCredentials.private_key.replace(/\\n/g, '\n');

    return new google.auth.GoogleAuth({
        credentials: rawCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function removeOfficer(auth, spreadsheetId, discordId) {

    const sheets = google.sheets({
        version: 'v4',
        auth
    });

    // Employee Database
    const employeeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'DPS | Employee Database!B31:G'
    });

    const employeeRows = employeeResponse.data.values || [];

    let officerName = null;

    for (const row of employeeRows) {

        // D = Discord ID
        if (row[2]?.trim() === discordId) {
            officerName = row[0];
            break;
        }
    }

    if (!officerName) {
        throw new Error('Officer not found in Employee Database.');
    }

    // Main Roster
    const rosterResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'DPS | Main Roster!D2:D300'
    });

    const rosterRows = rosterResponse.data.values || [];

    let rosterRow = null;

    for (let i = 0; i < rosterRows.length; i++) {

        if (rosterRows[i]?.[0]?.trim() === officerName) {
            rosterRow = i + 2;
            break;
        }
    }

    if (!rosterRow) {
        throw new Error('Officer not found in Main Roster.');
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `DPS | Main Roster!D${rosterRow}`,
        valueInputOption: 'RAW',
        resource: {
            values: [['']]
        }
    });

    return officerName;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roster-remove')
        .setDescription('Remove an officer from the Main Roster.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Officer to remove')
                .setRequired(true)
        ),

    async execute(interaction) {

        const allowedRoleId = '1533611765160743162';

        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');

        await interaction.deferReply();

        try {

            const auth = await getAuth();

            const spreadsheetId = '1SJ9RfS-W1gfRb4K4d7yEQDQBIxXxfDOH18amd2TQPL4';

            const officerName = await removeOfficer(
                auth,
                spreadsheetId,
                user.id
            );

            const member = await interaction.guild.members.fetch(user.id);

            // Remove all DPS rank roles
            await member.roles.remove(
                Object.values(RANK_ROLES).flat()
            );

            // Reset nickname
            await member.setNickname(`Rt. | ${officerName}`);

            const embed = new EmbedBuilder()
                .setTitle('Officer Removed')
                .setDescription(
                    `**${officerName}** has been removed from the Main Roster.`
                )
                .setColor('#ff3b30')
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (err) {

            console.error(err);

            await interaction.editReply({
                content: err.message
            });

        }
    }
};