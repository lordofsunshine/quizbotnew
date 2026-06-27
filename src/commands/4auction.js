const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { getGuild } = require('../utils/quizUtils');
const { canManageAuction } = require('../utils/auction');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auction')
        .setDescription('Показывает магазин ролей сервера.'),

    async execute(interaction) {
        const guildSettings = await getGuild(interaction.guild.id);
        if (!guildSettings) {
            return interaction.reply({ content: '❌ Не удалось загрузить настройки сервера.', ephemeral: true });
        }

        const items = guildSettings.auction?.list || [];
        const description = items.length
            ? items.map((item, index) => `- #${index + 1} <@&${item.role}> — ${item.price} очков${item.description ? `\n  ${item.description}` : ''}`).join('\n')
            : 'В магазине пока нет ролей.';

        const embed = new EmbedBuilder()
            .setTitle('Магазин ролей сервера')
            .setDescription(description)
            .setColor('#f3ae6d');

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const controls = [
            new ButtonBuilder().setCustomId('auction_buy').setLabel('Купить').setStyle(ButtonStyle.Secondary).setDisabled(items.length === 0)
        ];

        if (canManageAuction(member, interaction.guild)) {
            controls.push(
                new ButtonBuilder().setCustomId('auction_add').setLabel('Добавить товар').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('auction_delete').setLabel('Удалить товар').setStyle(ButtonStyle.Secondary).setDisabled(items.length === 0)
            );
        }

        const row = new ActionRowBuilder().addComponents(controls);
        await interaction.reply({ embeds: [embed], components: [row] });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async (button) => {
            if (button.customId === 'auction_buy') {
                return button.showModal(
                    new ModalBuilder()
                        .setCustomId('buyAuction')
                        .setTitle('Купить роль')
                        .addComponents(new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('roleNum')
                                .setLabel('Номер товара')
                                .setPlaceholder('Например: 1')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(3)
                                .setMinLength(1)
                                .setRequired(true)
                        ))
                );
            }

            const buttonMember = await button.guild.members.fetch(button.user.id).catch(() => null);
            if (!canManageAuction(buttonMember, button.guild)) {
                return button.reply({ content: '❌ Нет доступа. Нужны права администратора.', ephemeral: true });
            }

            if (button.customId === 'auction_add') {
                return button.showModal(
                    new ModalBuilder()
                        .setCustomId('setAuction')
                        .setTitle('Добавить роль в магазин')
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('id')
                                    .setLabel('ID роли')
                                    .setPlaceholder('1011549124501442661')
                                    .setStyle(TextInputStyle.Short)
                                    .setMaxLength(19)
                                    .setMinLength(1)
                                    .setRequired(true)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('price')
                                    .setLabel('Цена')
                                    .setPlaceholder('100')
                                    .setStyle(TextInputStyle.Short)
                                    .setMaxLength(10)
                                    .setMinLength(1)
                                    .setRequired(true)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('desc')
                                    .setLabel('Короткое описание')
                                    .setPlaceholder('Например: VIP-роль')
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setMaxLength(80)
                                    .setRequired(false)
                            )
                        )
                );
            }

            if (button.customId === 'auction_delete') {
                return button.showModal(
                    new ModalBuilder()
                        .setCustomId('deleteAuction')
                        .setTitle('Удалить товар')
                        .addComponents(new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('roleNum')
                                .setLabel('Номер товара')
                                .setPlaceholder('Например: 1')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(3)
                                .setMinLength(1)
                                .setRequired(true)
                        ))
                );
            }
        });

        collector.on('end', async () => {
            await message.edit({ components: [] }).catch(() => null);
        });
    }
};
