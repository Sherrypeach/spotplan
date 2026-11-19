import { databaseErrorCode } from '@core/filters/all-exceptions.filter';

describe('databaseErrorCode', () => {
  it('reads the code a database error carries', () => {
    const error = Object.assign(new Error('sorry, too many clients'), {
      code: '53300',
    });
    expect(databaseErrorCode(error)).toBe('53300');
  });

  it('ignores codes that are not database error codes', () => {
    expect(
      databaseErrorCode(Object.assign(new Error(), { code: 'ECONNRESET' })),
    ).toBeUndefined();
    expect(
      databaseErrorCode(Object.assign(new Error(), { code: 42 })),
    ).toBeUndefined();
    expect(databaseErrorCode(new Error())).toBeUndefined();
  });
});
