const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const { getGuild } = require('../utils/quizUtils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auto-quiz')
        .setDescription('Настраивает автоматическую отправку викторин в выбранный канал.')
        .addChannelOption((option) =>
            option
                .setName('канал')
                .setDescription('Текстовый канал для авто-викторин')
                .setRequired(true))
        .addIntegerOption((option) =>
            option
                .setName('интервал')
                .setDescription('Интервал в минутах. Укажите 0, чтобы отключить авто-викторины.')
                .setRequired(false)
                .setMinValue(0)),

    async execute(interaction, client) {
        const permissions = new PermissionsBitField(interaction.memberPermissions);
        if (!permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: '❌ Нет доступа. Нужны права администратора.',
                ephemeral: true
            });
        }

        const guild = await getGuild(interaction.guildId);
        if (!guild) {
            return interaction.reply({ content: '❌ Не удалось загрузить настройки сервера.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('канал');
        const interval = interaction.options.getInteger('интервал') ?? 0;

        if (interval === 0) {
            guild.random_quiz_channel = null;
            guild.random_quiz_interval = 0;
            await guild.save();
            await client.scheduleRandomQuizzes(interaction.guildId);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Авто-викторины отключены')
                        .setDescription('Бот больше не будет автоматически отправлять вопросы на этом сервере.')
                        .setColor('#4F9D55')
                ],
                ephemeral: true
            });
        }

        if (interval < 30) {
            return interaction.reply({
                content: '⚠️ Интервал должен быть не меньше 30 минут.',
                ephemeral: true
            });
        }

        if (channel.type !== ChannelType.GuildText) {
            return interaction.reply({
                content: '⚠️ Канал должен быть текстовым.',
                ephemeral: true
            });
        }

        try {
            const message = await channel.send({ content: 'Проверка доступа: бот может отправлять сообщения в этот канал.' });
            await message.delete();
        } catch (error) {
            return interaction.reply({
                content: '⚠️ Бот не может отправлять сообщения в выбранный канал. Проверьте права доступа.',
                ephemeral: true
            });
        }

        guild.random_quiz_channel = channel.id;
        guild.random_quiz_interval = interval;
        await guild.save();
        await client.scheduleRandomQuizzes(interaction.guildId);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('✅ Авто-викторины настроены')
                    .setDescription(`Канал: <#${channel.id}>\nИнтервал: ${interval} минут.`)
                    .setColor('#4F9D55')
            ],
            ephemeral: true
        });
    }
};
