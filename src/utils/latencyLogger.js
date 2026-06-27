const { REST, Routes } = require('discord.js');
const { Logger } = require('./logger');

const latencyData = { history: [] };

function getDiscordToken() {
    return process.env.DEV_MODE
        ? (process.env.DEV_TOKEN || process.env.TOKEN)
        : (process.env.TOKEN || process.env.DEV_TOKEN);
}

async function latencyLogger(client) {
    const latencyLoggerInstance = new Logger('latency', true);
    const rest = new REST({ version: '10' }).setToken(getDiscordToken());

    setInterval(async () => {
        try {
            const timeNow = Date.now();
            await rest.get(Routes.applicationCommands(client.user.id));
            const latency = Date.now() - timeNow;
            const apiLatency = Math.max(0, Math.round(client.ws.ping));

            latencyData.history.push({ time: timeNow, latency, apiLatency });
            if (latencyData.history.length > 1000) latencyData.history.shift();
        } catch (error) {
            latencyLoggerInstance.error('Не удалось получить задержку Discord API.');
            latencyLoggerInstance.error(error.stack || error);
        }
    }, 30000);
}

module.exports = { latencyLogger, latencyData };
