const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton } = require('discord.js');
const userSchema = require('../models/userModel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-me')
        .setDescription('Удаляет ваши данные из нашей базы данных'),

    async execute(interaction) {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('confirm')
                    .setLabel('Да')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('DANGER'),
            );

        await interaction.reply({
            content: 'Вы уверены, что хотите удалить все данные о себе?',
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
