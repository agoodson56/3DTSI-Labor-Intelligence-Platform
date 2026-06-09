import type { JwtPayload } from './lib/jwt';

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string;
  SESSION_TIMEOUT_MINUTES: string;
}

export interface AuthedUser {
  id: number;
  email: string;
  fullName: string;
  roleId: number;
  roleName: string;
  permissions: string[];
  officeLocation: string;
  jwt: JwtPayload;
}

export type AppContext = {
  Bindings: Env;
  Variables: {
    user: AuthedUser;
  };
};
