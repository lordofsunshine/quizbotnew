const { SlashCommandBuilder } = require('discord.js');
const { getHelp } = require('../utils/help');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Показывает список команд или подробную справку по одной команде.')
        .addStringOption((option) =>
            option
                .setName('команда')
                .setDescription('Команда, по которой нужно показать подробную справку')
                .setRequired(false)
                .setAutocomplete(true)),

    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const commandNames = Array.from(client.commands.keys()).filter(Boolean);
        const filteredCommands = commandNames
            .filter((name) => name.includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(filteredCommands.map((commandName) => ({ name: commandName, value: commandName })));
    },

    async execute(interaction, client) {
        await getHelp(client, interaction, interaction.options.getString('команда'));
    }
};
