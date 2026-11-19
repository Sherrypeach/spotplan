import { User } from '@modules/user/entities/user.entity';

/** A signed-in session: who, the token for the cookie, and how long it lasts. */
export interface Session {
  user: User;
  token: string;
  maxAgeMs: number;
}
