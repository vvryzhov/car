import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Получить все заявки (для охраны и админа)
router.get('/all', authenticate, requireRole(['security', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, vehicleType } = req.query;
    let query = `
      SELECT p.*, u."fullName", u."plotNumber", u.phone 
      FROM passes p
      JOIN users u ON p."userId" = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND p."entryDate" = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (vehicleType) {
      query += ` AND p."vehicleType" = $${paramIndex}`;
      params.push(vehicleType);
      paramIndex++;
    }

    query += ' ORDER BY p."entryDate" DESC, p."createdAt" DESC';

    const passes = await dbAll(query, params) as any[];
    res.json(passes);
  } catch (error) {
    console.error('Ошибка получения заявок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить заявки текущего пользователя
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const passes = await dbAll(
      'SELECT * FROM passes WHERE "userId" = $1 ORDER BY "entryDate" DESC, "createdAt" DESC',
      [req.user!.id]
    ) as any[];
    res.json(passes);
  } catch (error) {
    console.error('Ошибка получения заявок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить одну заявку
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pass = await dbGet('SELECT * FROM passes WHERE id = $1', [req.params.id]) as any;

    if (!pass) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Проверяем, что пользователь имеет доступ к этой заявке
    if (req.user!.role !== 'admin' && req.user!.role !== 'security' && pass.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    res.json(pass);
  } catch (error) {
    console.error('Ошибка получения заявки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать заявку
router.post(
  '/',
  authenticate,
  requireRole(['user', 'admin']),
  [
    body('vehicleType').isIn(['грузовой', 'легковой']).withMessage('Тип транспорта должен быть грузовой или легковой'),
    body('vehicleNumber').notEmpty().withMessage('Номер авто обязателен'),
    body('entryDate').notEmpty().withMessage('Дата въезда обязательна'),
    body('address').notEmpty().withMessage('Адрес обязателен'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicleType, vehicleNumber, entryDate, address, comment } = req.body;

    try {
      const result = await dbRun(
        'INSERT INTO passes ("userId", "vehicleType", "vehicleNumber", "entryDate", address, comment) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [req.user!.id, vehicleType, vehicleNumber, entryDate, address, comment || null]
      );

      const pass = await dbGet('SELECT * FROM passes WHERE id = $1', [result.rows?.[0]?.id]) as any;
      res.status(201).json(pass);
    } catch (error) {
      console.error('Ошибка создания заявки:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Обновить заявку
router.put(
  '/:id',
  authenticate,
  [
    body('vehicleType').optional().isIn(['грузовой', 'легковой']).withMessage('Тип транспорта должен быть грузовой или легковой'),
    body('vehicleNumber').optional().notEmpty().withMessage('Номер авто не может быть пустым'),
    body('entryDate').optional().notEmpty().withMessage('Дата въезда не может быть пустой'),
    body('address').optional().notEmpty().withMessage('Адрес не может быть пустым'),
    body('status').optional().isIn(['pending', 'activated', 'rejected']).withMessage('Некорректный статус'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const pass = await dbGet('SELECT * FROM passes WHERE id = $1', [req.params.id]) as any;

      if (!pass) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      // Проверяем, что пользователь имеет доступ к этой заявке
      // Охрана и админ могут редактировать любые пропуска
      if (req.user!.role !== 'admin' && req.user!.role !== 'security' && pass.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Доступ запрещен' });
      }

      const { 
        vehicleType, 
        vehicleNumber, 
        entryDate, 
        address, 
        comment, 
        securityComment,
        status,
        fullName,
        plotNumber
      } = req.body;

      // Если это охрана, не позволяем менять комментарий пользователя
      const updateComment = req.user!.role === 'admin' ? (comment !== undefined ? comment : pass.comment) : pass.comment;

      // Обновляем пропуск
      await dbRun(
        'UPDATE passes SET "vehicleType" = $1, "vehicleNumber" = $2, "entryDate" = $3, address = $4, comment = $5, "securityComment" = $6, status = $7 WHERE id = $8',
        [
          vehicleType !== undefined ? vehicleType : pass.vehicleType,
          vehicleNumber !== undefined ? vehicleNumber : pass.vehicleNumber,
          entryDate !== undefined ? entryDate : pass.entryDate,
          address !== undefined ? address : pass.address,
          updateComment,
          securityComment !== undefined ? securityComment : pass.securityComment,
          status !== undefined ? status : pass.status,
          req.params.id,
        ]
      );

      // Если охрана или админ обновляют ФИО или участок, обновляем данные пользователя
      if ((req.user!.role === 'admin' || req.user!.role === 'security') && (fullName || plotNumber)) {
        const user = await dbGet('SELECT * FROM users WHERE id = $1', [pass.userId]) as any;
        if (user) {
          const updateFields: string[] = [];
          const updateParams: any[] = [];
          let paramIndex = 1;
          
          if (fullName !== undefined) {
            updateFields.push(`"fullName" = $${paramIndex}`);
            updateParams.push(fullName);
            paramIndex++;
          }
          if (plotNumber !== undefined) {
            updateFields.push(`"plotNumber" = $${paramIndex}`);
            updateParams.push(plotNumber);
            paramIndex++;
          }
          
          if (updateFields.length > 0) {
            updateParams.push(pass.userId);
            const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
            await dbRun(updateQuery, updateParams);
          }
        }
      }

      // Получаем обновленный пропуск с данными пользователя
      const updatedPass = await dbGet(`
        SELECT p.*, u."fullName", u."plotNumber", u.phone 
        FROM passes p
        JOIN users u ON p."userId" = u.id
        WHERE p.id = $1
      `, [req.params.id]) as any;
      
      res.json(updatedPass);
    } catch (error) {
      console.error('Ошибка обновления заявки:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// Удалить заявку
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pass = await dbGet('SELECT * FROM passes WHERE id = $1', [req.params.id]) as any;

    if (!pass) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Проверяем, что пользователь имеет доступ к этой заявке
    if (req.user!.role !== 'admin' && pass.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    await dbRun('DELETE FROM passes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Заявка удалена' });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
