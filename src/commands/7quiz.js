const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { emojis, trivia_categories } = require('../misc.js');
const { getCategoryEmoji, capitalizeFirstLetter } = require('../utils/misc.js');
const {
    collectAnswers,
    createAnswerButtons,
    createAnswerOptions,
    fetchRandomQuestion,
    getGuild,
    getUser,
    shuffleArray
} = require('../utils/quizUtils.js');
const { recordQuizAnswer } = require('../utils/scoring');
const translate = require('@iamtraction/google-translate');
const wait = require('node:timers/promises').setTimeout;

const activeQuizChannels = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Запускает викторину в текущем канале.')
        .addIntegerOption((option) =>
            option
                .setName('раундов')
                .setDescription('Количество раундов')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10))
        .addStringOption((option) =>
            option
                .setName('категория')
                .setDescription('Категория вопроса')
                .setRequired(false)
                .setAutocomplete(true))
        .addStringOption((option) =>
            option
                .setName('сложность')
                .setDescription('Сложность вопроса')
                .setRequired(false)
                .addChoices(
                    { name: 'Легко', value: 'easy' },
                    { name: 'Средне', value: 'medium' },
                    { name: 'Сложно', value: 'hard' }
                )),

    async autocomplete(interaction) {
        const focus = interaction.options.getFocused(true);
        if (focus.name !== 'категория') return;

        const choices = trivia_categories.map((category) => ({ name: category.name, value: category.id.toString() }));
        const filtered = choices
            .filter((choice) => choice.name.toLowerCase().includes(focus.value.toLowerCase()))
            .slice(0, 25);

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const guild = await getGuild(interaction.guild.id);
        if (!guild) {
            return interaction.reply({ content: '❌ Не удалось загрузить настройки сервера.', ephemeral: true });
        }

        const cooldownMs = 120000;
        if (guild.cooldown && guild.cooldown + cooldownMs > Date.now()) {
            return interaction.reply({
                content: '❌ Подождите пару минут перед запуском новой викторины.',
                ephemeral: true
            });
        }

        if (activeQuizChannels.has(interaction.channelId)) {
            return interaction.reply({
                content: '❌ В этом канале уже идёт викторина.',
                ephemeral: true
            });
        }

        guild.cooldown = Date.now();
        await guild.save();
        activeQuizChannels.add(interaction.channelId);

        try {
            const category = interaction.options.getString('категория');
            const difficulty = interaction.options.getString('сложность');
            const rounds = interaction.options.getInteger('раундов') || 5;
            const pointsTable = new Map();

            await interaction.deferReply();

            for (let round = 0; round < rounds; round++) {
                const questionData = await fetchRandomQuestion(category, difficulty);
                if (!questionData) {
                    await interaction.followUp({ content: '❌ Не удалось получить вопрос для викторины.' });
                    break;
                }

                let {
                    question,
                    difficulty: questionDifficulty,
                    correct_answer: correctAnswer,
                    incorrect_answers: incorrectAnswers,
                    category: questionCategory
                } = questionData;

                const [translatedQuestion, translatedCorrectAnswer, translatedCategory, translatedIncorrectAnswers] = await Promise.all([
                    translate(question, { to: 'ru' }),
                    translate(correctAnswer, { to: 'ru' }),
                    translate(questionCategory, { to: 'ru' }),
                    Promise.all(incorrectAnswers.map((answer) => translate(answer, { to: 'ru' })))
                ]);

                question = translatedQuestion.text;
                correctAnswer = translatedCorrectAnswer.text;
                incorrectAnswers = translatedIncorrectAnswers.map((answer) => answer.text);

                const allAnswers = shuffleArray([correctAnswer, ...incorrectAnswers]);
                const answerOptions = createAnswerOptions(allAnswers, correctAnswer);

                const embed = new EmbedBuilder()
                    .setTitle(`Вопрос #${round + 1}: ${question}`)
                    .setDescription(`Ответить можно <t:${Math.floor(Date.now() / 1000) + 20}:R>.`)
                    .setColor(questionDifficulty === 'easy' ? '#4F9D55' : questionDifficulty === 'medium' ? '#B7B120' : '#B44C4E')
                    .setFooter({
                        text: `${getCategoryEmoji(questionCategory)} ${translatedCategory.text} | ${emojis.difficulty[questionDifficulty]} ${capitalizeFirstLetter(questionDifficulty)}`
                            .replace('Easy', 'Легко')
                            .replace('Medium', 'Средне')
                            .replace('Hard', 'Сложно')
                    });

                const questionMessage = round === 0
                    ? await interaction.followUp({ embeds: [embed], components: [createAnswerButtons(answerOptions)] })
                    : await interaction.channel.send({ embeds: [embed], components: [createAnswerButtons(answerOptions)] });

                const userAnswers = await collectAnswers(questionMessage, answerOptions, 20000);
                const correctUsers = userAnswers.filter((answer) => answer.isCorrect);
                const correctPercentage = userAnswers.length ? Math.round((correctUsers.length / userAnswers.length) * 100) : 0;

                let answerString = '';
                for (const option of answerOptions) {
                    answerString += `${option.isCorrect ? '✅' : '❌'} **${option.answer}** `;
                    answerString += userAnswers
                        .filter((answer) => answer.answer === option.answer)
                        .map((answer) => `<@${answer.userId}>`)
                        .join(' ');
                    answerString += '\n';
                }

                await interaction.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`Правильный ответ: ${correctAnswer}`)
                            .setDescription(`Правильно ответили **${correctPercentage}%** участников.\n\n${answerString}`)
                            .setColor(correctPercentage >= 50 ? '#4F9D55' : '#B44C4E')
                    ]
                });

                for (const answer of userAnswers) {
                    const user = await getUser(answer.userId);
                    if (!user) continue;

                    const points = recordQuizAnswer(user, {
                        isCorrect: answer.isCorrect,
                        question,
                        category: questionCategory,
                        difficulty: questionDifficulty
                    });

                    await user.save();

                    if (points > 0) {
                        pointsTable.set(answer.userId, (pointsTable.get(answer.userId) || 0) + points);
                    }
                }

                if (round !== rounds - 1) {
                    const nextRoundMessage = await interaction.channel.send({ content: '⚠️ Следующий раунд начнётся через 5 секунд...' });
                    await wait(5000);
                    await nextRoundMessage.delete().catch(() => null);
                }
            }

            const sortedPoints = [...pointsTable.entries()].sort((a, b) => b[1] - a[1]);
            const content = sortedPoints.length
                ? sortedPoints.map(([userId, points], index) => `${index + 1}. <@${userId}> — ${points} очков`).join('\n')
                : 'Никто не ответил правильно.';

            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('📈 Итоги викторины')
                        .setDescription(content)
                        .setColor('#f3ae6d')
                ]
            });
        } finally {
            activeQuizChannels.delete(interaction.channelId);
        }
    }
};
