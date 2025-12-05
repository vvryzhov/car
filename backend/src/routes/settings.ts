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

export default router;

