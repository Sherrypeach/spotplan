import { formatGraphqlError } from '@core/graphql/format-error';

const notFound = {
  message: 'Not Found Exception',
  path: ['classroom'],
  extensions: {
    code: 'INTERNAL_SERVER_ERROR',
    stacktrace: ['at secret/path.ts:1'],
    originalError: { statusCode: 404, message: 'Class not found' },
  },
};

describe('formatGraphqlError', () => {
  it('gives a not-found error its code and plain message, without internals', () => {
    expect(formatGraphqlError(false)(notFound)).toEqual({
      message: 'Class not found',
      locations: undefined,
      path: ['classroom'],
      extensions: { code: 'NOT_FOUND', status: 404 },
    });
  });

  it('keeps details on a local machine', () => {
    const local = formatGraphqlError(true)(notFound);
    expect(local.extensions?.stacktrace).toBeDefined();
    expect(local.extensions?.code).toBe('NOT_FOUND');
  });

  it("doesn't pass on the message of an unexpected error", () => {
    const crash = {
      message: 'Something went wrong. Reference: abc',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
    expect(formatGraphqlError(false)(crash).message).toBe(
      'Something went wrong. Reference: abc',
    );
  });
});

describe('formatGraphqlError with the thrown exception', () => {
  it('reads the status of a plain HttpException', () => {
    const { HttpException } =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
    const formatted = {
      message: 'Too many attempts.',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
    const result = formatGraphqlError(false)(formatted, {
      originalError: new HttpException('Too many attempts.', 429),
    });
    expect(result.extensions).toEqual({
      code: 'TOO_MANY_REQUESTS',
      status: 429,
    });
  });
});
