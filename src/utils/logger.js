const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const colours = {
    PRIMARY: '#007bff',
    INFO: '#17a2b8',
    SUCCESS: '#28a745',
    WARNING: '#ffc107',
    ERROR: '#dc3545',
    DARK: '#343a40',
    WHITE: '#ffffff',
    BLACK: '#000000'
};

const typeColours = {
    WARNING: chalk.hex(colours.BLACK).bgHex(colours.WARNING).bold,
    ERROR: chalk.hex(colours.WHITE).bgHex(colours.ERROR).bold,
    SUCCESS: chalk.rgb(20, 20, 20).bgHex(colours.SUCCESS).bold,
    INFO: chalk.hex(colours.BLACK).bgHex(colours.INFO).bold,
    DATE: chalk.hex(colours.WHITE).bgHex(colours.DARK).bold,
    LOGGER: chalk.hex(colours.WHITE).bgHex(colours.DARK).bold
};

const loggers = [];
const movedLogs = [];

class Logger {
    constructor(name = '', silent = false) {
        this.logFileName = this.getFormattedFileName(name);
        this.logFilePath = path.join(__dirname, '../../logs/latest', this.logFileName);
        this.logTypes = ['WARNING', 'ERROR', 'SUCCESS', 'INFO'];
        this.maxLogTypeLength = this.getMaxLogTypeLength();
        this.name = name;
        this.silent = silent;

        this.ensureLogDirectory();
        loggers.push(this);

        if (!this.silent) {
            this.log('SUCCESS', `Логгер ${typeColours.LOGGER(this.name)} создан.`);
            this.log('INFO', `Файл журнала: ${this.logFilePath}`);
        }

        this.moveOldLatestLogs();
    }

    getFormattedFileName(name) {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
        return `${date}_${time}${name ? `_${name}` : ''}.log`;
    }

    getMaxLogTypeLength() {
        return this.logTypes.reduce((max, type) => Math.max(max, type.length), 0);
    }

    formatLogType(type) {
        const padding = ' '.repeat(this.maxLogTypeLength - type.length);
        return (` ${padding.slice(0, padding.length / 2)}${type}${padding.slice(padding.length / 2)} `).toUpperCase();
    }

    formatName(name) {
        const maxNameLength = loggers.reduce((max, logger) => Math.max(max, logger.name.length), 0);
        const padding = ' '.repeat(maxNameLength - name.length);
        return (` ${padding.slice(0, padding.length / 2)}${name}${padding.slice(padding.length / 2)} `).toUpperCase();
    }

    ensureLogDirectory() {
        fs.mkdirSync(path.join(__dirname, '../../logs/latest'), { recursive: true });
    }

    moveOldLatestLogs() {
        const latestLogDir = path.join(__dirname, '../../logs/latest');
        const logDir = path.join(__dirname, '../../logs');

        fs.readdir(latestLogDir, (err, files) => {
            if (err) {
                this.log('ERROR', `Не удалось прочитать каталог журналов: ${err.message}`);
                return;
            }

            files.forEach((file) => {
                if (movedLogs.includes(file)) return;
                if (file === this.logFileName) return;
                if (loggers.some((logger) => logger.logFileName === file)) return;

                fs.rename(path.join(latestLogDir, file), path.join(logDir, file), () => {
                    movedLogs.push(file);
                });
            });
        });
    }

    separator() {
        console.log();
        this.writeToFile('');
    }

    log(type, text) {
        if (!this.logTypes.includes(type)) {
            throw new Error(`Недопустимый тип журнала: ${type}`);
        }

        const date = new Date().toLocaleString('ru-RU', { month: 'short', day: 'numeric' }).toUpperCase();
        const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
        const formattedName = this.formatName(this.name);

        console.log(
            typeColours.LOGGER(` ${formattedName} `)
            + ' '
            + typeColours.DATE(` ${date} | `)
            + typeColours.DATE(`${timestamp} `)
            + ' '
            + typeColours[type](this.formatLogType(type))
            + ` ${text}`
        );

        this.writeToFile(`[${date} | ${timestamp}] ${this.formatLogType(type)} | ${text}`);
    }

    writeToFile(log) {
        fs.appendFile(this.logFilePath, `${log}\n`, (err) => {
            if (err) console.error(typeColours.ERROR(`[ERROR] | ${err.message}`));
        });
    }

    warn(text) {
        this.log('WARNING', text);
    }

    error(text) {
        this.log('ERROR', text);
    }

    success(text) {
        this.log('SUCCESS', text);
    }

    info(text) {
        this.log('INFO', text);
    }
}

const systemLogger = new Logger('logger', false);
const logger = new Logger('main');
let terminated = false;

function processKilled(reason) {
    if (terminated) return;
    terminated = true;

    systemLogger.separator();
    systemLogger.log('ERROR', `Процесс завершён. Причина: ${reason}`);
    loggers.forEach((activeLogger) => {
        activeLogger.log('INFO', `Файл журнала: ${activeLogger.logFilePath}`);
    });

    process.exit(0);
}

['SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGPIPE', 'SIGHUP', 'SIGINT', 'SIGBREAK'].forEach((event) => {
    process.on(event, () => processKilled(event));
});

module.exports = { Logger, logger };
