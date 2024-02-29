const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emojis, trivia_categories } = require('../misc.js');
const { getCategoryEmoji, capitalizeFirstLetter } = require('../utils/misc.js');
const { awardPoints, getUser, fetchRandomQuestion, shuffleArray, createAnswerButtons, collectAnswers } = require('../utils/quizUtils.js');
const translate = require('@iamtraction/google-translate');
const guildModel = require('../models/guildModel.js');
const wait = require('node:timers/promises').setTimeout;

let quizzesOnGoing = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Начните викторину!')
        .addIntegerOption(option => option
            .setName('раундов')
            .setDescription('Количество раундов')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
        .addStringOption(option => option
            .setName('категория')
            .setDescription('Категория вопроса')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option => option
            .setName('сложность')
            .setDescription('Сложность этого вопроса')
            .setRequired(false)
            .addChoices(
                { "name": "Легко", "value": "easy" },
                { "name": "Средне", "value": "medium" },
                { "name": "Тяжело", "value": "hard" }
            )),

    async autocomplete(interaction) {
        const focus = interaction.options.getFocused(true);
        if (focus.name === 'категория') {
            const choices = trivia_categories.map(category => { return { name: category.name, value: category.id.toString() } });
            const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focus.value.toLowerCase()));
            await interaction.respond(filtered.map(choice => ({ name: choice.name, value: choice.value })))
        }
    },

