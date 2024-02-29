require('dotenv').config();

const { Client, GatewayIntentBits, Collection, EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const { logger, Logger } = require('./utils/logger');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const guildModel = require('./models/guildModel.js');
const cron = require('node-cron');
const { CronJob } = require('cron');
const chalk = require('chalk');
const translate = require('@iamtraction/google-translate');
const { fetchRandomQuestion } = require('./utils/quizUtils.js');
const { getCategoryEmoji, capitalizeFirstLetter } = require('./utils/misc.js');
const { shuffleArray, createAnswerButtons, awardPoints, getUser } = require('./utils/quizUtils');
const { emojis } = require('./misc.js');
const { latencyLogger } = require('./utils/latencyLogger.js');
const wait = require('node:timers/promises').setTimeout;
const arguments = process.argv.slice(2);
const Guild = '';  // NOTE: You have an uninitialized variable, make sure it's not required

logger.separator();
logger.info('====== Информация ======');
logger.info(`Процесс: ${process.pid}`);
logger.info(`Ноде версия: ${process.version}`);
logger.info(`Discord.js версия: ${require('discord.js').version}`);
logger.info(`Mongoose версия: ${require('mongoose').version}`);
logger.info(`Значение: ${process.env.DEV_MODE ? 'Development' : 'Production'}`);
logger.info('=================================');
logger.separator();

const clientLogger = new Logger('client', false);
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: true },
});

client.commands = new Collection();
client.buttons = new Collection();
client.aliases = new Collection();

clientLogger.info('Подключение к MongoDB...');
mongoose
    .connect(`${process.env.MONGO_URL}`)
    .then(() => {
        clientLogger.success('Подключен к базе данных MongoDB');
    })
    .catch((err) => {
        clientLogger.error(`Не удалось подключиться к базе данных MongoDB, причина: ${err}`);
    });

// ==================== //

try {
    let job = new CronJob('0 0 0 */30 * *', async function () {
        let guilds = await guildModel.find();
        guilds
            .filter((a) => a.premium.enabled === true)
            .map(async (x) => {
                if (x.premium.time < Date.now() && x.premium.enabled === true) {
                    let s = await guildModel.findOne({ guild_id: x.guild_id });
                    s.premium.enabled = false;
                    s.premium.time = 0;
                    s.save();
                }
            });
    }, null, true, 'Europe/Moscow');
    job.start();
} catch (err) {
    console.log('ad', err.stack);
}

async function runRandomQuiz(guild) {
    const newGuild = await guildModel.findOne({ guild_id: guild.guild_id });
    if (newGuild.random_quiz_interval <= 0 || !newGuild.random_quiz_channel) return;
    clientLogger.info(`Начинаем викторину для гильдии ${guild.guild_id}...`);

    // Get the channel
    const channel = await client.channels.fetch(guild.random_quiz_channel);
    if (!channel) return clientLogger.warn(`Канал ${guild.random_quiz_channel} не существует, пропускаем...`);

    // Send the first question
    let {
        question,
        difficulty: questionDifficulty,
        correct_answer: correctAnswer,
        incorrect_answers: inAnswers,
        category: questionCategory,
    } = await fetchRandomQuestion();
    if (!question) return;
    let texted = await translate(question, { to: 'ru' });
    let texted2 = await translate(correctAnswer, { to: 'ru' });

    question = texted.text;
    correctAnswer = texted2.text;
    let incorrectAnswers = [];
    inAnswers.map(async (x) => {
        let ans = await translate(x, { to: 'ru' });
        incorrectAnswers.push(ans.text);
    });
    let cat = await translate(questionCategory, { to: 'ru' });
    let categoryQuest = cat.text;
    await wait(4000);

    let allAnswers = [correctAnswer, ...incorrectAnswers];
    allAnswers = shuffleArray(allAnswers);
    allAnswers = allAnswers.map((answer) => decodeURI(answer));

    const embed = new EmbedBuilder()
        .setTitle(decodeURI(question))
        .setDescription(`Ответ через <t:${Math.floor(Date.now() / 1000) + 120}:R> или когда кто-то ответит правильно. `)
        .setColor(
            questionDifficulty === 'easy' ? '#4F9D55' : questionDifficulty === 'medium' ? '#B7B120' : '#B44C4E'
        )
        .setFooter({
            text: `1,5 очка за правильный ответ | ${getCategoryEmoji(questionCategory)} ${categoryQuest} | ${
                emojis.difficulty[questionDifficulty]
            } ${capitalizeFirstLetter(questionDifficulty)}`.replace('Easy', 'Легко').replace('Medium', 'Средне').replace('Hard', 'Тяжело'),
        });

    const buttons = createAnswerButtons(allAnswers, correctAnswer);
    let message;

    try {
        message = await channel.send({
            content: newGuild.rolePing ? `<@&${newGuild.rolePing}>` : '',
            embeds: [embed],
            components: [buttons],
            allowedMentions: { parse: ['roles'], repliedUser: false },
        });
    } catch (error) {
        clientLogger.error(`❌ Не удалось отправить сообщение по каналу ${guild.random_quiz_channel}`);
        clientLogger.error(error);
        return;
    }

    // Collect answers
    const userAnswers = [];
    const filter = (i) => {
        return i.customId === correctAnswer || incorrectAnswers.includes(i.customId);
    };

    const collector = message.createMessageComponentCollector({ filter, time: 120000 });
    let correctlyAnswered = false;

    // End the quiz when a user is correct
    collector.on('collect', async (i) => {
        // Check if the user has already answered
        if (userAnswers.some((answer) => answer.userId === i.user.id))
            return i.reply({
                content: '⚠️ Вы уже ответили на этот вопрос.',
                ephemeral: true,
            });
        await i.reply({ content: '✅ Вы ответили **' + i.customId + '**', ephemeral: true });

        // Add the user to the list of users who answered correctly
        userAnswers.push({ userId: i.user.id, answer: i.customId });

        // Award points to the user
        await awardPoints(questionDifficulty, i.user.id, 1.5);

        // Check if the user has already answered this question
        const user = await getUser(i.user.id);
        if (i.customId === correctAnswer) {
            correctlyAnswered = true;

            // Remove all buttons
            const newButtons = createAnswerButtons(allAnswers, correctAnswer, true);
            await message.edit({ embeds: [embed], components: [newButtons] });

            // Send the result embed, saying that the user won
            const resultEmbed = new EmbedBuilder()
                .setTitle(`✨ ${i.user.displayName} выиграл!`)
                .setDescription(`Правильный ответ: **${correctAnswer}**`)
                .setColor('#4F9D55');

            await message.reply({ embeds: [resultEmbed] });
            collector.stop();
        } else {
            user.correct_answers.push({ question, amountOfTimes: 1, category: questionCategory });
        }
        await user.save();
    });

    // End the quiz when the time is up
    collector.on('end', async (collected) => {
        if (correctlyAnswered) return;

        // Remove all buttons
        const newButtons = createAnswerButtons(allAnswers, correctAnswer, true);
        await message.edit({ embeds: [embed], components: [newButtons] });

        const resultEmbed = new EmbedBuilder()
            .setTitle(`Правильным ответом было ${correctAnswer}`)
            .setDescription(`Никто не ответил правильно.`)
            .setColor('#b8493b');

        await message.reply({ embeds: [resultEmbed] });
    });
}

