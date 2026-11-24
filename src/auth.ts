import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errors.js';

const SECRET = process.env.JWT_SECRET ?? 'local-dev-secret';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, SECRET, { expiresIn: '1h' });
}

export interface AuthedRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));
  }
  try {
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    req.userId = Number(payload.sub);
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
