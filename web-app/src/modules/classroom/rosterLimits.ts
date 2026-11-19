import { MAX_NAME, MAX_NOTE, MAX_STUDENTS, MAX_TAG_NAME } from '@shared/serverLimits';

// Staying inside the server's limits keeps every save from being refused.
export { MAX_STUDENTS };
export const MAX_NAME_LENGTH = MAX_NAME;
export const MAX_NOTE_LENGTH = MAX_NOTE;
export const MAX_TAG_NAME_LENGTH = MAX_TAG_NAME;
