import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validateVehicleNumber } from '../utils/vehicleNumberValidator';
import * as XLSX from 'xlsx';
import { addClient, broadcastEvent } from '../services/sse';

const router = express.Router();

// SSE endpoint для получения обновлений в реальном времени (только для охраны)
// Токен передается через query параметр, так как EventSource не поддерживает заголовки
router.get('/events', (req: express.Request, res: Response, next: express.NextFunction) => {
  // Проверяем токен из query параметра
  const token = req.query.token as string;
  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  // Временно добавляем токен в заголовок для middleware
  req.headers.authorization = `Bearer ${token}`;
  next();
}, authenticate, requireRole(['security', 'admin']), (req: AuthRequest, res: Response) => {
  // Устанавливаем заголовки для SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Отключаем буферизацию для nginx

  // Добавляем клиента в список подключенных
  addClient(res);

  // Отправляем ping каждые 30 секунд для поддержания соединения
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (error) {
      clearInterval(pingInterval);
    }
  }, 30000);

  // Очистка при отключении
  req.on('close', () => {
    clearInterval(pingInterval);
  });
});

// Получить все заявки (для охраны и админа)
router.get('/all', authenticate, requireRole(['security', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, vehicleType, includeDeleted, userId, plotNumber } = req.query;
    let query = `
      SELECT p.*, u."fullName", u.phone, p."plotNumber"
      FROM passes p
      JOIN users u ON p."userId" = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (includeDeleted !== 'true') {
      query += ` AND p."deletedAt" IS NULL`;
    }

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

    if (userId) {
      query += ` AND p."userId" = $${paramIndex}`;
      params.push(parseInt(userId as string));
      paramIndex++;
    }

    if (plotNumber) {
      query += ` AND p."plotNumber" ILIKE $${paramIndex}`;
      params.push(`%${plotNumber}%`);
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
      'SELECT * FROM passes WHERE "userId" = $1 AND "deletedAt" IS NULL ORDER BY "entryDate" DESC, "createdAt" DESC',
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

    // Для обычных пользователей не показываем удаленные заявки
    if (req.user!.role !== 'admin' && req.user!.role !== 'security' && pass.deletedAt) {
      return res.status(404).json({ error: 'Заявка не найдена' });
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
  requireRole(['user', 'admin', 'foreman']),
  [
    body('vehicleType').isIn(['грузовой', 'легковой']).withMessage('Тип транспорта должен быть грузовой или легковой'),
    body('vehicleBrand').notEmpty().withMessage('Марка авто обязательна'),
    body('vehicleNumber').notEmpty().withMessage('Номер авто обязателен'),
    body('entryDate').notEmpty().withMessage('Дата въезда обязательна'),
    body('address').notEmpty().withMessage('Адрес обязателен'),
    body('plotNumber').notEmpty().withMessage('Номер участка обязателен'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicleType, vehicleBrand, vehicleNumber, entryDate, address, plotNumber, comment } = req.body;

    // Валидация номера автомобиля
    const numberValidation = validateVehicleNumber(vehicleNumber);
    if (!numberValidation.valid) {
      return res.status(400).json({ error: numberValidation.error });
    }

    try {
      const result = await dbRun(
        'INSERT INTO passes ("userId", "vehicleType", "vehicleBrand", "vehicleNumber", "entryDate", address, "plotNumber", comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [req.user!.id, vehicleType, vehicleBrand || null, vehicleNumber, entryDate, address, plotNumber, comment || null]
      );

      const pass = await dbGet('SELECT * FROM passes WHERE id = $1', [result.rows?.[0]?.id]) as any;
      
      // Отправляем событие о новой заявке через SSE
      broadcastEvent('new-pass', { message: 'Новая заявка создана', passId: pass.id });
      
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
    body('vehicleBrand').optional().notEmpty().withMessage('Марка авто не может быть пустой'),
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

      // Если заявка со статусом "activated" (Заехал), пользователи и прорабы не могут её редактировать
      if (pass.status === 'activated' && (req.user!.role === 'user' || req.user!.role === 'foreman')) {
        return res.status(403).json({ error: 'Нельзя редактировать заявку со статусом "Заехал"' });
      }

      const { 
        vehicleType,
        vehicleBrand,
        vehicleNumber, 
        entryDate, 
        address, 
        comment, 
        securityComment,
        status,
        fullName,
        plotNumber
      } = req.body;

      // Если это охрана, не позволяем менять комментарий пользователя и участок
      const updateComment = req.user!.role === 'admin' ? (comment !== undefined ? comment : pass.comment) : pass.comment;
      // Охрана не может изменять участок
      const updatePlotNumber = req.user!.role === 'security' ? pass.plotNumber : (plotNumber !== undefined ? plotNumber : pass.plotNumber);

      // Обновляем пропуск
      await dbRun(
        'UPDATE passes SET "vehicleType" = $1, "vehicleBrand" = $2, "vehicleNumber" = $3, "entryDate" = $4, address = $5, "plotNumber" = $6, comment = $7, "securityComment" = $8, status = $9 WHERE id = $10',
        [
          vehicleType !== undefined ? vehicleType : pass.vehicleType,
          vehicleBrand !== undefined ? vehicleBrand : pass.vehicleBrand,
          vehicleNumber !== undefined ? vehicleNumber : pass.vehicleNumber,
          entryDate !== undefined ? entryDate : pass.entryDate,
          address !== undefined ? address : pass.address,
          updatePlotNumber,
          updateComment,
          securityComment !== undefined ? securityComment : pass.securityComment,
          status !== undefined ? status : pass.status,
          req.params.id,
        ]
      );

      // Если админ обновляет ФИО, обновляем данные пользователя
      // Охрана не может обновлять участки
      if (req.user!.role === 'admin' && fullName) {
        const user = await dbGet('SELECT * FROM users WHERE id = $1', [pass.userId]) as any;
        if (user) {
          await dbRun(
            'UPDATE users SET "fullName" = $1 WHERE id = $2',
            [fullName, pass.userId]
          );
        }
      }

      // Получаем обновленный пропуск с данными пользователя
      const updatedPass = await dbGet(`
        SELECT p.*, u."fullName", u."plotNumber", u.phone 
        FROM passes p
        JOIN users u ON p."userId" = u.id
        WHERE p.id = $1
      `, [req.params.id]) as any;
      
      // Отправляем событие об обновлении заявки через SSE
      broadcastEvent('pass-updated', { message: 'Заявка обновлена', passId: updatedPass.id });
      
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

    // Если заявка со статусом "activated" (Заехал), пользователи и прорабы не могут её удалять
    if (pass.status === 'activated' && (req.user!.role === 'user' || req.user!.role === 'foreman')) {
      return res.status(403).json({ error: 'Нельзя удалить заявку со статусом "Заехал"' });
    }

    // Мягкое удаление - устанавливаем deletedAt
    await dbRun('UPDATE passes SET "deletedAt" = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ message: 'Заявка удалена' });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Экспорт заявок в Excel
router.get('/export/excel', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, vehicleType, userId, plotNumber } = req.query;
    
    let query = `
      SELECT 
        p.id,
        u."fullName" as "ФИО",
        u.phone as "Телефон",
        p."plotNumber" as "Участок",
        p."vehicleType" as "Тип транспорта",
        p."vehicleBrand" as "Марка авто",
        p."vehicleNumber" as "Номер авто",
        p."entryDate" as "Дата въезда",
        p.address as "Адрес",
        p.comment as "Комментарий",
        p."securityComment" as "Комментарий охраны",
        CASE 
          WHEN p.status = 'pending' THEN 'Ожидает'
          WHEN p.status = 'activated' THEN 'Заехал'
          WHEN p.status = 'rejected' THEN 'Отклонено'
          ELSE p.status
        END as "Статус",
        p."createdAt" as "Дата создания"
      FROM passes p
      JOIN users u ON p."userId" = u.id
      WHERE p."deletedAt" IS NULL
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

    if (userId) {
      query += ` AND p."userId" = $${paramIndex}`;
      params.push(parseInt(userId as string));
      paramIndex++;
    }

    if (plotNumber) {
      query += ` AND p."plotNumber" ILIKE $${paramIndex}`;
      params.push(`%${plotNumber}%`);
      paramIndex++;
    }

    query += ' ORDER BY p."entryDate" DESC, p."createdAt" DESC';

    const passes = await dbAll(query, params) as any[];

    // Форматируем даты для Excel
    const formattedPasses = passes.map(pass => ({
      ...pass,
      'Дата въезда': pass['Дата въезда'] ? new Date(pass['Дата въезда']).toLocaleDateString('ru-RU') : '',
      'Дата создания': pass['Дата создания'] ? new Date(pass['Дата создания']).toLocaleString('ru-RU') : '',
    }));

    // Создаем книгу Excel
    const worksheet = XLSX.utils.json_to_sheet(formattedPasses);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Заявки');

    // Генерируем буфер
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Устанавливаем заголовки для скачивания файла
    const filename = `заявки_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('Ошибка экспорта заявок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
