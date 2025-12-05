import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';
import { validatePassword } from '../utils/passwordValidator';

const router = express.Router();

// Получить всех пользователей (только для админа)
router.get('/', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { email, phone, fullName, plotNumber } = req.query;
    let query = 'SELECT id, email, "fullName", address, "plotNumber", phone, role, "deactivatedAt", "deactivationDate", "createdAt" FROM users WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (email) {
      query += ` AND email ILIKE $${paramIndex}`;
      params.push(`%${email}%`);
      paramIndex++;
    }

    if (phone) {
      query += ` AND phone ILIKE $${paramIndex}`;
      params.push(`%${phone}%`);
      paramIndex++;
    }

    if (fullName) {
      query += ` AND "fullName" ILIKE $${paramIndex}`;
      params.push(`%${fullName}%`);
      paramIndex++;
    }

    if (plotNumber) {
      query += ` AND "plotNumber" ILIKE $${paramIndex}`;
      params.push(`%${plotNumber}%`);
      paramIndex++;
    }

    query += ' ORDER BY "createdAt" DESC';

    const users = await dbAll(query, params) as any[];
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
      'SELECT id, email, "fullName", address, "plotNumber", phone, role FROM users WHERE id = $1',
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
    body('role').isIn(['user', 'security', 'admin', 'foreman']).withMessage('Роль должна быть user, security, admin или foreman'),
    body('deactivationDate').optional().isISO8601().withMessage('Некорректная дата деактивации'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, address, plotNumber, phone, role, deactivationDate } = req.body;

    try {
      // Валидация пароля
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      const existingUser = await dbGet('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await dbRun(
        'INSERT INTO users (email, password, "fullName", address, "plotNumber", phone, role, "deactivationDate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [email, hashedPassword, fullName, address, plotNumber, phone, role || 'user', deactivationDate || null]
      );

      res.status(201).json({
        id: result.rows?.[0]?.id,
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

// Обновить пользователя (только для админа)
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  [
    body('email').optional().isEmail().withMessage('Некорректный email'),
    body('fullName').optional().notEmpty().withMessage('ФИО не может быть пустым'),
    body('address').optional().notEmpty().withMessage('Адрес не может быть пустым'),
    body('plotNumber').optional().notEmpty().withMessage('Номер участка не может быть пустым'),
    body('phone').optional().notEmpty().withMessage('Телефон не может быть пустым'),
    body('role').optional().isIn(['user', 'security', 'admin', 'foreman']).withMessage('Некорректная роль'),
    body('deactivationDate').optional().isISO8601().withMessage('Некорректная дата деактивации'),
    body('deactivate').optional().isBoolean().withMessage('deactivate должен быть boolean'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await dbGet('SELECT * FROM users WHERE id = $1', [req.params.id]) as any;
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const { email, fullName, address, plotNumber, phone, role, deactivationDate, deactivate } = req.body;
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (email !== undefined) {
        // Проверяем, что email не занят другим пользователем
        const existingUser = await dbGet('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.params.id]);
        if (existingUser) {
          return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        updateFields.push(`email = $${paramIndex}`);
        updateParams.push(email);
        paramIndex++;
      }

      if (fullName !== undefined) {
        updateFields.push(`"fullName" = $${paramIndex}`);
        updateParams.push(fullName);
        paramIndex++;
      }

      if (address !== undefined) {
        updateFields.push(`address = $${paramIndex}`);
        updateParams.push(address);
        paramIndex++;
      }

      if (plotNumber !== undefined) {
        updateFields.push(`"plotNumber" = $${paramIndex}`);
        updateParams.push(plotNumber);
        paramIndex++;
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`);
        updateParams.push(phone);
        paramIndex++;
      }

      if (role !== undefined) {
        updateFields.push(`role = $${paramIndex}`);
        updateParams.push(role);
        paramIndex++;
      }

      if (deactivationDate !== undefined) {
        updateFields.push(`"deactivationDate" = $${paramIndex}`);
        updateParams.push(deactivationDate || null);
        paramIndex++;
      }

      if (deactivate !== undefined) {
        if (deactivate) {
          updateFields.push(`"deactivatedAt" = CURRENT_TIMESTAMP`);
        } else {
          updateFields.push(`"deactivatedAt" = NULL`);
        }
      }

      if (updateFields.length > 0) {
        updateParams.push(req.params.id);
        await dbRun(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateParams
        );
      }

      const updatedUser = await dbGet(
        'SELECT id, email, "fullName", address, "plotNumber", phone, role FROM users WHERE id = $1',
        [req.params.id]
      ) as any;

      res.json(updatedUser);
    } catch (error) {
      console.error('Ошибка обновления пользователя:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Изменить пароль пользователя (админ может менять пароль любого пользователя)
router.put(
  '/:id/password',
  authenticate,
  requireRole(['admin']),
  [
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await dbGet('SELECT id FROM users WHERE id = $1', [req.params.id]) as any;
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      await dbRun(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, req.params.id]
      );

      res.json({ message: 'Пароль изменен' });
    } catch (error) {
      console.error('Ошибка изменения пароля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Обновить профиль пользователя (только свои данные, без ФИО, адреса и участка)
router.put(
  '/me',
  authenticate,
  [
    body('phone').optional().notEmpty().withMessage('Телефон не может быть пустым'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone } = req.body;

    try {
      if (phone !== undefined) {
        await dbRun(
          'UPDATE users SET phone = $1 WHERE id = $2',
          [phone, req.user!.id]
        );
      }

      const user = await dbGet(
        'SELECT id, email, "fullName", address, "plotNumber", phone, role FROM users WHERE id = $1',
        [req.user!.id]
      ) as any;

      res.json(user);
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Изменить свой пароль
router.put(
  '/me/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
    body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль должен быть не менее 6 символов'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await dbGet('SELECT * FROM users WHERE id = $1', [req.user!.id]) as any;
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const { currentPassword, newPassword } = req.body;

      // Валидация пароля
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await dbRun(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, req.user!.id]
      );

      res.json({ message: 'Пароль изменен' });
    } catch (error) {
      console.error('Ошибка изменения пароля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Запрос на восстановление пароля (отправка email с токеном)
router.post(
  '/reset-password-request',
  [
    body('email').isEmail().withMessage('Некорректный email'),
  ],
  async (req: express.Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email } = req.body;
      const crypto = require('crypto');

      const user = await dbGet('SELECT id FROM users WHERE email = $1', [email]) as any;
      if (!user) {
        // Не раскрываем, существует ли пользователь
        return res.json({ message: 'Если пользователь с таким email существует, письмо отправлено' });
      }

      // Генерируем токен
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Токен действителен 1 час

      // Удаляем старые токены для этого email
      await dbRun('DELETE FROM password_reset_tokens WHERE email = $1', [email]);

      // Сохраняем новый токен
      await dbRun(
        'INSERT INTO password_reset_tokens (email, token, "expiresAt") VALUES ($1, $2, $3)',
        [email, token, expiresAt]
      );

      // Отправляем email
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, token, resetUrl);

      res.json({ message: 'Если пользователь с таким email существует, письмо отправлено' });
    } catch (error) {
      console.error('Ошибка запроса восстановления пароля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Смена пароля по токену
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Токен обязателен'),
    body('newPassword').custom((value) => {
      const validation = validatePassword(value);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      return true;
    }),
  ],
  async (req: express.Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { token, newPassword } = req.body;

      // Проверяем токен
      const tokenRecord = await dbGet(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND "expiresAt" > NOW()',
        [token]
      ) as any;

      if (!tokenRecord) {
        return res.status(400).json({ error: 'Недействительный или истекший токен' });
      }

      // Меняем пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await dbRun(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, tokenRecord.email]
      );

      // Удаляем использованный токен
      await dbRun('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

      res.json({ message: 'Пароль успешно изменен' });
    } catch (error) {
      console.error('Ошибка восстановления пароля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

export default router;
