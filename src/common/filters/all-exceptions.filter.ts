import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

interface NormalisedError {
  status: number;
  error: string;
  message: string | string[];
}

const PRISMA_ERROR_STATUS: Record<string, NormalisedError> = {
  P2002: { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'Record already exists' },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    message: 'Referenced record does not exist',
  },
  P2025: { status: HttpStatus.NOT_FOUND, error: 'Not Found', message: 'Record not found' },
};

const SERVER_ERROR_THRESHOLD: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const normalised = this.normalise(exception);

    if (normalised.status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      statusCode: normalised.status,
      error: normalised.error,
      message: normalised.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(normalised.status).json(body);
  }

  private normalise(exception: unknown): NormalisedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { status, error: exception.name, message: payload };
      }

      const record = payload as { message?: string | string[]; error?: string };

      return {
        status,
        error: record.error ?? exception.name,
        message: record.message ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_STATUS[exception.code];

      if (mapped) {
        return mapped;
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Invalid request' };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    };
  }
}
