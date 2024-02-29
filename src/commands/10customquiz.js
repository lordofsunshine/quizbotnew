const { SlashCommandBuilder } = require('@discordjs/builders');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, MessageInput, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Создаем кнопку "Добавить"
const addQuizButton = new ButtonBuilder()
    .setCustomId('addQuizButton')
    .setLabel('Добавить')
    .setStyle('Secondary');

// Создаем строку с кнопкой
const mainMenuRow = new ActionRowBuilder().addComponents(addQuizButton);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ccc')
        .setDescription('ccc'),

    async execute(interaction) {
        // Отправляем сообщение с кнопкой
        await interaction.reply({
            content: 'Главное меню:',
            components: [mainMenuRow],
        });
    },
};

// Обработчик события 'interactionCreate' для кнопки
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'addQuizButton') {
        const setQuizModal = new ActionRowBuilder()
            .addComponents(
                new MessageInput()
                    .setCustomId('question')
                    .setLabel('Вопрос')
                    .setPlaceholder('Введите вопрос'),
                new MessageInput()
                    .setCustomId('wrongAnswers')
                    .setLabel('3 неправильных ответа')
                    .setPlaceholder('Введите неправильные ответы, разделенные запятой'),
                new MessageInput()
                    .setCustomId('correctAnswer')
                    .setLabel('1 правильный ответ')
                    .setPlaceholder('Введите правильный ответ'),
                new MessageInput()
                    .setCustomId('quizColor')
                    .setLabel('Цвет викторины')
                    .setPlaceholder('Введите цвет в формате HEX'),
                new MessageInput()
                    .setCustomId('quizFooter')
                    .setLabel('Подзаголовок (footer)')
                    .setPlaceholder('Введите подзаголовок'),
                new MessageInput()
                    .setCustomId('quizTime')
                    .setLabel('Время окончания викторины')
                    .setPlaceholder('Введите время в часах (макс. 24)')
            );

        await interaction.followUp({
            content: 'Введите информацию для установки викторины:',
            components: [setQuizModal],
        });
    }
});

// Функция для задержки с использованием промисов
function setTimeoutPromise(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isPrivateMessage = message.guild === null;
    const isQuizChannel = message.channel.type === 'dm' && isPrivateMessage;

    if (isQuizChannel) {
        const question = interaction.message.components[0].components[0].value;
        const wrongAnswers = interaction.message.components[0].components[1].value.split(',');
        const correctAnswer = interaction.message.components[0].components[2].value;
        const quizColor = interaction.message.components[0].components[3].value;
        const quizFooter = interaction.message.components[0].components[4].value;
        const quizTime = interaction.message.components[0].components[5].value * 3600000; // Переводим часы в миллисекунды

        // Пример: отправка викторины через указанное пользователем время
        await setTimeoutPromise(quizTime);

        // Логика отправки викторины
        const quizEmbed = new EmbedBuilder()
            .setTitle(question)
            .setDescription([...wrongAnswers, correctAnswer].join('\n'))
            .setColor(quizColor)
            .setFooter(quizFooter);

        message.channel.send({ embeds: [quizEmbed] });
    }
});
