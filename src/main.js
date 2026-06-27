require('dotenv').config();

const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { CronJob } = require('cron');
const translate = require('@iamtraction/google-translate');
const { Logger, logger } = require('./utils/logger');
const guildModel = require('./models/guildModel.js');
const { fetchRandomQuestion, shuffleArray, createAnswerOptions, createAnswerButtons, getUser } = require('./utils/quizUtils.js');
const { findAnswerByCustomId } = require('./utils/answerOptions');
const { recordQuizAnswer } = require('./utils/scoring');
const { getCategoryEmoji, capitalizeFirstLetter } = require('./utils/misc.js');
const { emojis } = require('./misc.js');
const { latencyLogger } = require('./utils/latencyLogger.js');

const wait = require('node:timers/promises').setTimeout;
const args = process.argv.slice(2);
const clientLogger = new Logger('client', false);
const scheduledQuizTasks = new Map();

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: false }
});

client.commands = new Collection();
client.buttons = new Collection();
client.aliases = new Collection();

function getDiscordToken() {
    return process.env.DEV_MODE
        ? (process.env.DEV_TOKEN || process.env.TOKEN)
        : (process.env.TOKEN || process.env.DEV_TOKEN);
}

async function connectMongo() {
    if (!process.env.MONGO_URL) {
        throw new Error('Переменная окружения MONGO_URL не задана.');
    }

    clientLogger.info('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    clientLogger.success('Подключение к MongoDB установлено.');
}

function startPremiumCleanupJob() {
    const job = new CronJob('0 0 0 */30 * *', async () => {
        const guilds = await guildModel.find({ 'premium.enabled': true });
        await Promise.all(guilds.map(async (guild) => {
            if (guild.premium.time >= Date.now()) return;

            guild.premium.enabled = false;
            guild.premium.time = 0;
            await guild.save();
        }));
    }, null, true, 'Europe/Moscow');

    job.start();
}

async function runRandomQuiz(guild) {
    const guildSettings = await guildModel.findOne({ guild_id: guild.guild_id });
    if (!guildSettings?.random_quiz_interval || !guildSettings.random_quiz_channel) return;

    clientLogger.info(`Запуск авто-викторины для сервера ${guild.guild_id}.`);

    const channel = await client.channels.fetch(guildSettings.random_quiz_channel).catch(() => null);
    if (!channel) {
        clientLogger.warn(`Канал ${guildSettings.random_quiz_channel} не найден. Авто-викторина пропущена.`);
        return;
    }

    const questionData = await fetchRandomQuestion();
    if (!questionData) return;

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
        .setTitle(question)
        .setDescription(`Ответить можно <t:${Math.floor(Date.now() / 1000) + 120}:R> или до первого правильного ответа.`)
        .setColor(questionDifficulty === 'easy' ? '#4F9D55' : questionDifficulty === 'medium' ? '#B7B120' : '#B44C4E')
        .setFooter({
            text: `1,5 очка за правильный ответ | ${getCategoryEmoji(questionCategory)} ${translatedCategory.text} | ${emojis.difficulty[questionDifficulty]} ${capitalizeFirstLetter(questionDifficulty)}`
                .replace('Easy', 'Легко')
                .replace('Medium', 'Средне')
                .replace('Hard', 'Сложно')
        });

    let message;
    try {
        message = await channel.send({
            content: guildSettings.rolePing ? `<@&${guildSettings.rolePing}>` : '',
            embeds: [embed],
            components: [createAnswerButtons(answerOptions)],
            allowedMentions: guildSettings.rolePing ? { roles: [guildSettings.rolePing], repliedUser: false } : { parse: [], repliedUser: false }
        });
    } catch (error) {
        clientLogger.error(`Не удалось отправить авто-викторину в канал ${guildSettings.random_quiz_channel}.`);
        clientLogger.error(error.stack || error);
        return;
    }

    const userAnswers = [];
    const collector = message.createMessageComponentCollector({
        filter: (interaction) => Boolean(findAnswerByCustomId(answerOptions, interaction.customId)),
        time: 120000
    });

    let correctlyAnswered = false;

    collector.on('collect', async (interaction) => {
        if (userAnswers.some((answer) => answer.userId === interaction.user.id)) {
            return interaction.reply({ content: '⚠️ Вы уже ответили на этот вопрос.', ephemeral: true });
        }

        const selectedAnswer = findAnswerByCustomId(answerOptions, interaction.customId);
        userAnswers.push({ userId: interaction.user.id, answer: selectedAnswer.answer });

        await interaction.reply({ content: `✅ Вы ответили: **${selectedAnswer.answer}**.`, ephemeral: true });

        const user = await getUser(interaction.user.id);
        if (!user) return;

        const points = recordQuizAnswer(user, {
            isCorrect: selectedAnswer.isCorrect,
            question,
            category: questionCategory,
            difficulty: questionDifficulty,
            multiplier: 1.5
        });

        await user.save();

        if (!selectedAnswer.isCorrect) return;

        correctlyAnswered = true;
        await message.edit({ embeds: [embed], components: [createAnswerButtons(answerOptions, true)] });
        await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`✨ ${interaction.member?.displayName || interaction.user.username} победил!`)
                    .setDescription(`Правильный ответ: **${correctAnswer}**\nНачислено очков: **${points}**`)
                    .setColor('#4F9D55')
            ]
        });

        collector.stop();
    });

    collector.on('end', async () => {
        if (correctlyAnswered) return;

        await message.edit({ embeds: [embed], components: [createAnswerButtons(answerOptions, true)] }).catch(() => null);
        await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`Правильный ответ: ${correctAnswer}`)
                    .setDescription('Никто не ответил правильно.')
                    .setColor('#b8493b')
            ]
        }).catch(() => null);
    });
}

