const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'http',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
    ),
    transports: [
        new transports.Console(),
        // TODO: Add file transports?
    ],
});

const morganStream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

module.exports = {logger, morganStream};
