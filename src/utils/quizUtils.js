const { trivia_categories } = require('../misc.js');
const { ActionRowBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const userSchema = require('../models/userModel.js');
const guildModel = require('../models/guildModel.js');
const { logger } = require('./logger');
const { createAnswerOptions, findAnswerByCustomId } = require('./answerOptions');

async function getGuild(guildId) {
    try {
        return await guildModel.findOneAndUpdate(
            { guild_id: guildId },
            { $setOnInsert: { guild_id: guildId } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        logger.error('❌ Не удалось получить данные сервера.');
        logger.error(err.stack);
        return null;
    }
}

async function getUser(userId) {
    try {
        return await userSchema.findOneAndUpdate(
            { user_id: userId },
            { $setOnInsert: { user_id: userId } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        logger.error('❌ Не удалось получить данные пользователя.');
        logger.error(err.stack);
        return null;
    }
}

async function fetchRandomQuestion(category, difficulty) {
    const url = new URL('https://opentdb.com/api.php');
    url.searchParams.set('amount', '1');
    url.searchParams.set('encode', 'url3986');

    if (category) {
        const selectedCategory = trivia_categories.find((cat) => cat.id.toString() === category);
        if (!selectedCategory) throw new Error('Недопустимая категория.');
        url.searchParams.set('category', category);
    }

    if (difficulty) url.searchParams.set('difficulty', difficulty);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OpenTDB вернул HTTP ${response.status}.`);

    const data = await response.json();
    if (!data.results || data.results.length < 1) return null;

    const question = data.results[0];
    question.question = decodeURIComponent(question.question);
    question.correct_answer = decodeURIComponent(question.correct_answer);
    question.incorrect_answers = question.incorrect_answers.map((answer) => decodeURIComponent(answer));
    question.category = decodeURIComponent(question.category);

    return question;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

function createAnswerButtons(answerOptions, reveal = false) {
    const answerButtons = new ActionRowBuilder();

    answerOptions.forEach((option) => {
        answerButtons.addComponents(
            new ButtonBuilder()
                .setCustomId(option.customId)
                .setLabel(option.label)
                .setStyle(reveal ? (option.isCorrect ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Primary)
                .setDisabled(reveal)
        );
    });

    return answerButtons;
}

function collectAnswers(message, answerOptions, time = 20000) {
    const userAnswers = [];

    const collector = message.createMessageComponentCollector({
        filter: (interaction) => Boolean(findAnswerByCustomId(answerOptions, interaction.customId)),
        time
    });

    collector.on('collect', async (interaction) => {
        if (userAnswers.some((answer) => answer.userId === interaction.user.id)) {
            return interaction.reply({
                content: '❌ Вы уже ответили на этот вопрос. Ожидайте результатов.',
                ephemeral: true
            });
        }

        const selectedAnswer = findAnswerByCustomId(answerOptions, interaction.customId);
        userAnswers.push({
            userId: interaction.user.id,
            answer: selectedAnswer.answer,
            isCorrect: selectedAnswer.isCorrect
        });

        await interaction.reply({
            content: `✅ Вы ответили: **${selectedAnswer.answer}**.`,
            ephemeral: true
        });
    });

    return new Promise((resolve) => {
        collector.on('end', async () => {
            resolve(userAnswers);
            await message.edit({ components: [createAnswerButtons(answerOptions, true)] });
        });
    });
}

module.exports = {
    fetchRandomQuestion,
    shuffleArray,
    createAnswerOptions,
    createAnswerButtons,
    collectAnswers,
    getUser,
    getGuild
};
