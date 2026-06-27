const fs = require('fs');
const { join } = require('path');
const { Logger } = require('../utils/logger');

const eventsLogger = new Logger('events', true);

async function registerEvents(client) {
    const eventsDir = join(__dirname, '..', 'events');
    if (!fs.existsSync(eventsDir)) {
        eventsLogger.warn('Каталог событий не найден. Загрузка событий пропущена.');
        return;
    }

    eventsLogger.info('Регистрация событий...');

    const eventFiles = fs.readdirSync(eventsDir).filter((file) => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(join(eventsDir, file));
        if (!event?.name || typeof event.execute !== 'function') {
            eventsLogger.warn(`Файл ${file} пропущен: событие оформлено неполностью.`);
            continue;
        }

        if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
        else client.on(event.name, (...args) => event.execute(...args, client));

        eventsLogger.info(`Событие ${event.name} зарегистрировано.`);
    }

    eventsLogger.success('Регистрация событий завершена.');
}

module.exports = async (client) => {
    await registerEvents(client);
};
