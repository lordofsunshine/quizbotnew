require('dotenv').config();

const fs = require('fs');
const { join } = require('path');
const { REST, Routes } = require('discord.js');
const { Logger } = require('../utils/logger');
const { getGuild } = require('../utils/quizUtils');
const { canManageAuction, getAuctionItemByInput, parseAuctionPrice } = require('../utils/auction');
const userModel = require('../models/userModel');

const commandsLogger = new Logger('cmds', true);

function getDiscordToken() {
    return process.env.DEV_MODE
        ? (process.env.DEV_TOKEN || process.env.TOKEN)
        : (process.env.TOKEN || process.env.DEV_TOKEN);
}

async function sendInteractionError(interaction, message) {
    const payload = { content: message, ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => null);
    return interaction.reply(payload).catch(() => null);
}

async function registerCommands(client, commands) {
    commandsLogger.info('Регистрация slash-команд...');

    try {
        const rest = new REST({ version: '10' }).setToken(getDiscordToken());
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        commandsLogger.success('Slash-команды успешно зарегистрированы.');
    } catch (error) {
        commandsLogger.error('Не удалось зарегистрировать slash-команды.');
        commandsLogger.error(error.stack || error);
    }
}

async function ensureManageAuctionAccess(interaction) {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (canManageAuction(member, interaction.guild)) return true;

    await sendInteractionError(interaction, '❌ Нет доступа. Нужны права администратора.');
    return false;
}

async function handleBuyAuction(interaction) {
    const guild = await getGuild(interaction.guild.id);
    if (!guild) return sendInteractionError(interaction, '❌ Не удалось загрузить настройки сервера.');

    let auctionItem;
    try {
        auctionItem = getAuctionItemByInput(guild.auction?.list || [], interaction.fields.getTextInputValue('roleNum')).item;
        auctionItem.price = parseAuctionPrice(auctionItem.price);
    } catch (error) {
        return sendInteractionError(interaction, `❌ ${error.message}`);
    }

    const role = await interaction.guild.roles.fetch(auctionItem.role).catch(() => null);
    if (!role) return sendInteractionError(interaction, '❌ Эта роль больше не существует на сервере.');

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) return sendInteractionError(interaction, '❌ Не удалось получить участника сервера.');
    if (member.roles.cache.has(role.id)) {
        return sendInteractionError(interaction, '❌ У вас уже есть эта роль.');
    }

    const updatedUser = await userModel.findOneAndUpdate(
        { user_id: interaction.user.id, points: { $gte: auctionItem.price } },
        { $inc: { points: -auctionItem.price } },
        { new: true }
    );

    if (!updatedUser) {
        return sendInteractionError(interaction, '❌ У вас недостаточно очков.');
    }

    try {
        await member.roles.add(role.id);
    } catch (error) {
        await userModel.updateOne({ user_id: interaction.user.id }, { $inc: { points: auctionItem.price } });
        return sendInteractionError(interaction, '❌ Не удалось выдать роль. Очки возвращены на баланс.');
    }

    return interaction.reply({ content: '✅ Роль успешно куплена.', ephemeral: true });
}

async function handleSetAuction(interaction) {
    if (!await ensureManageAuctionAccess(interaction)) return;

    const roleId = interaction.fields.getTextInputValue('id').trim();
    const description = interaction.fields.getTextInputValue('desc')?.trim() || null;
    let price;

    try {
        price = parseAuctionPrice(interaction.fields.getTextInputValue('price'));
    } catch (error) {
        return sendInteractionError(interaction, `❌ ${error.message}`);
    }

    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role || role.id === interaction.guild.id || role.managed) {
        return sendInteractionError(interaction, '❌ Укажите обычную роль, которая существует на сервере.');
    }

    const botMember = await interaction.guild.members.fetchMe().catch(() => null);
    if (!botMember || botMember.roles.highest.comparePositionTo(role) <= 0) {
        return sendInteractionError(interaction, '❌ Бот не сможет выдать эту роль: она находится выше или на одном уровне с ролью бота.');
    }

    const guild = await getGuild(interaction.guild.id);
    if (!guild) return sendInteractionError(interaction, '❌ Не удалось загрузить настройки сервера.');

    guild.auction.list.push({ role: role.id, price, description });
    await guild.save();

    return interaction.reply({ content: '✅ Товар добавлен в магазин.', ephemeral: true });
}

async function handleDeleteAuction(interaction) {
    if (!await ensureManageAuctionAccess(interaction)) return;

    const guild = await getGuild(interaction.guild.id);
    if (!guild) return sendInteractionError(interaction, '❌ Не удалось загрузить настройки сервера.');

    let index;
    try {
        index = getAuctionItemByInput(guild.auction?.list || [], interaction.fields.getTextInputValue('roleNum')).index;
    } catch (error) {
        return sendInteractionError(interaction, `❌ ${error.message}`);
    }

    guild.auction.list.splice(index, 1);
    await guild.save();

    return interaction.reply({ content: '✅ Товар удалён из магазина.', ephemeral: true });
}

async function handleModalSubmit(interaction) {
    if (interaction.customId === 'buyAuction') return handleBuyAuction(interaction);
    if (interaction.customId === 'setAuction') return handleSetAuction(interaction);
    if (interaction.customId === 'deleteAuction') return handleDeleteAuction(interaction);
}

module.exports = async (client) => {
    const commands = [];
    const commandFiles = fs.readdirSync(join(__dirname, '..', 'commands')).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(join(__dirname, '..', 'commands', file));
        if (!command?.data?.toJSON || typeof command.execute !== 'function') {
            commandsLogger.warn(`Файл ${file} пропущен: команда оформлена неполностью.`);
            continue;
        }

        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }

    await registerCommands(client, commands);

    commandsLogger.separator();
    commandsLogger.info(`Зарегистрировано slash-команд: ${commands.length}`);
    commandsLogger.separator();

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isCommand() || interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                if (interaction.isAutocomplete()) {
                    if (typeof command.autocomplete === 'function') {
                        await command.autocomplete(interaction, client);
                    }
                    return;
                }

                await command.execute(interaction, client);
            } catch (error) {
                commandsLogger.error(error.stack || error);
                await sendInteractionError(interaction, '❌ При выполнении команды произошла ошибка. Сообщите разработчику бота.');
            }

            return;
        }

        if (interaction.isModalSubmit()) {
            try {
                await handleModalSubmit(interaction);
            } catch (error) {
                commandsLogger.error(error.stack || error);
                await sendInteractionError(interaction, '❌ При обработке формы произошла ошибка.');
            }
        }
    });
};
