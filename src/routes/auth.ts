import { Router } from 'express';
import { z } from 'zod';
import { signToken, verifyPassword } from '../auth.js';
import { pool } from '../db.js';
import { ApiError } from '../errors.js';

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = LoginBody.parse(req.body);
  const { rows } = await pool.query('SELECT id, email, name, password_hash, locked FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);
  const user = rows[0];
  // Same message for unknown email and wrong password: don't reveal which accounts exist.
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (user.locked) {
    throw new ApiError(423, 'ACCOUNT_LOCKED', 'This account is locked');
  }
  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, name: user.name } });
});
