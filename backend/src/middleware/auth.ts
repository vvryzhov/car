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

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    
    // Проверяем, не деактивирован ли пользователь
    const { dbGet } = require('../database');
    const user = await dbGet('SELECT "deactivatedAt", "deactivationDate" FROM users WHERE id = $1', [decoded.id]) as any;
    
    if (user) {
      // Проверяем немедленную деактивацию
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
    }
    
    req.user = decoded;
    next();
  } catch (error) {
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

