const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
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
                    .setStyle('ButtonStyle.Success'), // обновлено: использовать строку 'SUCCESS'
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('ButtonStyle.Danger'), // обновлено: использовать строку 'DANGER'
            );

        await interaction.reply({
            content: '⚠️ Вы уверены, что хотите удалить **ВСЕ** данные о себе в Quiz?',
            components: [row],
        });

        const filter = (i) => i.customId === 'confirm' || i.customId === 'cancel';
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm') {
                await userSchema.deleteOne({ user_id: interaction.user.id });
                await i.update({ content: '✅ Ваши данные были удалены из нашей базы данных.', components: [] });
            } else {
                await i.update({ content: '❌ Удаление отменено.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⌛ Время на подтверждение истекло. Удаление отменено.', components: [] });
            }
        });
    }
}
