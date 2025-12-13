import { Request, Response, NextFunction } from 'express';
import { dbGet } from '../database';

/**
 * Middleware для проверки LPR токена
 * Используется для защиты API эндпоинтов LPR
 * Сначала проверяет токен в БД, затем в переменных окружения
 */
export const requireLprToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-lpr-token'] as string;

  if (!token) {
    console.warn('⚠️  LPR запрос без токена', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'X-LPR-Token header required' });
  }

  try {
    // Сначала проверяем токен в БД
    const settings = await dbGet('SELECT lpr_token FROM lpr_settings ORDER BY id DESC LIMIT 1');
    const expectedToken = settings?.lpr_token || process.env.LPR_TOKEN;

    if (!expectedToken) {
      console.error('❌ LPR_TOKEN не установлен ни в БД, ни в переменных окружения');
      return res.status(500).json({ error: 'LPR authentication not configured' });
    }

    if (token !== expectedToken) {
      console.warn('⚠️  Неверный LPR токен', { path: req.path, ip: req.ip });
      return res.status(401).json({ error: 'Invalid LPR token' });
    }

    // Токен валиден
    next();
  } catch (error) {
    console.error('Ошибка проверки LPR токена:', error);
    return res.status(500).json({ error: 'Error validating LPR token' });
  }
};
