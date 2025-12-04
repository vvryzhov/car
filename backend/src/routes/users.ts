import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Получить всех пользователей (только для админа)
router.get('/', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const users = await dbAll('SELECT id, email, fullName, address, plotNumber, phone, role, createdAt FROM users') as any[];
    res.json(users);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить текущего пользователя
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await dbGet(
      'SELECT id, email, fullName, address, plotNumber, phone, role FROM users WHERE id = ?',
      [req.user!.id]
    ) as any;

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать пользователя (только для админа)
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  [
    body('email').isEmail().withMessage('Некорректный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
    body('fullName').notEmpty().withMessage('ФИО обязательно'),
    body('address').notEmpty().withMessage('Адрес обязателен'),
    body('plotNumber').notEmpty().withMessage('Номер участка обязателен'),
    body('phone').notEmpty().withMessage('Телефон обязателен'),
    body('role').isIn(['user', 'security']).withMessage('Роль должна быть user или security'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, address, plotNumber, phone, role } = req.body;

    try {
      const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await dbRun(
        'INSERT INTO users (email, password, fullName, address, plotNumber, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, fullName, address, plotNumber, phone, role || 'user']
      ) as any;

      res.status(201).json({
        id: result.lastID,
        email,
        fullName,
        address,
        plotNumber,
        phone,
        role: role || 'user',
      });
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Обновить профиль пользователя
router.put(
  '/me',
  authenticate,
  [
    body('fullName').optional().notEmpty().withMessage('ФИО не может быть пустым'),
    body('address').optional().notEmpty().withMessage('Адрес не может быть пустым'),
    body('plotNumber').optional().notEmpty().withMessage('Номер участка не может быть пустым'),
    body('phone').optional().notEmpty().withMessage('Телефон не может быть пустым'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, address, plotNumber, phone } = req.body;

    try {
      await dbRun(
        'UPDATE users SET fullName = ?, address = ?, plotNumber = ?, phone = ? WHERE id = ?',
        [fullName, address, plotNumber, phone, req.user!.id]
      );

      const user = await dbGet(
        'SELECT id, email, fullName, address, plotNumber, phone, role FROM users WHERE id = ?',
        [req.user!.id]
      ) as any;

      res.json(user);
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

export default router;

