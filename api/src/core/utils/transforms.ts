/** class-transformer helper: trims string input, leaves anything else as is. */
export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
