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
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('Danger')
                    .setDisabled(false),
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Подтверждение удаления')
            .setDescription('Вы уверены, что хотите удалить **ВСЕ** данные о себе в Quiz?')
            .setColor('#ffff00');

        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Удаление отменено')
            .setColor('#ff0000');

        const timeoutEmbed = new EmbedBuilder()
            .setTitle('⌛ Время на подтверждение истекло')
            .setColor('#ff0000');

        const confirmMessage = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row.toJSON()],
        });

        const filter = (i) => i.customId === 'confirm' || i.customId === 'cancel';
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm') {
                await userSchema.deleteOne({ user_id: interaction.user.id });
                await confirmMessage.edit({ embeds: [confirmEmbed], components: [] });
            } else {
                await confirmMessage.edit({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                confirmMessage.edit({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
};
