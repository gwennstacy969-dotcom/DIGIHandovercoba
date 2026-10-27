const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        ({ level, message, timestamp, stack }) => `${timestamp} ${level}: ${message} ${stack ? '\n' + stack : ''}`
      )
    )
  }),
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '14d'
  }),
  new DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d'
  })
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format,
  transports
});

// Create a stream object for Morgan integration with sensitive data redaction
logger.stream = {
  write: function (message) {
    if (!message) return;
    // Redact tokens, secrets, and passwords from logged URL strings or messages
    const sanitized = String(message)
      .replace(/([?&](?:token|password|secret|refreshToken)=)[^&\s"]+/gi, '$1[REDACTED]')
      .replace(/("password"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
      .replace(/("token"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
      .replace(/("refreshToken"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"');
    logger.info(sanitized.trim());
  },
};

module.exports = logger;
