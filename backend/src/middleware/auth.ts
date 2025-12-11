import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
  body: any;
  query: any;
  params: any;
  headers: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  const path = req.path || req.url;

  if (!token) {
    console.log('❌ authenticate: Токен не предоставлен для', path);
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    console.log('🔐 authenticate: Проверка пользователя', decoded.id, 'для', path);
    
    // Проверяем, не деактивирован ли пользователь
    const { dbGet, dbRun } = require('../database');
    const user = await dbGet('SELECT "deactivatedAt", "deactivationDate" FROM users WHERE id = $1', [decoded.id]) as any;
    
    if (user) {
      // Проверяем немедленную деактивацию
      if (user.deactivatedAt) {
        console.log('❌ authenticate: Аккаунт деактивирован (deactivatedAt) для пользователя', decoded.id);
        return res.status(403).json({ error: 'Аккаунт деактивирован' });
      }
      
      // Проверяем дату деактивации
      if (user.deactivationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deactivationDate = new Date(user.deactivationDate);
        deactivationDate.setHours(0, 0, 0, 0);
        
        console.log('📅 authenticate: Проверка даты деактивации для пользователя', decoded.id, '- сегодня:', today, 'дата деактивации:', deactivationDate);
        
        if (today >= deactivationDate) {
          console.log('❌ authenticate: Аккаунт деактивирован (deactivationDate) для пользователя', decoded.id);
          return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }
      }
    }
    
    // Обновляем время последней активности для пользователей и прорабов
    // Для админов и охраны не обновляем
    if (decoded.role === 'user' || decoded.role === 'foreman') {
      // Обновляем асинхронно, не блокируя запрос
      dbRun('UPDATE users SET "lastLoginAt" = NOW() WHERE id = $1', [decoded.id]).catch((err: any) => {
        console.error('Ошибка обновления lastLoginAt:', err);
      });
    }
    
    console.log('✅ authenticate: Пользователь', decoded.id, 'авторизован для', path);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ authenticate: Ошибка проверки токена для', path, error);
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    next();
  };
};

export { JWT_SECRET };