async function scheduleRandomQuizzes(guildId = null) {
    const guilds = await guildModel.find({ random_quiz_interval: { $gt: 0 } });
    const scheduledTasks = new Map();

    async function updateTask(guild) {
        let ch = 0;
        const intervalInMinutes = guild.random_quiz_interval;
        const currentGuildId = guild.guild_id;

        // Check if a task for this guild already exists and destroy it
        if (scheduledTasks.has(currentGuildId)) scheduledTasks.get(currentGuildId).destroy();

        // Create new cron job to run the quiz
        const task = cron.schedule(`*/${intervalInMinutes} * * * *`, async () => {
            if (ch === 3) {
                setTimeout(async () => {
                    await runRandomQuiz(guild);
                }, 60000);
                ch = 0;
            } else {
                ch++;
                await runRandomQuiz(guild);
            }
        });

        scheduledTasks.set(currentGuildId, task);
    }

    // Create, update scheduled tasks for each guild
    if (guildId) {
        const guild = guilds.find((g) => g.guild_id === guildId);
        if (!guild) return clientLogger.warn(`Guild ${guildId} not found, skipping...`);
        await updateTask(guild);
    } else {
        const shuffledGuilds = guilds.slice(); // Create a copy of the array
        for (let i = shuffledGuilds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledGuilds[i], shuffledGuilds[j]] = [shuffledGuilds[j], shuffledGuilds[i]];
        }

        shuffledGuilds.forEach((guild, index) => {
            setTimeout(() => {
                updateTask(guild);
            }, index * 10000); // Adjust the timeout interval as needed
        });
    }

    // Handle guilds that no longer have scheduled tasks (e.g., when interval is set to 0) or ones with multiple tasks
    scheduledTasks.forEach((task, guildId) => {
        if (!guilds.some((guild) => guild.guild_id === guildId)) {
            task.destroy();
            scheduledTasks.delete(guildId);
        }

        if (guilds.filter((guild) => guild.guild_id === guildId).length > 1) {
            task.destroy();
            scheduledTasks.delete(guildId);
            updateTask(guilds.find((guild) => guild.guild_id === guildId));
        }
    });
}

