import pino from 'pino'
import { config } from './config.js'

export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  base: { servico: 'ceramix-api', ambiente: config.env },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'senha',
      '*.senha',
      '*.senha_hash',
      '*.refreshToken',
      '*.accessToken'
    ],
    censor: '[REDACTED]'
  },
  ...(config.env === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname,servico,ambiente'
          }
        }
      }
    : {})
})
