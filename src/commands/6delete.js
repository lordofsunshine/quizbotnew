const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const userModel = require('../models/userModel.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-me')
        .setDescription('Удаляет ваши данные из базы данных бота.'),

    async execute(interaction) {
        const user = await userModel.findOne({ user_id: interaction.user.id });
        if (!user) {
            return interaction.reply({
                content: '❌ В базе данных нет сохранённых данных о вас.',
                ephemeral: true
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('delete_me_confirm').setLabel('Да').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('delete_me_cancel').setLabel('Нет').setStyle(ButtonStyle.Danger)
        );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Подтверждение удаления')
            .setDescription('Вы уверены, что хотите удалить все свои данные из Quiz?')
            .setColor('#ffb521');

        await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
        const confirmMessage = await interaction.fetchReply();

        const collector = confirmMessage.createMessageComponentCollector({
            filter: (button) => button.user.id === interaction.user.id,
            time: 15000
        });

        collector.on('collect', async (button) => {
            if (button.customId === 'delete_me_confirm') {
                await userModel.deleteOne({ user_id: interaction.user.id });
                await button.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Данные удалены')
                            .setDescription('Ваши данные были удалены из базы данных.')
                            .setColor('#2fde4c')
                    ],
                    components: []
                });
            } else {
                await button.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Удаление отменено')
                            .setDescription('Ваши данные не были удалены.')
                            .setColor('#e32d2d')
                    ],
                    components: []
                });
            }

            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'time') return;
            await confirmMessage.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⌛ Время подтверждения истекло')
                        .setDescription('Запустите команду ещё раз, если хотите удалить данные.')
                        .setColor('#1f1f1f')
                ],
                components: []
            }).catch(() => null);
        });
    }
};
