import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail, sendEmailChangeConfirmationCode } from '../services/email';
import { validatePassword } from '../utils/passwordValidator';
import { broadcastEvent } from '../services/sse';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Получить всех пользователей (только для админа)
router.get('/', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { email, phone, fullName, plotNumber, role } = req.query;
    let query = 'SELECT id, email, "fullName", phone, role, "deactivatedAt", "deactivationDate", "createdAt" FROM users WHERE 1=1';
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

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += ' ORDER BY "createdAt" DESC';

    const users = await dbAll(query, params) as any[];

    // Фильтрация по номеру участка, если указан
    let filteredUsers = users;
    if (plotNumber) {
      const plotNumberLower = `%${plotNumber}%`.toLowerCase();
      filteredUsers = [];
      for (const user of users) {
        const userPlots = await dbAll(
          'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1',
          [user.id]
        ) as any[];
        const hasMatchingPlot = userPlots.some(plot => 
          plot.plotNumber.toLowerCase().includes(plotNumberLower.replace(/%/g, ''))
        );
        if (hasMatchingPlot) {
          filteredUsers.push({ ...user, plots: userPlots });
        }
      }
    } else {
      // Получаем участки для всех пользователей
      for (const user of users) {
        const userPlots = await dbAll(
          'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1 ORDER BY "createdAt"',
          [user.id]
        ) as any[];
        user.plots = userPlots || [];
      }
      filteredUsers = users;
    }

    res.json(filteredUsers);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить статистику пользователей по ролям (только для админа)
router.get('/stats', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await dbAll(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users
      WHERE "deactivatedAt" IS NULL
      GROUP BY role
    `) as Array<{ role: string; count: number }>;

    const total = await dbGet(`
      SELECT COUNT(*) as count
      FROM users
      WHERE "deactivatedAt" IS NULL
    `) as { count: number | string };

    const result = {
      total: typeof total?.count === 'number' ? total.count : parseInt(String(total?.count || 0), 10),
      admin: 0,
      security: 0,
      foreman: 0,
      user: 0,
    };

    stats.forEach((stat) => {
      if (stat.role in result) {
        result[stat.role as keyof typeof result] = typeof stat.count === 'number' 
          ? stat.count 
          : parseInt(String(stat.count || 0), 10);
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Ошибка получения статистики пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить текущего пользователя
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await dbGet(
      'SELECT id, email, "fullName", phone, role, "telegramId" FROM users WHERE id = $1',
      [req.user!.id]
    ) as any;

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем участки пользователя только для ролей user и foreman
    let plots: any[] = [];
    if (user.role === 'user' || user.role === 'foreman') {
      plots = await dbAll(
        'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1 ORDER BY "createdAt"',
        [req.user!.id]
      ) as any[];
    }

    res.json({ 
      ...user, 
      plots: plots || [],
      telegramLinked: !!user.telegramId
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить участки пользователя
router.get('/:id/plots', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Проверяем права доступа
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Получаем информацию о пользователе, чьи участки запрашиваются
    const targetUser = await dbGet('SELECT role FROM users WHERE id = $1', [userId]) as any;
    
    // Для security и admin (редактируемых пользователей) не возвращаем участки
    // Но если это админ запрашивает участки другого пользователя - возвращаем
    if (req.user!.role === 'admin') {
      // Админ может видеть участки любых пользователей
      const plots = await dbAll(
        'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1 ORDER BY "createdAt"',
        [userId]
      ) as any[];
      return res.json(plots);
    }
    
    // Если пользователь запрашивает свои участки, но он security или admin - не возвращаем
    if (targetUser && (targetUser.role === 'security' || targetUser.role === 'admin')) {
      return res.json([]);
    }

    const plots = await dbAll(
      'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1 ORDER BY "createdAt"',
      [userId]
    ) as any[];

    res.json(plots);
  } catch (error) {
    console.error('Ошибка получения участков:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавить участок пользователю
router.post('/:id/plots', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Проверяем права доступа
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Только администратор может добавлять участки
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может добавлять участки' });
    }

    // Security и admin (редактируемые пользователи) не могут иметь участки
    const targetUser = await dbGet('SELECT role FROM users WHERE id = $1', [userId]) as any;
    if (targetUser && (targetUser.role === 'security' || targetUser.role === 'admin')) {
      return res.status(403).json({ error: 'Участки недоступны для этой роли' });
    }

    const { address, plotNumber } = req.body;

    if (!address || !plotNumber) {
      return res.status(400).json({ error: 'Адрес и номер участка обязательны' });
    }

    const result = await dbRun(
      'INSERT INTO user_plots ("userId", address, "plotNumber") VALUES ($1, $2, $3) RETURNING id, address, "plotNumber"',
      [userId, address, plotNumber]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ error: 'Ошибка создания участка' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Такой участок уже существует' });
    }
    console.error('Ошибка добавления участка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить участок пользователя
router.delete('/:id/plots/:plotId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const plotId = parseInt(req.params.plotId);
    
    // Проверяем права доступа
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Только администратор может удалять участки
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может удалять участки' });
    }

    // Проверяем, что участок принадлежит пользователю
    const plot = await dbGet(
      'SELECT id FROM user_plots WHERE id = $1 AND "userId" = $2',
      [plotId, userId]
    );

    if (!plot) {
      return res.status(404).json({ error: 'Участок не найден' });
    }

    await dbRun('DELETE FROM user_plots WHERE id = $1', [plotId]);

    res.json({ message: 'Участок удален' });
  } catch (error) {
    console.error('Ошибка удаления участка:', error);
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
    body('phone').notEmpty().withMessage('Телефон обязателен'),
    body('role').isIn(['user', 'security', 'admin', 'foreman']).withMessage('Роль должна быть user, security, admin или foreman'),
    body('deactivationDate').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      // Разрешаем null, undefined, пустую строку
      if (value === null || value === undefined || value === '' || value === 'null') {
        return true;
      }
      // Если значение есть, проверяем формат даты
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return true;
      }
      throw new Error('Некорректная дата деактивации');
    }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, phone, role, deactivationDate, plots } = req.body;

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

      // Создаем пользователя без address и plotNumber (они теперь в отдельной таблице)
      const result = await dbRun(
        'INSERT INTO users (email, password, "fullName", address, "plotNumber", phone, role, "deactivationDate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [email, hashedPassword, fullName, '', '', phone, role || 'user', deactivationDate || null]
      );

      const userId = result.rows?.[0]?.id;

      // Добавляем участки, если они переданы
      const plotsArray = Array.isArray(plots) ? plots : (plots ? [plots] : []);
      if (plotsArray.length > 0) {
        for (const plot of plotsArray) {
          if (plot.address && plot.plotNumber) {
            try {
              await dbRun(
                'INSERT INTO user_plots ("userId", address, "plotNumber") VALUES ($1, $2, $3)',
                [userId, plot.address, plot.plotNumber]
              );
            } catch (error) {
              // Игнорируем ошибки дубликатов
              console.log('Пропуск дубликата участка для пользователя', userId);
            }
          }
        }
      }

      // Получаем созданные участки
      const userPlots = await dbAll(
        'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1',
        [userId]
      ) as any[];

      res.status(201).json({
        id: userId,
        email,
        fullName,
        phone,
        role: role || 'user',
        plots: userPlots || [],
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
    body('deactivationDate').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      // Разрешаем null, undefined, пустую строку
      if (value === null || value === undefined || value === '' || value === 'null') {
        return true;
      }
      // Если значение есть, проверяем формат даты
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return true;
      }
      throw new Error('Некорректная дата деактивации');
    }),
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

      const { email, fullName, phone, role, deactivationDate, deactivate, plots } = req.body;
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

      // Участки обрабатываются отдельно, не обновляем address и plotNumber в таблице users

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

      // Всегда обновляем deactivationDate: если роль прораб - устанавливаем значение, иначе null
      if (role === 'foreman' && deactivationDate !== undefined) {
        updateFields.push(`"deactivationDate" = $${paramIndex}`);
        updateParams.push(deactivationDate || null);
        paramIndex++;
      } else if (role !== undefined && role !== 'foreman') {
        // Если меняем роль на не-прораб, очищаем deactivationDate
        updateFields.push(`"deactivationDate" = NULL`);
      } else if (deactivationDate !== undefined) {
        // Если явно передано значение (включая null)
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

      // Обновляем участки, если они переданы и массив не пустой
      // Важно: обновляем участки только если массив явно передан и не пустой
      // Если массив не передан (undefined), участки не трогаем
      if (plots !== undefined && Array.isArray(plots) && plots.length > 0) {
        console.log('Обновление участков для пользователя', req.params.id, 'plots:', plots);
        
        // Получаем текущие участки
        const currentPlots = await dbAll(
          'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1',
          [req.params.id]
        ) as any[];

        console.log('Текущие участки:', currentPlots);

        // Удаляем участки, которых нет в новом списке (только если они были явно удалены)
        // Проверяем по ID - если участок был в базе, но его нет в новом списке, удаляем
        for (const currentPlot of currentPlots) {
          const exists = plots.some((p: any) => p.id && p.id === currentPlot.id);
          if (!exists) {
            console.log('Удаление участка:', currentPlot.id);
            await dbRun('DELETE FROM user_plots WHERE id = $1', [currentPlot.id]);
          }
        }

        // Добавляем или обновляем участки из нового списка
        for (const plot of plots) {
          if (plot.address && plot.plotNumber) {
            // Проверяем, существует ли участок с таким ID в базе данных
            const existingPlot = plot.id ? currentPlots.find(p => p.id === plot.id) : null;
            
            if (existingPlot) {
              // Существующий участок - проверяем, нужно ли обновить
              if (existingPlot.address !== plot.address || existingPlot.plotNumber !== plot.plotNumber) {
                console.log('Обновление участка:', plot.id, plot.address, plot.plotNumber);
                await dbRun(
                  'UPDATE user_plots SET address = $1, "plotNumber" = $2 WHERE id = $3',
                  [plot.address, plot.plotNumber, plot.id]
                );
              } else {
                console.log('Участок не изменился, пропускаем:', plot.id);
              }
            } else {
              // Новый участок - добавляем (независимо от того, есть ли временный ID)
              try {
                console.log('Добавление нового участка:', plot.address, plot.plotNumber);
                await dbRun(
                  'INSERT INTO user_plots ("userId", address, "plotNumber") VALUES ($1, $2, $3)',
                  [req.params.id, plot.address, plot.plotNumber]
                );
              } catch (error: any) {
                // Игнорируем ошибки дубликатов
                if (error.code !== '23505') {
                  console.error('Ошибка добавления участка:', error);
                } else {
                  console.log('Дубликат участка, пропускаем');
                }
              }
            }
          }
        }
      } else if (plots !== undefined && Array.isArray(plots) && plots.length === 0) {
        // Если передан пустой массив, это означает, что нужно удалить все участки
        // Но только для ролей, которые не должны иметь участки (security, admin)
        const targetUser = await dbGet('SELECT role FROM users WHERE id = $1', [req.params.id]) as any;
        if (targetUser && (targetUser.role === 'security' || targetUser.role === 'admin')) {
          console.log('Удаление всех участков для роли', targetUser.role);
          await dbRun('DELETE FROM user_plots WHERE "userId" = $1', [req.params.id]);
        }
        // Для других ролей пустой массив игнорируем (не удаляем участки)
      }

      // Получаем обновленного пользователя с участками
      const updatedUser = await dbGet(
        'SELECT id, email, "fullName", phone, role FROM users WHERE id = $1',
        [req.params.id]
      ) as any;

      const userPlots = await dbAll(
        'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1 ORDER BY "createdAt"',
        [req.params.id]
      ) as any[];

      console.log('Возвращаем пользователя с участками:', userPlots);

      res.json({ ...updatedUser, plots: userPlots || [] });
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

// Запрос на смену email (отправка кода подтверждения на новый email)
router.post(
  '/me/request-email-change',
  authenticate,
  [
    body('newEmail').isEmail().withMessage('Некорректный email'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { newEmail } = req.body;
      
      // Получаем текущего пользователя
      const user = await dbGet('SELECT id, email, role FROM users WHERE id = $1', [req.user!.id]) as any;
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      // Проверяем, что это пользователь или прораб (админ и security могут менять email напрямую)
      if (user.role !== 'user' && user.role !== 'foreman') {
        return res.status(403).json({ error: 'Эта функция доступна только для пользователей и прорабов' });
      }

      // Проверяем, что новый email отличается от текущего
      if (user.email.toLowerCase() === newEmail.toLowerCase()) {
        return res.status(400).json({ error: 'Новый email совпадает с текущим' });
      }

      // Проверяем, что новый email не занят
      const existingUser = await dbGet('SELECT id FROM users WHERE email = $1', [newEmail.toLowerCase()]);
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      // Генерируем 6-значный код подтверждения
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Код действителен 15 минут

      // Удаляем старые токены для этого пользователя
      await dbRun('DELETE FROM email_change_tokens WHERE "userId" = $1', [req.user!.id]);

      // Сохраняем новый токен
      await dbRun(
        'INSERT INTO email_change_tokens ("userId", "oldEmail", "newEmail", code, "expiresAt") VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, user.email, newEmail.toLowerCase(), code, expiresAt]
      );

      // Отправляем код на новый email
      const emailResult = await sendEmailChangeConfirmationCode(newEmail.toLowerCase(), code);
      if (!emailResult.success) {
        console.error('Ошибка отправки кода подтверждения:', emailResult.error);
        return res.status(500).json({ 
          error: 'Ошибка отправки кода подтверждения',
          details: emailResult.error 
        });
      }

      res.json({ message: 'Код подтверждения отправлен на новый email адрес' });
    } catch (error) {
      console.error('Ошибка запроса смены email:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Подтверждение смены email по коду
router.post(
  '/me/confirm-email-change',
  authenticate,
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Код должен состоять из 6 цифр'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { code } = req.body;

      // Получаем токен подтверждения
      const tokenRecord = await dbGet(
        'SELECT * FROM email_change_tokens WHERE "userId" = $1 AND code = $2 AND "expiresAt" > NOW()',
        [req.user!.id, code]
      ) as any;

      if (!tokenRecord) {
        return res.status(400).json({ error: 'Недействительный или истекший код подтверждения' });
      }

      // Проверяем, что новый email все еще не занят
      const existingUser = await dbGet('SELECT id FROM users WHERE email = $1', [tokenRecord.newEmail]);
      if (existingUser) {
        await dbRun('DELETE FROM email_change_tokens WHERE id = $1', [tokenRecord.id]);
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      // Обновляем email пользователя
      await dbRun(
        'UPDATE users SET email = $1 WHERE id = $2',
        [tokenRecord.newEmail, req.user!.id]
      );

      // Удаляем использованный токен
      await dbRun('DELETE FROM email_change_tokens WHERE id = $1', [tokenRecord.id]);

      // Получаем обновленного пользователя
      const updatedUser = await dbGet(
        'SELECT id, email, "fullName", phone, role FROM users WHERE id = $1',
        [req.user!.id]
      ) as any;

      res.json({ 
        message: 'Email успешно изменен',
        user: updatedUser
      });
    } catch (error) {
      console.error('Ошибка подтверждения смены email:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Обновить профиль пользователя (только свои данные, без ФИО, адреса и участка)
router.put(
  '/me',
  authenticate,
  [
    body('email').optional().isEmail().withMessage('Некорректный email'),
    body('phone').optional().notEmpty().withMessage('Телефон не может быть пустым'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, phone } = req.body;

    try {
      // Получаем текущего пользователя для проверки роли
      const currentUser = await dbGet('SELECT id, role FROM users WHERE id = $1', [req.user!.id]) as any;
      
      // Для пользователей и прорабов запрещаем прямую смену email
      // Им нужно использовать механизм подтверждения через код
      if (email !== undefined && (currentUser.role === 'user' || currentUser.role === 'foreman')) {
        return res.status(403).json({ 
          error: 'Для смены email необходимо подтверждение через код. Используйте /api/users/me/request-email-change' 
        });
      }

      // Для админа и security можно менять email напрямую
      if (email !== undefined && currentUser.role !== 'user' && currentUser.role !== 'foreman') {
        const existingUser = await dbGet('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user!.id]);
        if (existingUser) {
          return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        await dbRun(
          'UPDATE users SET email = $1 WHERE id = $2',
          [email, req.user!.id]
        );
      }

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
      // Получаем URL из настроек SMTP, если есть, иначе из переменной окружения
      const { getSMTPConfig } = await import('../services/email');
      const smtpConfig = await getSMTPConfig();
      const frontendUrl = smtpConfig?.frontend_url || process.env.FRONTEND_URL || 'http://localhost:8080';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      const emailResult = await sendPasswordResetEmail(email, token, resetUrl);
      if (!emailResult.success) {
        console.error('Ошибка отправки email для восстановления пароля:', emailResult.error);
        // Не возвращаем ошибку пользователю, чтобы не раскрывать, существует ли email
      }

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

// Принудительная отправка ссылки на сброс пароля (только для админа)
router.post(
  '/:id/send-reset-link',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }

      const user = await dbGet('SELECT email FROM users WHERE id = $1', [userId]) as any;
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      // Генерируем токен
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Токен действителен 1 час

      // Удаляем старые токены для этого email
      await dbRun('DELETE FROM password_reset_tokens WHERE email = $1', [user.email]);

      // Сохраняем новый токен
      await dbRun(
        'INSERT INTO password_reset_tokens (email, token, "expiresAt") VALUES ($1, $2, $3)',
        [user.email, token, expiresAt]
      );

      // Отправляем email
      const { getSMTPConfig } = await import('../services/email');
      const smtpConfig = await getSMTPConfig();
      const frontendUrl = smtpConfig?.frontend_url || process.env.FRONTEND_URL || 'http://localhost:8080';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      
      const emailResult = await sendPasswordResetEmail(user.email, token, resetUrl);
      
      if (emailResult.success) {
        res.json({ message: `Ссылка на сброс пароля отправлена на ${user.email}` });
      } else {
        res.status(500).json({ 
          error: 'Ошибка отправки письма',
          details: emailResult.error 
        });
      }
    } catch (error) {
      console.error('Ошибка отправки ссылки на сброс пароля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Массовая отправка ссылок на сброс пароля (только для админа)
router.post(
  '/bulk-send-reset-link',
  authenticate,
  requireRole(['admin']),
  [
    body('userIds').isArray().withMessage('userIds должен быть массивом'),
    body('userIds.*').isInt().withMessage('Каждый ID должен быть числом'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Необходимо указать хотя бы одного пользователя' });
      }

      const results = {
        success: 0,
        errors: [] as Array<{ userId: number; email: string; error: string }>,
      };

      const { getSMTPConfig } = await import('../services/email');
      const smtpConfig = await getSMTPConfig();
      const frontendUrl = smtpConfig?.frontend_url || process.env.FRONTEND_URL || 'http://localhost:8080';

      // Обрабатываем каждого пользователя
      for (const userId of userIds) {
        try {
          const user = await dbGet('SELECT email FROM users WHERE id = $1', [userId]) as any;
          
          if (!user) {
            results.errors.push({
              userId,
              email: 'N/A',
              error: 'Пользователь не найден',
            });
            continue;
          }

          // Генерируем токен
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 1);

          // Удаляем старые токены для этого email
          await dbRun('DELETE FROM password_reset_tokens WHERE email = $1', [user.email]);

          // Сохраняем новый токен
          await dbRun(
            'INSERT INTO password_reset_tokens (email, token, "expiresAt") VALUES ($1, $2, $3)',
            [user.email, token, expiresAt]
          );

          // Отправляем email
          const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
          const emailResult = await sendPasswordResetEmail(user.email, token, resetUrl);

          if (emailResult.success) {
            results.success++;
          } else {
            results.errors.push({
              userId,
              email: user.email,
              error: emailResult.error || 'Ошибка отправки письма',
            });
          }
        } catch (error: any) {
          results.errors.push({
            userId,
            email: 'N/A',
            error: error.message || 'Ошибка обработки пользователя',
          });
        }
      }

      res.json({
        message: `Обработано: ${userIds.length}, Успешно: ${results.success}, Ошибок: ${results.errors.length}`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error) {
      console.error('Ошибка массовой отправки ссылок на сброс пароля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Удалить пользователя (только для админа)
router.delete('/:id', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Некорректный ID пользователя' });
    }
    
    // Нельзя удалить самого себя
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Нельзя удалить свой собственный аккаунт' });
    }

    const user = await dbGet('SELECT id FROM users WHERE id = $1', [userId]) as any;
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await dbRun('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Массовое удаление пользователей (только для админа)
router.post(
  '/bulk-delete',
  authenticate,
  requireRole(['admin']),
  [
    body('userIds').isArray().withMessage('userIds должен быть массивом'),
    body('userIds.*').isInt().withMessage('Каждый ID должен быть числом'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Необходимо указать хотя бы одного пользователя' });
      }

      // Нельзя удалить самого себя
      if (userIds.includes(req.user!.id)) {
        return res.status(400).json({ error: 'Нельзя удалить свой собственный аккаунт' });
      }

      // Удаляем пользователей
      const placeholders = userIds.map((_: any, index: number) => `$${index + 1}`).join(',');
      await dbRun(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        userIds
      );

      res.json({ message: `Удалено пользователей: ${userIds.length}` });
    } catch (error) {
      console.error('Ошибка массового удаления пользователей:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Массовая загрузка пользователей из CSV (только для админа)
router.post(
  '/bulk-upload',
  authenticate,
  requireRole(['admin']),
  upload.single('csv'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV файл не загружен' });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      
      // Парсим CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      if (records.length === 0) {
        return res.status(400).json({ error: 'CSV файл пуст' });
      }

      const results = {
        success: 0,
        errors: [] as Array<{ row: number; email: string; error: string }>,
      };

      // Группируем записи по email для обработки множественных участков
      const usersMap = new Map<string, {
        email: string;
        fullName: string;
        phone: string;
        plots: Array<{ plotNumber: string; address: string; rowNumber: number }>;
        firstRowNumber: number;
      }>();

      // Ожидаемые колонки: email, fullName, plotNumber, phone (опционально)
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // +2 потому что первая строка - заголовки, и индексация с 0

        // Валидация обязательных полей
        if (!record.email || !record.fullName || !record.plotNumber) {
          results.errors.push({
            row: rowNumber,
            email: record.email || 'N/A',
            error: 'Отсутствуют обязательные поля (email, fullName, plotNumber)',
          });
          continue;
        }

        // Валидация email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
          results.errors.push({
            row: rowNumber,
            email: record.email,
            error: 'Некорректный email',
          });
          continue;
        }

        const email = record.email.toLowerCase().trim();
        
        // Группируем по email
        if (!usersMap.has(email)) {
          usersMap.set(email, {
            email: record.email,
            fullName: record.fullName.trim(),
            phone: (record.phone || '').trim(),
            plots: [],
            firstRowNumber: rowNumber,
          });
        }

        const userData = usersMap.get(email)!;
        
        // Добавляем участок (если адрес не указан, используем пустую строку)
        userData.plots.push({
          plotNumber: record.plotNumber.trim(),
          address: '', // Адрес по умолчанию пустой
          rowNumber: rowNumber,
        });

        // Если телефон указан в этой строке и не был указан ранее, обновляем
        if (record.phone && record.phone.trim() && !userData.phone) {
          userData.phone = record.phone.trim();
        }
      }

      // Обрабатываем сгруппированных пользователей
      for (const [email, userData] of usersMap.entries()) {
        try {
          // Проверка, существует ли пользователь
          const existingUser = await dbGet('SELECT id FROM users WHERE email = $1', [email]);
          if (existingUser) {
            results.errors.push({
              row: userData.firstRowNumber,
              email: email,
              error: 'Пользователь с таким email уже существует',
            });
            continue;
          }

          // Генерируем временный пароль (пользователь должен будет его сменить)
          const tempPassword = 'Temp' + crypto.randomBytes(4).toString('hex') + '123';
          const hashedPassword = await bcrypt.hash(tempPassword, 10);

          // Значения по умолчанию
          const phone = userData.phone || '';
          const address = ''; // Адрес по умолчанию пустой
          const role = 'user'; // Роль по умолчанию - пользователь

          // Создаем пользователя
          const result = await dbRun(
            'INSERT INTO users (email, password, "fullName", address, "plotNumber", phone, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [
              email,
              hashedPassword,
              userData.fullName,
              address,
              userData.plots[0].plotNumber, // Первый участок в основную таблицу (для совместимости)
              phone,
              role,
            ]
          );

          const userId = result.rows?.[0]?.id;

          // Добавляем все участки в таблицу user_plots
          for (const plot of userData.plots) {
            try {
              await dbRun(
                'INSERT INTO user_plots ("userId", address, "plotNumber") VALUES ($1, $2, $3)',
                [userId, plot.address, plot.plotNumber]
              );
            } catch (error: any) {
              // Игнорируем ошибки дубликатов участков
              if (error.code !== '23505') {
                console.error(`Ошибка добавления участка ${plot.plotNumber} для пользователя ${email}:`, error);
              }
            }
          }

          results.success++;
        } catch (error: any) {
          results.errors.push({
            row: userData.firstRowNumber,
            email: email,
            error: error.message || 'Ошибка создания пользователя',
          });
        }
      }

      res.json({
        message: `Обработано: ${records.length}, Успешно: ${results.success}, Ошибок: ${results.errors.length}`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error) {
      console.error('Ошибка массовой загрузки пользователей:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Получить токен для привязки Telegram
router.get('/me/telegram-link-token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await dbGet('SELECT id FROM users WHERE id = $1', [req.user!.id]) as any;
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, не привязан ли уже Telegram
    const existingTelegramId = await dbGet('SELECT "telegramId" FROM users WHERE id = $1', [req.user!.id]) as any;
    if (existingTelegramId && existingTelegramId.telegramId) {
      return res.status(400).json({ error: 'Telegram уже привязан к этому аккаунту' });
    }

    // Генерируем токен (Telegram ID будет получен позже из бота)
    const { generateTelegramLinkToken } = await import('../services/telegramBot');
    const telegramId = 0; // Временное значение, будет обновлено при привязке
    
    // Сначала пытаемся получить Telegram ID из запроса (если пользователь уже начал диалог с ботом)
    // Но пока используем 0, так как мы не знаем Telegram ID до привязки
    const token = await generateTelegramLinkToken(req.user!.id, 0);

    res.json({ 
      token,
      instructions: 'Используйте команду /link в Telegram боте с этим кодом для привязки аккаунта'
    });
  } catch (error) {
    console.error('Ошибка генерации токена привязки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отвязать Telegram от аккаунта
router.post('/me/telegram-unlink', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await dbRun('UPDATE users SET "telegramId" = NULL WHERE id = $1', [req.user!.id]);
    res.json({ message: 'Telegram успешно отвязан' });
  } catch (error) {
    console.error('Ошибка отвязки Telegram:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить постоянные пропуска текущего пользователя
router.get('/me/permanent-passes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const passes = await dbAll(
      `SELECT * FROM passes 
       WHERE "userId" = $1 AND "isPermanent" = true AND "deletedAt" IS NULL 
       ORDER BY "createdAt" DESC`,
      [req.user!.id]
    ) as any[];
    res.json(passes);
  } catch (error) {
    console.error('Ошибка получения постоянных пропусков:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать постоянный пропуск
router.post('/me/permanent-passes', authenticate, requireRole(['user', 'foreman', 'admin']), [
  body('vehicleType').isIn(['грузовой', 'легковой']).withMessage('Тип транспорта должен быть грузовой или легковой'),
  body('vehicleBrand').notEmpty().withMessage('Марка авто обязательна'),
  body('vehicleNumber').notEmpty().withMessage('Номер авто обязателен'),
], async (req: AuthRequest, res: Response) => {
  console.log('📝 POST /api/users/me/permanent-passes - запрос на создание постоянного пропуска');
  console.log('   Пользователь ID:', req.user!.id);
  console.log('   Роль:', req.user!.role);
  console.log('   Тело запроса:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('❌ Ошибки валидации:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { vehicleType, vehicleBrand, vehicleNumber, comment } = req.body;
  console.log('   Данные после валидации:', { vehicleType, vehicleBrand, vehicleNumber, comment });

  // Валидация номера автомобиля
  const { validateVehicleNumber } = await import('../utils/vehicleNumberValidator');
  const numberValidation = validateVehicleNumber(vehicleNumber);
  if (!numberValidation.valid) {
    return res.status(400).json({ error: numberValidation.error });
  }

  // Преобразуем номер в верхний регистр
  const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

  try {
    // Получаем первый участок пользователя для адреса
    const plots = await dbAll('SELECT * FROM user_plots WHERE "userId" = $1 LIMIT 1', [req.user!.id]) as any[];
    if (plots.length === 0) {
      console.error('У пользователя нет участков:', req.user!.id);
      return res.status(400).json({ error: 'У вас нет добавленных участков. Пожалуйста, добавьте участок в профиле.' });
    }

    const plot = plots[0];
    const address = plot.address || plot.plotNumber;
    
    console.log('Создание постоянного пропуска:', {
      userId: req.user!.id,
      vehicleType,
      vehicleBrand,
      vehicleNumber: normalizedVehicleNumber,
      address,
      plotNumber: plot.plotNumber
    });

    // Создаем постоянный пропуск (без даты въезда, статус personal_vehicle)
    const result = await dbRun(
      `INSERT INTO passes ("userId", "vehicleType", "vehicleBrand", "vehicleNumber", "entryDate", address, "plotNumber", comment, "isPermanent", status) 
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, true, 'personal_vehicle') 
       RETURNING id`,
      [req.user!.id, vehicleType, vehicleBrand, normalizedVehicleNumber, address, plot.plotNumber, comment || null]
    );

    const newPassId = result.rows?.[0]?.id || result.lastID;
    if (!newPassId) {
      console.error('Не удалось получить ID созданного пропуска:', result);
      return res.status(500).json({ error: 'Ошибка создания пропуска: не получен ID' });
    }

    const pass = await dbGet('SELECT * FROM passes WHERE id = $1', [newPassId]) as any;
    if (!pass) {
      console.error('Созданный пропуск не найден:', newPassId);
      return res.status(500).json({ error: 'Ошибка создания пропуска: пропуск не найден после создания' });
    }
    
    // Отправляем событие о новой заявке через SSE
    broadcastEvent('new-pass', { message: 'Новая заявка создана', passId: pass.id });
    
    console.log('Постоянный пропуск успешно создан:', pass);
    res.status(201).json(pass);
  } catch (error: any) {
    console.error('Ошибка создания постоянного пропуска:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка сервера',
      details: error.stack 
    });
  }
});

// Обновить постоянный пропуск
router.put('/me/permanent-passes/:id', authenticate, requireRole(['user', 'foreman', 'admin']), [
  body('vehicleType').optional().isIn(['грузовой', 'легковой']).withMessage('Тип транспорта должен быть грузовой или легковой'),
  body('vehicleBrand').optional().notEmpty().withMessage('Марка авто не может быть пустой'),
  body('vehicleNumber').optional().notEmpty().withMessage('Номер авто не может быть пустым'),
], async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Проверяем, что пропуск принадлежит пользователю и является постоянным
    const pass = await dbGet('SELECT * FROM passes WHERE id = $1 AND "userId" = $2 AND "isPermanent" = true', 
      [req.params.id, req.user!.id]) as any;
    
    if (!pass) {
      return res.status(404).json({ error: 'Постоянный пропуск не найден' });
    }

    const { vehicleType, vehicleBrand, vehicleNumber, comment } = req.body;

    // Валидация номера, если он изменяется
    let normalizedVehicleNumber = pass.vehicleNumber;
    if (vehicleNumber && vehicleNumber !== pass.vehicleNumber) {
      const { validateVehicleNumber } = await import('../utils/vehicleNumberValidator');
      const numberValidation = validateVehicleNumber(vehicleNumber);
      if (!numberValidation.valid) {
        return res.status(400).json({ error: numberValidation.error });
      }
      // Преобразуем номер в верхний регистр
      normalizedVehicleNumber = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    }

    // Обновляем пропуск
    await dbRun(
      `UPDATE passes 
       SET "vehicleType" = COALESCE($1, "vehicleType"),
           "vehicleBrand" = COALESCE($2, "vehicleBrand"),
           "vehicleNumber" = COALESCE($3, "vehicleNumber"),
           comment = COALESCE($4, comment)
       WHERE id = $5`,
      [
        vehicleType || pass.vehicleType,
        vehicleBrand || pass.vehicleBrand,
        normalizedVehicleNumber,
        comment !== undefined ? comment : pass.comment,
        req.params.id
      ]
    );

    // Отправляем событие об обновлении заявки через SSE
    broadcastEvent('pass-updated', { message: 'Заявка обновлена', passId: pass.id });

    const updatedPass = await dbGet('SELECT * FROM passes WHERE id = $1', [req.params.id]) as any;
    res.json(updatedPass);
  } catch (error) {
    console.error('Ошибка обновления постоянного пропуска:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить постоянный пропуск
router.delete('/me/permanent-passes/:id', authenticate, requireRole(['user', 'foreman', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    // Проверяем, что пропуск принадлежит пользователю и является постоянным
    const pass = await dbGet('SELECT * FROM passes WHERE id = $1 AND "userId" = $2 AND "isPermanent" = true', 
      [req.params.id, req.user!.id]) as any;
    
    if (!pass) {
      return res.status(404).json({ error: 'Постоянный пропуск не найден' });
    }

    // Мягкое удаление
    await dbRun('UPDATE passes SET "deletedAt" = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ message: 'Постоянный пропуск удален' });
  } catch (error) {
    console.error('Ошибка удаления постоянного пропуска:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить все постоянные пропуска (для охраны и админов)
router.get('/permanent-passes', authenticate, requireRole(['security', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleNumber } = req.query;
    let query = `
      SELECT p.*, u."fullName", u.phone
      FROM passes p
      JOIN users u ON p."userId" = u.id
      WHERE p."isPermanent" = true AND p."deletedAt" IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (vehicleNumber) {
      query += ` AND p."vehicleNumber" ILIKE $${paramIndex}`;
      params.push(`%${vehicleNumber}%`);
      paramIndex++;
    }

    query += ' ORDER BY p."createdAt" DESC';

    const passes = await dbAll(query, params) as any[];
    res.json(passes);
  } catch (error) {
    console.error('Ошибка получения постоянных пропусков:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