async function scheduleRandomQuizzes(guildId = null) {
    const guilds = await guildModel.find({ random_quiz_interval: { $gt: 0 }, random_quiz_channel: { $ne: null } });
    const activeGuildIds = new Set(guilds.map((guild) => guild.guild_id));

    function clearTask(id) {
        const timer = scheduledQuizTasks.get(id);
        if (timer) clearInterval(timer);
        scheduledQuizTasks.delete(id);
    }

    function updateTask(guild) {
        clearTask(guild.guild_id);
        const intervalInMinutes = Number(guild.random_quiz_interval);
        if (!Number.isSafeInteger(intervalInMinutes) || intervalInMinutes <= 0) return;

        const timer = setInterval(() => {
            runRandomQuiz(guild).catch((error) => {
                clientLogger.error(`Ошибка авто-викторины для сервера ${guild.guild_id}.`);
                clientLogger.error(error.stack || error);
            });
        }, intervalInMinutes * 60 * 1000);

        scheduledQuizTasks.set(guild.guild_id, timer);
    }

    if (guildId) {
        const guild = guilds.find((item) => item.guild_id === guildId);
        if (!guild) {
            clearTask(guildId);
            return;
        }

        updateTask(guild);
        return;
    }

    for (const id of scheduledQuizTasks.keys()) {
        if (!activeGuildIds.has(id)) clearTask(id);
    }

    guilds.forEach(updateTask);
}

async function startBot() {
    logger.separator();
    logger.info('====== Информация ======');
    logger.info(`Процесс: ${process.pid}`);
    logger.info(`Node.js: ${process.version}`);
    logger.info(`Discord.js: ${require('discord.js').version}`);
    logger.info(`Mongoose: ${require('mongoose').version}`);
    logger.info(`Режим: ${process.env.DEV_MODE ? 'Development' : 'Production'}`);
    logger.info('========================');
    logger.separator();

    await connectMongo();
    startPremiumCleanupJob();

    client.scheduleRandomQuizzes = scheduleRandomQuizzes;

    clientLogger.info('Вход в Discord...');
    await client.login(getDiscordToken());
    clientLogger.success('Бот вошёл в Discord.');

    await latencyLogger(client);

    if (args.includes('--no-commands')) {
        clientLogger.warn('Загрузка команд пропущена.');
    } else {
        await require('./handlers/commands')(client);
    }

    await scheduleRandomQuizzes();
    setInterval(() => {
        scheduleRandomQuizzes().catch((error) => {
            clientLogger.error('Не удалось обновить расписание авто-викторин.');
            clientLogger.error(error.stack || error);
        });
    }, 60 * 60 * 1000);
}

process.on('unhandledRejection', (error) => {
    clientLogger.error('Необработанное отклонение Promise.');
    clientLogger.error(error.stack || error);
});

process.on('uncaughtException', (error) => {
    clientLogger.error('Неперехваченное исключение.');
    clientLogger.error(error.stack || error);
});

if (require.main === module) {
    startBot().catch(async (error) => {
        clientLogger.error('Не удалось запустить бота.');
        clientLogger.error(error.stack || error);
        await wait(100);
        process.exit(1);
    });
}

module.exports = { client, scheduleRandomQuizzes, runRandomQuiz, startBot };
