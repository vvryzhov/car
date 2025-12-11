import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun } from '../database';
import { JWT_SECRET } from '../middleware/auth';

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Некорректный email'),
    body('password').notEmpty().withMessage('Пароль обязателен'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await dbGet('SELECT * FROM users WHERE email = $1', [email]) as any;

      if (!user) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      // Проверяем, не деактивирован ли пользователь
      if (user.deactivatedAt) {
        return res.status(403).json({ error: 'Аккаунт деактивирован' });
      }

      // Проверяем дату деактивации
      if (user.deactivationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deactivationDate = new Date(user.deactivationDate);
        deactivationDate.setHours(0, 0, 0, 0);
        
        if (today >= deactivationDate) {
          return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      // Обновляем время последней активности для пользователей и прорабов
      // Для админов и охраны не обновляем
      if (user.role === 'user' || user.role === 'foreman') {
        await dbRun('UPDATE users SET "lastLoginAt" = NOW() WHERE id = $1', [user.id]);
      }

      // Получаем участки пользователя только для ролей user и foreman
      let plots: any[] = [];
      if (user.role === 'user' || user.role === 'foreman') {
        const { dbAll } = await import('../database');
        plots = await dbAll(
          'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1 ORDER BY "createdAt"',
          [user.id]
        ) as any[];
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          plots: plots || [],
        },
      });
    } catch (error) {
      console.error('Ошибка входа:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

export default router;

