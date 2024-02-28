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
                new MessageButton()
                    .setCustomId('confirm')
                    .setLabel('Да')
                    .setStyle('Success'),
                new MessageButton()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('Danger'),
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Удаление данных')
            .setDescription('Ваши данные были успешно удалены из нашей базы данных.')
            .setColor('#00ff00'); // Установите цвет, который вам нужен

        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Удаление отменено')
            .setColor('#ff0000'); // Установите цвет, который вам нужен

        const timeoutEmbed = new EmbedBuilder()
            .setTitle('⌛ Время на подтверждение истекло')
            .setColor('#ff0000'); // Установите цвет, который вам нужен

        const confirmMessage = await interaction.reply({
            content: '⚠️ Вы уверены, что хотите удалить **ВСЕ** данные о себе в Quiz?',
            components: [row],
        });

        const filter = (i) => i.customId === 'confirm' || i.customId === 'cancel';
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm') {
                await userSchema.deleteOne({ user_id: interaction.user.id });
                await interaction.followUp({ embeds: [confirmEmbed] });
            } else {
                await interaction.followUp({ embeds: [cancelEmbed] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.followUp({ embeds: [timeoutEmbed] });
            }
        });
    }
}
