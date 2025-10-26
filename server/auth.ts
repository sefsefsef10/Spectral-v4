import bcrypt from "bcryptjs";
import type { User } from "@shared/schema";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function sanitizeUser(user: User): Omit<User, "password" | "mfaSecret" | "backupCodes"> {
  const { password, mfaSecret, backupCodes, ...sanitized } = user;
  return sanitized;
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    role?: 'health_system' | 'vendor' | 'admin';
    healthSystemId?: string;
    vendorId?: string;
    csrfToken?: string;
    pendingMfaSecret?: string;
    pendingBackupCodes?: string[];
  }
}
