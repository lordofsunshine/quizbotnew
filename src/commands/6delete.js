const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const userSchema = require('../models/userModel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-me')
        .setDescription('Удаляет ваши данные из нашей базы данных'),

    async execute(interaction) {
        const user = await userSchema.findOne({ user_id: interaction.user.id });
        if (!user) return interaction.reply({content: '❌ У вас нет никаких данных, хранящихся в нашей базе данных.', ephemeral: true});
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Да')
                    .setStyle('Success'), // обновлено: использовать строку 'SUCCESS'
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('Danger'), // обновлено: использовать строку 'DANGER'
            );

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Подтверждение')
            .setDescription('Вы уверены, что хотите удалить **ВСЕ** данные о себе в Quiz?')
            .setColor('#ffa136'); // Установите цвет, который вам нужен

        await interaction.reply({
            embeds: [embed],
            components: [row],
        });

        const filter = (i) => i.customId === 'confirm' || i.customId === 'cancel';
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm') {
                await userSchema.deleteOne({ user_id: interaction.user.id });
                await i.update({ content: ':white_check_mark: Ваши данные были удалены из нашей базы данных.', components: [] });
            } else {
                await i.update({ content: ':x: Удаление отменено.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: ':hourglass: Время на подтверждение истекло. Удаление отменено.', components: [] });
            }
        });
    }
}
