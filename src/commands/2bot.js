const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { bot, links } = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Показывает информацию о боте.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle(bot.name || 'Quiz!')
            .setDescription(bot.description || 'Бот для викторин в Discord.')
            .setColor('#f3ae6d')
            .addFields(
                { name: 'Серверов', value: String(interaction.client.guilds.cache.size), inline: true },
                { name: 'Задержка WebSocket', value: `${Math.max(0, Math.round(interaction.client.ws.ping))} мс`, inline: true }
            );

        if (links.support) embed.addFields({ name: 'Поддержка', value: links.support, inline: false });
        if (links.invite) embed.addFields({ name: 'Приглашение', value: links.invite, inline: false });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
