const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function getCommandUsage(command) {
    const options = command.data.options?.map((option) => ` <${option.name}>`).join('') || '';
    return `/${command.data.name}${options}`;
}

async function getHelp(client, interaction, queriedCommand = null) {
    if (queriedCommand) {
        const command = client.commands.get(queriedCommand);
        if (!command) {
            return interaction.reply({ content: '❌ Такой команды нет.', ephemeral: true });
        }

        const rows = [
            `## /${command.data.name}`,
            `**Описание:** ${command.data.description}`,
            `**Использование:** \`${getCommandUsage(command)}\``
        ];

        if (command.data.options?.length) {
            rows.push('### Аргументы');
            for (const option of command.data.options) {
                rows.push(`- **${option.name}** — ${option.description}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🔎 Помощь')
            .setDescription(rows.join('\n'))
            .setColor('#f3ae6d');

        if (interaction.deferred || interaction.replied) {
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    let page = 0;
    const pages = [];
    let currentPage = [];

    for (const command of client.commands.values()) {
        if (currentPage.length === 5) {
            pages.push(currentPage);
            currentPage = [];
        }

        currentPage.push(`- **/${command.data.name}** — ${command.data.description}\n  Использование: \`${getCommandUsage(command)}\``);
    }

    if (currentPage.length) pages.push(currentPage);

    const embed = new EmbedBuilder()
        .setTitle('🔎 Помощь')
        .setDescription(`Все команды:\n${pages[page].join('\n')}\n\nИспользуйте \`/help <команда>\`, чтобы открыть подробности.`)
        .setColor('#f3ae6d')
        .setFooter({ text: `Страница ${page + 1} из ${pages.length}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('help_back').setLabel('Назад').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_next').setLabel('Вперёд').setStyle(ButtonStyle.Secondary)
    );

    let message;
    if (interaction.deferred || interaction.replied) {
        message = await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        message = await interaction.fetchReply();
    }

    const collector = message.createMessageComponentCollector({
        filter: (button) => button.user.id === interaction.user.id,
        time: 60000
    });

    collector.on('collect', async (button) => {
        page = button.customId === 'help_back'
            ? (page > 0 ? page - 1 : pages.length - 1)
            : (page + 1 < pages.length ? page + 1 : 0);

        await button.update({
            embeds: [
                embed
                    .setDescription(`Все команды:\n${pages[page].join('\n')}\n\nИспользуйте \`/help <команда>\`, чтобы открыть подробности.`)
                    .setFooter({ text: `Страница ${page + 1} из ${pages.length}` })
            ],
            components: [row]
        });
    });

    collector.on('end', async () => {
        await message.edit({ components: [] }).catch(() => null);
    });
}

module.exports = { getHelp };
