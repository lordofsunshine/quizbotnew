const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Canvas = require('canvas');
const translate = require('@iamtraction/google-translate');
const { getUser } = require('../utils/quizUtils.js');

const BACKGROUNDS = [
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/image.png?v=1706700884399',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/image(1).png?v=1706701236820',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/image%20(3).png?v=1706701294618',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/image36.png?v=1706701580750',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/imag11e.png?v=1706701646401',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/im1age.png?v=1706701707185',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/59434fbe-9ee2-41a6-ac64-fe5d78b3e904.image.png?v=1706713156377',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/5ae61594-8f94-4468-8052-97f6c8e8c00d.image.png?v=1706713177234',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/157a1c34-d9bd-46c0-a9d8-4f85af9e1d29.image.png?v=1706713195467',
    'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/75fe2382-54f3-4da2-bcf0-a62028e49536.image.png?v=1706713213851',
    'https://cdn.glitch.global/3ec046e6-daca-4629-8edf-a932ffba4b90/Untitle23434d.jpg?v=1709038422243',
    'https://cdn.glitch.global/3ec046e6-daca-4629-8edf-a932ffba4b90/Untit32445led.jpg?v=1709038767070',
    'https://cdn.glitch.global/3ec046e6-daca-4629-8edf-a932ffba4b90/Un324342titled.jpg?v=1709038767745',
    'https://cdn.glitch.global/3ec046e6-daca-4629-8edf-a932ffba4b90/Untitle54353d(1).jpg?v=1709039326365',
    'https://cdn.glitch.global/3ec046e6-daca-4629-8edf-a932ffba4b90/Untitl432ed.jpg?v=1709039326649'
];

const DEFAULT_BACKGROUND = 'https://cdn.glitch.global/dd698d5b-c9d7-4dd7-af77-b64e99c6c348/216_20240109144249.png?v=1706701754962';

function roundedImage(x, y, width, height, radius, ctx) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

async function getTranslatedCategoryName(category) {
    if (!category) return 'Нет данных';
    const translated = await translate(category, { to: 'ru' });
    return translated.text;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Показывает статистику пользователя.')
        .addUserOption((option) =>
            option
                .setName('пользователь')
                .setDescription('Пользователь, статистику которого нужно открыть')
                .setRequired(false)),

    async execute(interaction) {
        let targetUser = interaction.options.getUser('пользователь') || interaction.user;
        if (targetUser.bot) {
            return interaction.reply({ content: '❌ Статистика ботов не поддерживается.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '❌ Пользователь не найден на сервере.', ephemeral: true });
        }

        const userStats = await getUser(targetUser.id);
        if (!userStats) {
            return interaction.reply({ content: '❌ Не удалось загрузить статистику пользователя.', ephemeral: true });
        }

        await interaction.deferReply();

        const canvas = Canvas.createCanvas(1280, 340);
        const ctx = canvas.getContext('2d');
        const backgroundIndex = userStats.bgSet > 0 && userStats.bgSet <= BACKGROUNDS.length ? userStats.bgSet - 1 : null;
        const background = await Canvas.loadImage(backgroundIndex === null ? DEFAULT_BACKGROUND : BACKGROUNDS[backgroundIndex]);
        const avatar = await Canvas.loadImage(member.displayAvatarURL({ dynamic: false, size: 2048, extension: 'png' }));

        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        const totalAnswers = userStats.correct_answers.length + userStats.incorrect_answers.length;
        const winLossRatio = totalAnswers > 0 ? userStats.correct_answers.length / totalAnswers : 0;

        const correctByCategory = {};
        const incorrectByCategory = {};

        userStats.correct_answers.forEach((answer) => {
            correctByCategory[answer.category] = (correctByCategory[answer.category] || 0) + 1;
        });

        userStats.incorrect_answers.forEach((answer) => {
            incorrectByCategory[answer.category] = (incorrectByCategory[answer.category] || 0) + 1;
        });

        try {
            const bestCategory = Object.keys(correctByCategory).sort((a, b) => correctByCategory[b] - correctByCategory[a])[0];
            const worstCategory = Object.keys(incorrectByCategory).sort((a, b) => incorrectByCategory[b] - incorrectByCategory[a])[0];
            await Promise.all([getTranslatedCategoryName(bestCategory), getTranslatedCategoryName(worstCategory)]);
        } catch (error) {
            // Перевод категорий не влияет на создание карточки ранга.
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        Canvas.registerFont('manrope.extrabold.otf', { family: 'rank-title' });
        ctx.font = '40px rank-title';
        ctx.fillText(member.user.username, 645, 230);

        Canvas.registerFont('manrope.semibold.otf', { family: 'rank-subtitle' });
        ctx.font = '25px rank-subtitle';
        ctx.fillStyle = '#FFB41F';
        ctx.fillText(`Очков: ${userStats.points}`, 645, 270);

        Canvas.registerFont('manroope.light.otf', { family: 'rank-small' });
        ctx.font = 'bold 15px rank-small';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(
            `Правильных ответов: ${userStats.correct_answers.length} • Неправильных: ${userStats.incorrect_answers.length} • Соотношение: ${winLossRatio.toFixed(2)}`,
            645,
            300
        );

        ctx.save();
        roundedImage(575, 42, 130, 130, 75, ctx);
        ctx.clip();
        ctx.drawImage(avatar, 575, 42, 130, 130);
        ctx.restore();

        const chooseBackgroundButton = new ButtonBuilder()
            .setCustomId('rank_backgrounds')
            .setLabel('Выбрать фон')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(targetUser.id !== interaction.user.id);

        const rankMessage = await interaction.followUp({
            files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' })],
            components: [new ActionRowBuilder().addComponents(chooseBackgroundButton)]
        });

        const rankCollector = rankMessage.createMessageComponentCollector({
            filter: (button) => button.user.id === interaction.user.id,
            time: 120000
        });

        rankCollector.on('collect', async (button) => {
            if (button.customId !== 'rank_backgrounds') return;

            let page = 0;
            const preview = new EmbedBuilder()
                .setDescription('Выберите фон профиля.')
                .setImage(BACKGROUNDS[page])
                .setColor('#f3ae6d')
                .setFooter({ text: `Страница ${page + 1} из ${BACKGROUNDS.length}` });

            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rank_background_set').setLabel('Установить фон').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rank_background_back').setLabel('Назад').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rank_background_next').setLabel('Вперёд').setStyle(ButtonStyle.Secondary)
            );

            await button.reply({ embeds: [preview], components: [controls], ephemeral: true });
            const previewMessage = await button.fetchReply();
            const previewCollector = previewMessage.createMessageComponentCollector({
                filter: (previewButton) => previewButton.user.id === interaction.user.id,
                time: 120000
            });

            previewCollector.on('collect', async (previewButton) => {
                if (previewButton.customId === 'rank_background_back') {
                    page = page > 0 ? page - 1 : BACKGROUNDS.length - 1;
                } else if (previewButton.customId === 'rank_background_next') {
                    page = page + 1 < BACKGROUNDS.length ? page + 1 : 0;
                } else if (previewButton.customId === 'rank_background_set') {
                    userStats.bgSet = page + 1;
                    await userStats.save();
                    return previewButton.reply({ content: `✅ Фон №${page + 1} установлен.`, ephemeral: true });
                }

                return previewButton.update({
                    embeds: [
                        preview
                            .setImage(BACKGROUNDS[page])
                            .setFooter({ text: `Страница ${page + 1} из ${BACKGROUNDS.length}` })
                    ],
                    components: [controls]
                });
            });
        });
    }
};
