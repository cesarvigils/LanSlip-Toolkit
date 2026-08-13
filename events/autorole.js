const AUTO_ROLE_IDS = [
    '1536804449425817676', 
    '1536804449425817675', 
];

module.exports = {
    name: 'guildMemberAdd',
    once: false,
    async execute(member, client) {
        try {
            if (member.user.bot) return;

            const me = member.guild.members.me ?? await member.guild.members.fetchMe();
            const validRoles = [];

            for (const roleId of AUTO_ROLE_IDS) {
                const role = member.guild.roles.cache.get(roleId);
                if (!role) {
                    console.error(`[autorole] Role ID ${roleId} not found in this guild.`);
                    continue;
                }
                if (role.position >= me.roles.highest.position) {
                    console.error(`[autorole] Bot's highest role is below "${role.name}" — move the bot's role higher.`);
                    continue;
                }
                validRoles.push(role);
            }

            if (!validRoles.length) return;

            await member.roles.add(validRoles, 'Auto-role on join');
        } catch (error) {
            console.error('[autorole] Error assigning roles:', error);
        }
    },
};