import { Logtail } from '@logtail/browser';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private logtail: Logtail | null = null;

  constructor() {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BETTERSTACK_TOKEN) {
      const endpoint = process.env.NEXT_PUBLIC_BETTERSTACK_INGESTION_URL || 's1460781.eu-nbg-2.betterstackdata.com';
      this.logtail = new Logtail(process.env.NEXT_PUBLIC_BETTERSTACK_TOKEN, {
        endpoint: `https://${endpoint}`
      });
    }
  }

  private formatMessage(level: string, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(context && { context }),
    };

    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
      console[level as keyof Console]?.(logEntry) || console.log(logEntry);
    }

    // Send to BetterStack if available
    if (this.logtail) {
      this.logtail[level as keyof Logtail]?.(message, context) || this.logtail.info(message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.formatMessage('error', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.formatMessage('debug', message, context);
  }

  log(message: string, context?: LogContext): void {
    this.info(message, context);
  }
}

export const logger = new Logger();