async execute(interaction) {
        let dada = await guildModel.findOne({ guild_id: interaction.guild.id })
// Новая строка
        if(!dada) dada = await guildModel.create({ guild_id: interaction.guild.id });
// Новая строка
        let time = 120000
        if (dada.cooldown && dada.cooldown + time > Date.now()) return interaction.reply({ content: ":x: Подождите пару минут, чтобы прописать эту команду." })
        else {
            dada.cooldown = Date.now()
            dada.save()
        }
        quizzesOnGoing.push({ channelId: interaction.channelId });

        const category = interaction.options.getString('категория');
        const difficulty = interaction.options.getString('сложность');
        const rounds = interaction.options.getInteger('раундов') || 5;
        let loadingMessage;

        let pointsTable = [];

        for (let i = 0; i < rounds; i++) {

            let {
                question,
                difficulty: questionDifficulty,
                correct_answer: correctAnswer,
                incorrect_answers: inAnswers,
                category: questionCategory
            } = await fetchRandomQuestion(category, difficulty).catch((err) => {
                if (err.message === 'Invalid category') interaction.reply({ content: '❌ Неправильная категория.' });
            });

            if (i !== 0) loadingMessage = await interaction.channel.send({ content: 'Загрузка...' });
            else await interaction.deferReply();

            let texted = await translate(question, { to: "ru" })
            let texted2 = await translate(correctAnswer, { to: "ru" })

            question = texted.text
            correctAnswer = texted2.text
            let incorrectAnswers = []
            inAnswers.map(async x => {
                let ans = await translate(x, { to: "ru" })
                incorrectAnswers.push(ans.text)
            })
            let cat = await translate(questionCategory, { to: "ru" })
            let categoryQuest = cat.text
            await wait(4000)


            let allAnswers = [correctAnswer, ...incorrectAnswers];
            allAnswers = shuffleArray(allAnswers);
            allAnswers = allAnswers.map((answer) => decodeURI(answer));

            const embed = new EmbedBuilder()
                .setTitle(`Вопрос #${i + 1}: ${question}`)
                .setDescription(`Ответ: <t:${Math.floor(Date.now() / 1000) + 20}:R>`)
                .setColor(questionDifficulty === 'easy' ? '#4F9D55' : questionDifficulty === 'medium' ? '#B7B120' : '#B44C4E')
                .setFooter({
                    text: `${getCategoryEmoji(questionCategory)} ${categoryQuest} | ${emojis.difficulty[questionDifficulty]} `
                        + `${capitalizeFirstLetter(questionDifficulty)}`.replace("Easy", "Легко").replace("Medium", "Средне").replace("Hard", "Тяжело"),
                });

            const initialButtons = createAnswerButtons(allAnswers, correctAnswer);

            if (i !== 0) await loadingMessage.edit({ embeds: [embed], components: [initialButtons], content: '' });
            else await interaction.followUp({ embeds: [embed], components: [initialButtons] });

            const userAnswers = await collectAnswers(interaction, correctAnswer, incorrectAnswers, loadingMessage);
            const correctUsers = userAnswers.filter((answer) => answer.answer === correctAnswer) || [];
            const correctPercentage = Math.round((correctUsers.length / userAnswers.length) * 100) || 0;
            let answerString = '';

            for (let i = 0; i < allAnswers.length; i++) {
                if (allAnswers[i] === correctAnswer) answerString += `✅ **${allAnswers[i]}** `;
                else answerString += `❌ **${allAnswers[i]}** `;
                const users = userAnswers.filter((answer) => answer.answer === allAnswers[i]);
                for (let j = 0; j < users.length; j++) answerString += `<@${users[j].userId}> `;
                answerString += `\n`;
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle(`Правильный ответ был: ${correctAnswer}`)
                .setDescription(`**${correctPercentage}%** людей, ответивших правильно\n\n${answerString}`)
                .setColor(correctPercentage >= 50 ? '#4F9D55' : '#B44C4E');

            if (i !== 0) await interaction.channel.send({ embeds: [resultEmbed] });
            else await interaction.followUp({ embeds: [resultEmbed] });

            for (let i = 0; i < correctUsers.length; i++) {
                const user = await getUser(correctUsers[i].userId);
                const points = await awardPoints(questionDifficulty, correctUsers[i].userId);

                // Check if the user has already answered this question
                if (user.correct_answers.some((answer) => answer.question === question)) {
                    const index = user.correct_answers.findIndex((answer) => answer.question === question);
                    user.correct_answers[index].amountOfTimes++;
                } else {
                    user.correct_answers.push({ question, amountOfTimes: 1, category: questionCategory });
                }

                // Add the points to the points table
                if (pointsTable.some((user) => user.userId === correctUsers[i].userId)) {
                    const index = pointsTable.findIndex((user) => user.userId === correctUsers[i].userId);
                    pointsTable[index].points += points;
                } else {
                    pointsTable.push({ userId: correctUsers[i].userId, points });
                }

                await user.save();
            }

            for (let i = 0; i < userAnswers.length; i++) {
                if (correctUsers.some((user) => user.userId === userAnswers[i].userId)) continue;
                const user = await getUser(userAnswers[i].userId);

                // Check if the user has already answered this question
                if (user.incorrect_answers.some((answer) => answer.question === question)) {
                    const index = user.incorrect_answers.findIndex((answer) => answer.question === question);
                    user.incorrect_answers[index].amountOfTimes++;
                } else {
                    user.incorrect_answers.push({ question, amountOfTimes: 1, category: questionCategory });
                }

                await user.save();
            }

            // Update the points table

            // Wait 5 seconds before starting the next round
            if (i !== rounds - 1) {
                const nextRnd = await interaction.channel.send({ content: '⚠️ Следующий раунд начнётся через 5 секунд...' });
                await new Promise(resolve => setTimeout(resolve, 5000));
                await nextRnd.delete();
            } else {
                const finishedMsg = await interaction.channel.send({ content: '✅ Викторина закончена!' });

                // Sort the points table
                pointsTable = pointsTable.sort((a, b) => b.points - a.points);


                // Create the points table embed
                let content = pointsTable.map((user, index) => `${index + 1}. <@${user.userId}> - ${user.points} очков`).join('\n')
                if (!content) content = "Никто не ответил правильно."
                const pointsTableEmbed = new EmbedBuilder()
                    .setTitle('📈 Таблица очков')
                    .setDescription(content)
                    .setColor('#f3ae6d');

                await finishedMsg.edit({ embeds: [pointsTableEmbed] });

                // Remove the quiz from the quizzesOnGoing array
                quizzesOnGoing = quizzesOnGoing.filter((quiz) => quiz.channelId !== interaction.channelId);
            }
        }
    },
};