async function getHelp(client, interaction, queriedCommand = null) {
    let page = 0;
    let data = [];
    const { commands } = client;
    let cmds = [];
    if (queriedCommand) {
        const command = commands.get(queriedCommand);
        if (!command)
            return await interaction.reply({ content: '❌ Это недопустимая команда!', ephemeral: true });

        data.push(`## ${command.data.name}`);
        data.push(`**Описание** ${command.data.description}`);
        data.push(`**Использование** \`${command.data.name}${
            command.data.options ? command.data.options.map((option) => ` <${option.name}>`) : ''
        }\``);

        if (command.data.options) {
            data.push('### Аргументы');

            for (const option of command.data.options) {
                data.push(`- **${option.name}** ${option.description}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🔍 Помощь')
            .setDescription(data.join('\n'))
            .setColor('#f3ae6d');

        if (interaction.deferred) await interaction.followUp({ embeds: [embed], ephemeral: true });
        else await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
        commands.map((cmd, i) => {
            if (i === undefined) {
            } else {
                if (data.length === 5) {
                    cmds.push(data);
                    data = [];
                }
                data.push(
                    `- **${cmd.data.name}** - ${cmd.data.description}\n– **Использование** \`${cmd.data.name}${
                        cmd.data.options ? cmd.data.options.map((option) => ` <${option.name}>`) : ''
                    }\``
                );
            }
        });
        cmds.push(data);

        const embed = new EmbedBuilder()
            .setTitle('🔍 Помощь')
            .setDescription(
                `Все мои команды:\n${cmds[0].join('\n')}\n\n❔ Вы можете отправить \`/help [название команды]\`, чтобы получить больше информации о конкретной команде!`
            )
            .setColor('#f3ae6d')
            .setFooter({ text: `Страница №${page + 1}` });

        async function dd(msg) {
            let collector = msg.createMessageComponentCollector((b) => b, { componentType: 'BUTTON' });
            collector.on('collect', async (b) => {
                if (b.customId === 'back') {
                    b.deferUpdate();
                    page = page > 0 ? --page : cmds.length - 1;
                    msg.edit({ embeds: [embed.setDescription(cmds[page].join('\n')).setFooter({ text: `Страница №${page + 1}` })] });
                } else if (b.customId === 'next') {
                    b.deferUpdate();
                    page = page + 1 < cmds.length ? ++page : 0;

                    msg.edit({ embeds: [embed.setDescription(cmds[page].join('\n')).setFooter({ text: `Страница №${page + 1}` })] });
                }
            });
        }
        let bb1 = new ButtonBuilder().setCustomId('back').setLabel('Назад').setStyle('Secondary');
        let bb2 = new ButtonBuilder().setCustomId('next').setLabel('Вперед').setStyle('Secondary');
        let rr = new ActionRowBuilder().addComponents(bb1, bb2);

        if (interaction.deferred)
            await interaction.followUp({ embeds: [embed], ephemeral: true, components: [rr] }).then((x) => dd(x));
        else await interaction.reply({ embeds: [embed], ephemeral: true, components: [rr] }).then((x) => dd(x));
    }
}

// ==================== //

// Load commands and buttons
async function loadCommands(dir = './src/commands') {
    clientLogger.info(`Загрузка команд из ${dir}...`);
    const commandFiles = fs.readdirSync(path.join(__dirname, '..', dir)).filter((file) => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(__dirname, '..', dir, file));
        client.commands.set(command.name, command);
        clientLogger.success(`Загруженная команда ${chalk.bold(command.data.name)}`);
    }
}

async function loadButtons(dir = './src/buttons') {
    clientLogger.info(`Загрузка кнопок из ${dir}...`);
    const buttonFiles = fs.readdirSync(path.join(__dirname, '..', dir)).filter((file) => file.endsWith('.js'));
    for (const file of buttonFiles) {
        const button = require(path.join(__dirname, '..', dir, file));
        client.buttons.set(button.name, button);
        clientLogger.success(`Загруженная кнопка ${button.name}`);
    }
}

// ==================== //

// Login to Discord
clientLogger.info('Вход в Discord...');
client
    .login(process.env.DEV_MODE ? process.env.TOKEN : process.env.DEV_TOKEN)
    .then(async () => {
        clientLogger.success('Вошел в Discord');
        await latencyLogger(client);

        // Load commands and buttons, if the appropriate directory exists

        // If arg --no-commands is passed, don't load commands
        if (arguments.includes('--no-commands')) clientLogger.warn('Пропуск команд загрузки');
        else if (fs.existsSync(path.join(__dirname, './commands/'))) {
            await loadCommands();
            await require('./handlers/commands')(client);
        } else clientLogger.warn('Пропуск загрузки команд из-за отсутствия каталога команд');

        // If arg --no-buttons is passed, don't load buttons
        if (arguments.includes('--no-buttons')) clientLogger.warn('Пропуск кнопок загрузки');
        else if (fs.existsSync(path.join(__dirname, './buttons/'))) {
            await loadButtons();
            await require('./handlers/buttons')(client);
        } else clientLogger.warn('Пропуск загрузки кнопок, так как нет каталога кнопок');

        await scheduleRandomQuizzes(); // Schedule random quizzes
        setInterval(scheduleRandomQuizzes, 60 * 60 * 1000); // Update scheduled quizzes every hour
    })
    .catch((err) => {
        clientLogger.error('Не удалось войти в Discord');
        clientLogger.error(err.stack);
    });

// ==================== //

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    clientLogger.error('(Необработанный отказ) Unhandled rejection');
    clientLogger.error(err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    clientLogger.error('(Неперехваченное исключение) Uncaught exception');
    clientLogger.error(err.stack);
});

module.exports = { scheduleRandomQuizzes, getHelp };
