import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorBody = {
  error?: string;
  message?: string | string[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const details: ErrorBody = typeof body === 'object' && body !== null ? body as ErrorBody : {};
    const requestId = response.getHeader('X-Request-Id');

    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${request.method} ${request.originalUrl} failed requestId=${String(requestId ?? '')}`,
        error.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error: details.error ?? (status >= 500 ? 'Internal Server Error' : 'Request Failed'),
      message: status >= 500
        ? 'Internal server error'
        : details.message ?? (typeof body === 'string' ? body : 'Request failed'),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: requestId ? String(requestId) : undefined,
    });
  }
}
