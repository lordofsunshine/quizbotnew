const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, TextInputBuilder, EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: true }
});

    data: new SlashCommandBuilder()
        .setName('ссс')
        .setDescription('ссс'),
        
const addQuizButton = new ButtonBuilder()
    .setCustomId('addQuizButton')
    .setLabel('Добавить')
    .setStyle('Secondary');

const mainMenuRow = new ActionRowBuilder().addComponents(addQuizButton);

const setQuizModal = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('question')
            .setLabel('Вопрос')
            .setPlaceholder('Введите вопрос'),
        new TextInputBuilder()
            .setCustomId('wrongAnswers')
            .setLabel('3 неправильных ответа')
            .setPlaceholder('Введите неправильные ответы, разделенные запятой'),
        new TextInputBuilder()
            .setCustomId('correctAnswer')
            .setLabel('1 правильный ответ')
            .setPlaceholder('Введите правильный ответ'),
        new TextInputBuilder()
            .setCustomId('quizColor')
            .setLabel('Цвет викторины')
            .setPlaceholder('Введите цвет в формате HEX'),
        new TextInputBuilder()
            .setCustomId('quizFooter')
            .setLabel('Подзаголовок (footer)')
            .setPlaceholder('Введите подзаголовок')
    );

client.on('interactionCreate', async (interaction) => {
    await interaction.reply({
        content: 'Главное меню:',
        components: [mainMenuRow],
    });

    if (!interaction.isButton()) return;

    if (interaction.customId === 'addQuizButton') {
        await interaction.followUp({
            content: 'Введите информацию для установки викторины:',
            components: [setQuizModal],
        });
    }
});

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

        const quizEmbed = new EmbedBuilder()
            .setTitle(question)
            .setDescription([...wrongAnswers, correctAnswer].join('\n'))
            .setColor(quizColor)
            .setFooter(quizFooter);

        message.channel.send({ embeds: [quizEmbed] });
    }
});
