require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Logger } = require('./logger');

const migrationLogger = new Logger('migration');
const configPath = path.join(__dirname, '../../config.json');
const exampleConfigPath = path.join(__dirname, '../../config.example.json');
const newConfigPath = path.join(__dirname, '../../newConfig.json');

async function ensureConfigExists() {
    if (fs.existsSync(configPath)) {
        migrationLogger.success('config.json найден.');
        return;
    }

    if (!fs.existsSync(exampleConfigPath)) {
        throw new Error('config.json отсутствует, а config.example.json не найден.');
    }

    fs.copyFileSync(exampleConfigPath, configPath);
    migrationLogger.warn('config.json создан из config.example.json.');
}

function migrateEnvValues(config) {
    const mappings = {
        CLIENT_ID: ['bot', 'botId'],
        DEV_CLIENT_ID: ['bot', 'devBotId'],
        BOT_NAME: ['bot', 'name'],
        BOT_INVITE: ['links', 'invite'],
        BOT_SUPPORT: ['links', 'support']
    };

    for (const [envName, [section, key]] of Object.entries(mappings)) {
        if (!process.env[envName]) continue;
        config[section][key] = process.env[envName];
        migrationLogger.success(`${envName} перенесён в config.json.`);
    }
}

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    await ensureConfigExists();

    migrationLogger.info('Перенос значений из .env в config.json...');
    const config = require(configPath);
    migrateEnvValues(config);

    fs.writeFileSync(newConfigPath, JSON.stringify(config, null, 2), 'utf8');
    migrationLogger.info(`Новый файл конфигурации сохранён: ${newConfigPath}`);

    const answer = await ask('Перезаписать текущий config.json новым файлом? (y/N) ');
    if (answer.toLowerCase() === 'y') {
        fs.copyFileSync(newConfigPath, configPath);
        fs.unlinkSync(newConfigPath);
        migrationLogger.success('config.json обновлён.');
    } else {
        migrationLogger.warn('config.json не был изменён. Проверьте newConfig.json вручную.');
    }

    migrationLogger.info('Миграция завершена.');
}

main().catch((error) => {
    migrationLogger.error('Миграция завершилась с ошибкой.');
    migrationLogger.error(error.stack || error);
    process.exit(1);
});
