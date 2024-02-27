const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const userSchema = require('../models/userModel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-me')
        .setDescription('Удаляет ваши данные из нашей базы данных'),

    async execute(interaction) {

        const user = await userSchema.findOne({ user_id: interaction.user.id });
        if (!user) return interaction.reply({content: '❌ У вас нет никаких данных, хранящихся в нашей базе данных.', ephemeral: true});
        await userSchema.deleteOne({ user_id: interaction.user.id });
        await interaction.reply({content: '✅ Ваши данные были удалены из нашей базы данных.', ephemeral: true});

    }
}