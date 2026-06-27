const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getGuild } = require('../utils/quizUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Настраивает роль, которую бот упоминает при авто-викторине.')
        .addRoleOption((option) =>
            option
                .setName('роль')
                .setDescription('Роль для упоминания. Оставьте пустым, чтобы убрать настройку.')
                .setRequired(false)),

    async execute(interaction) {
        const permissions = new PermissionsBitField(interaction.memberPermissions);
        if (!permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: '❌ Нет доступа. Нужны права администратора.',
                ephemeral: true
            });
        }

        const guild = await getGuild(interaction.guild.id);
        if (!guild) {
            return interaction.reply({ content: '❌ Не удалось загрузить настройки сервера.', ephemeral: true });
        }

        if (!guild.random_quiz_interval) {
            return interaction.reply({
                content: '❌ Авто-викторины на этом сервере не включены.',
                ephemeral: true
            });
        }

        const role = interaction.options.getRole('роль');
        if (!role) {
            guild.rolePing = null;
            await guild.save();
            return interaction.reply({ content: '✅ Роль для упоминания удалена.', ephemeral: true });
        }

        if (role.id === interaction.guild.id || role.managed) {
            return interaction.reply({ content: '❌ Выберите обычную роль сервера.', ephemeral: true });
        }

        guild.rolePing = role.id;
        await guild.save();

        return interaction.reply({ content: `✅ Бот будет упоминать роль <@&${role.id}> перед авто-викториной.`, ephemeral: true });
    }
};
