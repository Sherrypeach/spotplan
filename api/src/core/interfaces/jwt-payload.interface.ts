/** Claims carried by our JWTs. `type` separates session and password-reset tokens. */
export interface JwtPayload {
  sub: number;
  type: 'session' | 'reset';
  /** Session tokens stop working once the user's session version moves on. */
  sv?: number;
  /** Session tokens: this sign-in's id, so signing out can end just this device. */
  sid?: string;
  iat?: number;
  exp?: number;
}
