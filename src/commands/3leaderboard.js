const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userModel = require('../models/userModel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Показывает таблицу лидеров.')
        .addIntegerOption((option) =>
            option
                .setName('страница')
                .setDescription('Номер страницы таблицы лидеров')
                .setRequired(false)
                .setMinValue(1))
        .addStringOption((option) =>
            option
                .setName('сортировка')
                .setDescription('Способ сортировки таблицы')
                .setRequired(false)
                .addChoices(
                    { name: 'Очки', value: 'points' },
                    { name: 'Соотношение побед', value: 'ratio' }
                )),

    async execute(interaction) {
        const page = interaction.options.getInteger('страница') || 1;
        const sort = interaction.options.getString('сортировка') || 'points';
        const pageSize = 10;

        let leaderboard;
        if (sort === 'points') {
            leaderboard = await userModel.find({}).sort({ points: -1 }).lean();
        } else {
            leaderboard = await userModel.find({}).lean();
            leaderboard = leaderboard.map((user) => {
                const total = user.correct_answers.length + user.incorrect_answers.length;
                const ratio = total > 0 ? user.correct_answers.length / total : 0;
                return { user_id: user.user_id, points: ratio };
            }).sort((a, b) => b.points - a.points);
        }

        if (leaderboard.length === 0) {
            return interaction.reply({ content: '⚠️ Таблица лидеров пока пустая.', ephemeral: true });
        }

        const totalPages = Math.max(1, Math.ceil(leaderboard.length / pageSize));
        if (page > totalPages) {
            return interaction.reply({ content: '❌ Такой страницы нет.', ephemeral: true });
        }

        const rows = leaderboard
            .slice((page - 1) * pageSize, page * pageSize)
            .map((user, index) => {
                const place = index + 1 + (page - 1) * pageSize;
                const value = sort === 'points' ? `${user.points} очков` : `${user.points.toFixed(2)} побед`;
                return `**${place}.** <@${user.user_id}> — ${value}`;
            });

        const embed = new EmbedBuilder()
            .setTitle('Таблица лидеров')
            .setDescription(rows.join('\n'))
            .setColor('#f3ae6d')
            .setFooter({ text: `Страница ${page} из ${totalPages}` })
            .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }));

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
