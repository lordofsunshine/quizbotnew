
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, TextInputBuilder, EmbedBuilder } = require('discord.js');
const addQuizButton = new ButtonBuilder()
    .setCustomId('addQuizButton')
    .setLabel('Добавить')
    .setStyle('Secondary');
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
client.on('interactionCreate', async (interaction) => {
    await interaction.showModal(addQuizButton);
    if (!interaction.isButton()) return;
    if (interaction.customId === 'addQuizButton') {
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
        await interaction.followUp({
            content: 'Введите информацию для установки викторины:',
            components: [setQuizModal],
        });
    }
});
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
        const quizEmbed = new EmbedBuilder()
            .setTitle(question)
            .setDescription([...wrongAnswers, correctAnswer].join('\n'))
            .setColor(quizColor)
            .setFooter(quizFooter);
        message.channel.send({ embeds: [quizEmbed] });
    }
});
