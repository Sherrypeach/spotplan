import { BadRequestException } from '@nestjs/common';

// Field checks for the classroom document. Each returns the clean value or
// throws a 400 naming the field, never echoing what was sent.

const ID = /^[A-Za-z0-9_-]{1,40}$/;
// Ids that would clash with built-in object properties.
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

export function fail(message: string): never {
  throw new BadRequestException(`Invalid class data: ${message}`);
}

export function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function list(value: unknown, max: number, what: string): unknown[] {
  if (!Array.isArray(value)) fail(`${what} must be a list`);
  if (value.length > max) fail(`too many ${what}`);
  return value;
}

export function number(
  value: unknown,
  min: number,
  max: number,
  what: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    fail(`${what} is out of range`);
  }
  return value;
}

export function integer(
  value: unknown,
  min: number,
  max: number,
  what: string,
): number {
  const n = number(value, min, max, what);
  if (!Number.isInteger(n)) fail(`${what} must be a whole number`);
  return n;
}

export function bool(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') fail(`${what} must be true or false`);
  return value;
}

export function id(value: unknown, what: string): string {
  if (typeof value !== 'string' || !ID.test(value) || RESERVED_IDS.has(value)) {
    fail(`${what} is not a valid id`);
  }
  return value;
}

/**
 * Removes what Postgres can't keep in a JSON column, or that only comes from
 * broken files: control characters (other than tab and line breaks) and half
 * of an emoji on its own.
 */
export function storableText(value: string): string {
  let clean = '';
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    const control =
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      code === 0x7f;
    const high = code >= 0xd800 && code <= 0xdbff;
    const low = code >= 0xdc00 && code <= 0xdfff;
    const next = value.charCodeAt(index + 1);
    const previous = value.charCodeAt(index - 1);
    const loneHigh = high && !(next >= 0xdc00 && next <= 0xdfff);
    const loneLow = low && !(previous >= 0xd800 && previous <= 0xdbff);
    if (!control && !loneHigh && !loneLow) clean += value[index];
  }
  return clean;
}

export function text(
  value: unknown,
  max: number,
  what: string,
  options: { required?: boolean } = {},
): string {
  if (typeof value !== 'string') fail(`${what} must be text`);
  const trimmed = storableText(value).trim();
  if (trimmed.length > max) fail(`${what} is too long`);
  if (options.required && trimmed.length === 0) fail(`${what} is empty`);
  return trimmed;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  what: string,
): T {
  if (
    typeof value !== 'string' ||
    !(allowed as readonly string[]).includes(value)
  )
    fail(`unknown ${what}`);
  return value as T;
}

export function isoDate(value: unknown, what: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
    fail(`${what} is not a date`);
  return new Date(value).toISOString();
}

export function assertUnique(ids: string[], what: string): void {
  if (new Set(ids).size !== ids.length) fail(`duplicate ${what} ids`);
}

// An object without built-in properties, for maps keyed by ids.
export function idMap<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}
