import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { getSMTPConfig, sendEmail } from '../services/email';

const router = express.Router();

// Получить настройки SMTP (только для админа)
router.get('/smtp', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const settings = await dbGet('SELECT * FROM smtp_settings ORDER BY id DESC LIMIT 1');
    if (!settings) {
      return res.json({
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
        from_email: '',
        from_name: '',
        frontend_url: process.env.FRONTEND_URL || 'http://localhost:8080',
      });
    }
    // Не отправляем пароль в ответе
    res.json({
      host: settings.host || '',
      port: settings.port || 587,
      secure: settings.secure || false,
      user: settings.user || '',
      password: '', // Не отправляем пароль
      from_email: settings.from_email || '',
      from_name: settings.from_name || '',
      frontend_url: settings.frontend_url || process.env.FRONTEND_URL || 'http://localhost:8080',
    });
  } catch (error) {
    console.error('Ошибка получения настроек SMTP:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить настройки SMTP (только для админа)
router.post(
  '/smtp',
  authenticate,
  requireRole(['admin']),
  [
    body('host').notEmpty().withMessage('Хост обязателен'),
    body('port').isInt({ min: 1, max: 65535 }).withMessage('Порт должен быть числом от 1 до 65535'),
    body('user').notEmpty().withMessage('Пользователь обязателен'),
    body('password').notEmpty().withMessage('Пароль обязателен'),
    body('from_email').isEmail().withMessage('Некорректный email отправителя'),
    body('from_name').optional(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { host, port, secure, user, password, from_email, from_name, frontend_url } = req.body;

      // Проверяем, есть ли уже настройки
      const existing = await dbGet('SELECT id FROM smtp_settings ORDER BY id DESC LIMIT 1');

      if (existing) {
        // Обновляем существующие настройки
        await dbRun(
          'UPDATE smtp_settings SET host = $1, port = $2, secure = $3, "user" = $4, password = $5, from_email = $6, from_name = $7, frontend_url = $8, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $9',
          [host, port, secure || false, user, password, from_email, from_name || 'Система управления пропусками', frontend_url || null, existing.id]
        );
      } else {
        // Создаем новые настройки
        await dbRun(
          'INSERT INTO smtp_settings (host, port, secure, "user", password, from_email, from_name, frontend_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [host, port, secure || false, user, password, from_email, from_name || 'Система управления пропусками', frontend_url || null]
        );
      }

      res.json({ message: 'Настройки SMTP сохранены' });
    } catch (error) {
      console.error('Ошибка сохранения настроек SMTP:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Тест отправки email (только для админа)
router.post(
  '/smtp/test',
  authenticate,
  requireRole(['admin']),
  [
    body('email').isEmail().withMessage('Некорректный email'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email } = req.body;
      const config = await getSMTPConfig();

      if (!config) {
        return res.status(400).json({ 
          error: 'SMTP настройки не найдены. Сначала сохраните настройки SMTP.' 
        });
      }

      const testHtml = `
        <h2>Тестовое письмо</h2>
        <p>Это тестовое письмо для проверки настроек SMTP сервера.</p>
        <p>Если вы получили это письмо, значит настройки работают корректно.</p>
      `;

      const result = await sendEmail(email, 'Тестовое письмо', testHtml);

      if (result.success) {
        res.json({ message: `Тестовое письмо успешно отправлено на ${email}` });
      } else {
        res.status(500).json({ 
          error: result.error || 'Ошибка отправки письма',
          details: result.error 
        });
      }
    } catch (error: any) {
      console.error('Ошибка отправки тестового письма:', error);
      const errorMessage = error.message || 'Неизвестная ошибка сервера';
      res.status(500).json({ 
        error: 'Ошибка сервера при отправке тестового письма',
        details: errorMessage 
      });
    }
  }
);

// Получить настройки LPR (только для админа)
router.get('/lpr', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const settings = await dbGet('SELECT * FROM lpr_settings ORDER BY id DESC LIMIT 1');
    if (!settings) {
      // Если настроек нет, создаём с дефолтными значениями
      const { randomBytes } = require('crypto');
      const defaultToken = process.env.LPR_TOKEN || randomBytes(32).toString('hex');
      await dbRun(
        `INSERT INTO lpr_settings (lpr_token, cooldown_seconds, allowed_statuses, allow_repeat_after_entered, timezone)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          defaultToken,
          parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10),
          process.env.LPR_ALLOWED_STATUSES || 'pending',
          process.env.LPR_ALLOW_REPEAT_AFTER_ENTERED === 'true',
          process.env.TZ || 'Asia/Almaty',
        ]
      );
      const newSettings = await dbGet('SELECT * FROM lpr_settings ORDER BY id DESC LIMIT 1');
      return res.json({
        lpr_token: newSettings.lpr_token || '',
        cooldown_seconds: newSettings.cooldown_seconds || 15,
        allowed_statuses: newSettings.allowed_statuses || 'pending',
        allow_repeat_after_entered: newSettings.allow_repeat_after_entered || false,
        timezone: newSettings.timezone || 'Asia/Almaty',
      });
    }
    res.json({
      lpr_token: settings.lpr_token || '',
      cooldown_seconds: settings.cooldown_seconds || 15,
      allowed_statuses: settings.allowed_statuses || 'pending',
      allow_repeat_after_entered: settings.allow_repeat_after_entered || false,
      timezone: settings.timezone || 'Asia/Almaty',
    });
  } catch (error) {
    console.error('Ошибка получения настроек LPR:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить настройки LPR (только для админа)
router.post(
  '/lpr',
  authenticate,
  requireRole(['admin']),
  [
    body('cooldown_seconds').optional().isInt({ min: 1, max: 3600 }).withMessage('Cooldown должен быть от 1 до 3600 секунд'),
    body('allowed_statuses').optional().isString().withMessage('Allowed statuses должны быть строкой'),
    body('allow_repeat_after_entered').optional().isBoolean().withMessage('Allow repeat after entered должен быть boolean'),
    body('timezone').optional().isString().withMessage('Timezone должен быть строкой'),
    body('generate_new_token').optional().isBoolean().withMessage('Generate new token должен быть boolean'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { cooldown_seconds, allowed_statuses, allow_repeat_after_entered, timezone, generate_new_token } = req.body;

      // Проверяем, есть ли уже настройки
      const existing = await dbGet('SELECT id, lpr_token FROM lpr_settings ORDER BY id DESC LIMIT 1');

      let newToken = null;
      if (generate_new_token) {
        const { randomBytes } = require('crypto');
        newToken = randomBytes(32).toString('hex');
      }

      if (existing) {
        // Обновляем существующие настройки
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (newToken !== null) {
          updateFields.push(`lpr_token = $${paramIndex}`);
          updateValues.push(newToken);
          paramIndex++;
        }
        if (cooldown_seconds !== undefined) {
          updateFields.push(`cooldown_seconds = $${paramIndex}`);
          updateValues.push(cooldown_seconds);
          paramIndex++;
        }
        if (allowed_statuses !== undefined) {
          updateFields.push(`allowed_statuses = $${paramIndex}`);
          updateValues.push(allowed_statuses);
          paramIndex++;
        }
        if (allow_repeat_after_entered !== undefined) {
          updateFields.push(`allow_repeat_after_entered = $${paramIndex}`);
          updateValues.push(allow_repeat_after_entered);
          paramIndex++;
        }
        if (timezone !== undefined) {
          updateFields.push(`timezone = $${paramIndex}`);
          updateValues.push(timezone);
          paramIndex++;
        }

        updateFields.push(`"updatedAt" = NOW()`);
        updateValues.push(existing.id);

        if (updateFields.length > 1) {
          await dbRun(
            `UPDATE lpr_settings SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            updateValues
          );
        }
      } else {
        // Создаем новые настройки
        const { randomBytes } = require('crypto');
        const token = newToken || process.env.LPR_TOKEN || randomBytes(32).toString('hex');
        await dbRun(
          `INSERT INTO lpr_settings (lpr_token, cooldown_seconds, allowed_statuses, allow_repeat_after_entered, timezone)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            token,
            cooldown_seconds !== undefined ? cooldown_seconds : 15,
            allowed_statuses !== undefined ? allowed_statuses : 'pending',
            allow_repeat_after_entered !== undefined ? allow_repeat_after_entered : false,
            timezone !== undefined ? timezone : 'Asia/Almaty',
          ]
        );
      }

      // Возвращаем обновленные настройки
      const updated = await dbGet('SELECT * FROM lpr_settings ORDER BY id DESC LIMIT 1');
      res.json({
        message: 'Настройки LPR сохранены',
        lpr_token: updated.lpr_token || '',
        cooldown_seconds: updated.cooldown_seconds || 15,
        allowed_statuses: updated.allowed_statuses || 'pending',
        allow_repeat_after_entered: updated.allow_repeat_after_entered || false,
        timezone: updated.timezone || 'Asia/Almaty',
      });
    } catch (error) {
      console.error('Ошибка сохранения настроек LPR:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

export default router;

