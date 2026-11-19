import { HttpException } from '@nestjs/common';
import { GraphQLFormattedError } from 'graphql';

const CODE_FOR_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
};

type ExceptionBody = { statusCode?: number; message?: string | string[] };

// The HTTP status and message of the exception a resolver threw, if any.
function thrown(
  formatted: GraphQLFormattedError,
  error: unknown,
): { status?: number; detail?: string } {
  const original = (error as { originalError?: unknown } | undefined)
    ?.originalError;
  const body: ExceptionBody | undefined =
    original instanceof HttpException
      ? (() => {
          const response = original.getResponse();
          const message =
            typeof response === 'string'
              ? response
              : (response as ExceptionBody).message;
          return { statusCode: original.getStatus(), message };
        })()
      : (formatted.extensions?.originalError as ExceptionBody | undefined);
  const detail = Array.isArray(body?.message)
    ? body.message.join('; ')
    : body?.message;
  return { status: body?.statusCode, detail };
}

/**
 * Gives GraphQL errors a code the web app can act on (NOT_FOUND, CONFLICT…)
 * and the plain message of expected errors. Outside local development it
 * drops everything else: stack traces, internal details and echoed input.
 */
export function formatGraphqlError(showDetails: boolean) {
  return (
    formatted: GraphQLFormattedError,
    error?: unknown,
  ): GraphQLFormattedError => {
    const { status, detail } = thrown(formatted, error);
    const code =
      (status && CODE_FOR_STATUS[status]) ?? formatted.extensions?.code;
    const message =
      status && status < 500 && detail ? detail : formatted.message;
    if (showDetails) {
      return {
        ...formatted,
        message,
        extensions: { ...formatted.extensions, code },
      };
    }
    return {
      message,
      locations: formatted.locations,
      path: formatted.path,
      extensions: { code, ...(status ? { status } : {}) },
    };
  };
}
