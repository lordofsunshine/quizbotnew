const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
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
                    .setStyle('Success'),
                new MessageButton()
                    .setCustomId('cancel')
                    .setLabel('Нет')
                    .setStyle('Danger'),
            );

        const embed = new MessageEmbed()
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
