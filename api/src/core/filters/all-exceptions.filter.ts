import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';
import { Request, Response } from 'express';

/**
 * The database's five-character error code (e.g. 53300 = too many
 * connections). Safe to log: it names the kind of failure, never the values.
 */
export function databaseErrorCode(exception: unknown): string | undefined {
  const code = (exception as { code?: unknown }).code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)
    ? code
    : undefined;
}

/**
 * One place that shapes every error. Expected errors (HttpException) pass
 * through with their message. Anything else is logged with the method, path
 * and request id only — never headers, cookies, query strings or bodies — and
 * the caller gets a plain message with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() === 'graphql') {
      const { req, res } = GqlArgumentsHost.create(host).getContext<{
        req: Request;
        res: Response;
      }>();
      return this.toKnownError(exception, req, res);
    }

    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const error = this.toKnownError(exception, http.getRequest<Request>(), res);
    res.status(error.getStatus()).json({
      statusCode: error.getStatus(),
      message: error.message,
      requestId: res.locals.requestId as string | undefined,
    });
  }

  private toKnownError(exception: unknown, req: Request, res: Response) {
    if (exception instanceof HttpException) return exception;
    const bodyError = this.fromBodyParser(exception);
    if (bodyError) return bodyError;
    const requestId = res.locals.requestId as string | undefined;
    this.logger.error(
      `${req.method} ${req.path} failed (request ${requestId})`,
    );
    // Only the error type, its database code and where it happened: database
    // errors can quote the values involved in their message.
    if (exception instanceof Error) {
      const frames = exception.stack?.split('\n').slice(1, 6).join('\n') ?? '';
      const code = databaseErrorCode(exception);
      const name = code ? `${exception.name} (code ${code})` : exception.name;
      this.logger.error(`${name}\n${frames}`);
    }
    return new InternalServerErrorException(
      `Something went wrong. Reference: ${requestId ?? 'unknown'}`,
    );
  }

  // The JSON parser rejects bodies that are too large or unreadable before any
  // handler runs; pass those on as the client errors they are.
  private fromBodyParser(exception: unknown): HttpException | null {
    const error = exception as { status?: number; type?: string };
    if (typeof error?.status !== 'number' || typeof error.type !== 'string')
      return null;
    if (error.status === 413)
      return new PayloadTooLargeException('That request is too large.');
    if (error.status >= 400 && error.status < 500)
      return new BadRequestException('The request could not be read.');
    return null;
  }
}
