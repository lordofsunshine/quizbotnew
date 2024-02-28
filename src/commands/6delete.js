const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const userSchema = require('../models/userModel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-me')
        .setDescription('Удаляет ваши данные из нашей базы данных'),

    async execute(interaction) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Да')
                    .setStyle('Success')
                    .setDisabled(false), // Кнопка не отключена по умолчанию
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('Danger')
                    .setDisabled(false), // Кнопка не отключена по умолчанию
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Подтверждение удаления')
            .setDescription('Вы уверены, что хотите удалить **ВСЕ** данные о себе в Quiz?')
            .setColor('#ffff00'); // Установите цвет, который вам нужен

        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Удаление отменено')
            .setColor('#ff0000'); // Установите цвет, который вам нужен

        const timeoutEmbed = new EmbedBuilder()
            .setTitle('⌛ Время на подтверждение истекло')
            .setColor('#ff0000'); // Установите цвет, который вам нужен

        const confirmMessage = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row.toJSON()], // Convert ActionRowBuilder to plain object
        });

        const filter = (i) => i.customId === 'confirm' || i.customId === 'cancel';
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm') {
                await userSchema.deleteOne({ user_id: interaction.user.id });
                await confirmMessage.edit({ embeds: [confirmEmbed], components: [] });
            } else {
                await confirmMessage.edit({ embeds: [cancelEmbed], components: [row.toJSON().components[0].components[0], row.toJSON().components[0].components[1].setDisabled(true)] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                confirmMessage.edit({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
}
