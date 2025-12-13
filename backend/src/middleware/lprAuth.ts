import { Request, Response, NextFunction } from 'express';

/**
 * Middleware для проверки LPR токена
 * Используется для защиты API эндпоинтов LPR
 */
export const requireLprToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-lpr-token'] as string;
  const expectedToken = process.env.LPR_TOKEN;

  if (!expectedToken) {
    console.error('❌ LPR_TOKEN не установлен в переменных окружения');
    return res.status(500).json({ error: 'LPR authentication not configured' });
  }

  if (!token) {
    console.warn('⚠️  LPR запрос без токена', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'X-LPR-Token header required' });
  }

  if (token !== expectedToken) {
    console.warn('⚠️  Неверный LPR токен', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Invalid LPR token' });
  }

  // Токен валиден
  next();
};
