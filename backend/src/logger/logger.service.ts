import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    const transports: winston.transport[] = [
      new winston.transports.File({
        filename: '/app/logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      }),
      new winston.transports.File({
        filename: '/app/logs/combined.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            const ctx = context ? `[${context}] ` : '';
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level}: ${ctx}${message}${metaStr}`;
          })
        ),
      }),
    ];

    // Add BetterStack transport if token is provided
    if (process.env.BETTERSTACK_TOKEN) {
      console.log('🚀 BetterStack token found:', process.env.BETTERSTACK_TOKEN.substring(0, 8) + '...');
      try {
        const endpoint = process.env.BETTERSTACK_INGESTION_URL || 's1460746.eu-nbg-2.betterstackdata.com';
        const logtail = new Logtail(process.env.BETTERSTACK_TOKEN, {
          endpoint: `https://${endpoint}`
        });
        transports.push(new LogtailTransport(logtail));
        console.log('✅ BetterStack transport added to Winston logger');
      } catch (error) {
        console.error('❌ Error initializing BetterStack transport:', error.message);
      }
    } else {
      console.log('⚠️  No BetterStack token found, skipping BetterStack transport');
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports,
    });
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, { context });
  }
}