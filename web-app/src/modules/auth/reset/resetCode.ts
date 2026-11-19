export const CODE_LENGTH = 6;

/** Keeps only digits, so a pasted "123 456" still works. */
export function cleanCode(typed: string): string {
  return typed.replace(/\D/g, '').slice(0, CODE_LENGTH);
}
