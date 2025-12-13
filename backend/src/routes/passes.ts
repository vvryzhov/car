import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validateVehicleNumber } from '../utils/vehicleNumberValidator';
import { normalizePlate } from '../utils/plateNormalizer';
import * as XLSX from 'xlsx';
import { addClient, broadcastEvent, removeClient, getClientsCount } from '../services/sse';

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
  console.log(`🔌 Новое SSE подключение от пользователя ${req.user!.id} (${req.user!.role})`);
  
  // Устанавливаем заголовки для SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Отключаем буферизацию для nginx
  res.setHeader('Access-Control-Allow-Origin', '*'); // Для CORS, если нужно
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Отключаем таймауты
  res.setTimeout(0);
  req.setTimeout(0);

  // Отправляем заголовки немедленно
  res.flushHeaders();
  console.log(`📤 Заголовки отправлены для пользователя ${req.user!.id}`);

  // Не закрываем соединение автоматически
  res.on('close', () => {
    console.log(`🔌 Response закрыт для пользователя ${req.user!.id}`);
  });

  // Добавляем клиента в список подключенных
  addClient(res);
  console.log(`✅ Клиент добавлен, всего подключено: ${getClientsCount()}`);

  // Отправляем начальное сообщение
  try {
    res.write(': connected\n\n');
    console.log(`📤 Начальное сообщение отправлено пользователю ${req.user!.id}`);
    // Принудительно сбрасываем буфер
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  } catch (error) {
    console.error('Ошибка отправки начального сообщения:', error);
  }

  // Отправляем ping каждые 30 секунд для поддержания соединения
  const pingInterval = setInterval(() => {
    try {
      if (!res.writable || res.destroyed) {
        clearInterval(pingInterval);
        return;
      }
      res.write(': ping\n\n');
    } catch (error) {
      console.error('Ошибка отправки ping:', error);
      clearInterval(pingInterval);
    }
  }, 30000);

  // Очистка при отключении
  req.on('close', () => {
    console.log(`🔌 SSE соединение закрыто для пользователя ${req.user!.id}`);
    clearInterval(pingInterval);
    removeClient(res);
  });

  req.on('error', (error: any) => {
    console.error(`❌ Ошибка SSE соединения для пользователя ${req.user!.id}:`, error);
    clearInterval(pingInterval);
    removeClient(res);
  });
});

// Получить все заявки (для охраны и админа)
router.get('/all', authenticate, requireRole(['security', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, vehicleType, includeDeleted, userId, plotNumber, status, vehicleNumber, isPermanent } = req.query;
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

    // Фильтр по личному транспорту (для админа)
    if (isPermanent !== undefined) {
      if (isPermanent === 'true') {
        query += ` AND (p."isPermanent" = true OR p.status = 'personal_vehicle')`;
      } else if (isPermanent === 'false') {
        query += ` AND (p."isPermanent" IS NULL OR p."isPermanent" = false) AND p.status != 'personal_vehicle'`;
      }
    } else {
      // Если есть поиск по номеру авто, всегда показываем и личный транспорт
      // Если нет поиска по номеру и нет явного фильтра, исключаем постоянные пропуска из обычного списка
      if (!vehicleNumber && req.user!.role !== 'admin') {
        query += ` AND (p."isPermanent" IS NULL OR p."isPermanent" = false)`;
      }
    }

    // Фильтр по дате: не применяем к личному транспорту при поиске по номеру
    if (date) {
      if (vehicleNumber) {
        // При поиске по номеру показываем все, включая личный транспорт (независимо от даты)
        query += ` AND (p."entryDate" = $${paramIndex} OR p."isPermanent" = true OR p.status = 'personal_vehicle')`;
      } else {
        // Обычный фильтр по дате (личный транспорт исключается выше)
        query += ` AND p."entryDate" = $${paramIndex}`;
      }
      params.push(date);
      paramIndex++;
    }

    if (vehicleType) {
      query += ` AND p."vehicleType" = $${paramIndex}`;
      params.push(vehicleType);
      paramIndex++;
    }

    // Фильтр по статусу: если есть поиск по номеру авто, не применяем фильтр по статусу к личному транспорту
    if (status) {
      if (vehicleNumber) {
        // При поиске по номеру показываем все, включая личный транспорт (независимо от статуса)
        query += ` AND (p.status = $${paramIndex} OR p.status = 'personal_vehicle' OR p."isPermanent" = true)`;
      } else {
        // Обычный фильтр по статусу
        query += ` AND p.status = $${paramIndex}`;
      }
      params.push(status);
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

    if (vehicleNumber) {
      query += ` AND p."vehicleNumber" ILIKE $${paramIndex}`;
      params.push(`%${vehicleNumber}%`);
      paramIndex++;
    }

    query += ' ORDER BY p."isPermanent" DESC, p."entryDate" DESC, p."createdAt" DESC';

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
    // Исключаем постоянные пропуска из обычного списка (они показываются отдельно в профиле)
    const passes = await dbAll(
      `SELECT * FROM passes 
       WHERE "userId" = $1 AND "deletedAt" IS NULL 
       AND ("isPermanent" IS NULL OR "isPermanent" = false)
       ORDER BY "entryDate" DESC, "createdAt" DESC`,
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

    // Преобразуем номер в верхний регистр
    const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    // Нормализуем номер для LPR
    const plateNorm = normalizePlate(vehicleNumber);

    try {
      const result = await dbRun(
        'INSERT INTO passes ("userId", "vehicleType", "vehicleBrand", "vehicleNumber", "entryDate", address, "plotNumber", comment, plate_norm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [req.user!.id, vehicleType, vehicleBrand || null, normalizedVehicleNumber, entryDate, address, plotNumber, comment || null, plateNorm]
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

      // Преобразуем номер в верхний регистр, если он изменяется
      const normalizedVehicleNumber = vehicleNumber !== undefined 
        ? vehicleNumber.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '')
        : pass.vehicleNumber;
      
      // Нормализуем номер для LPR, если он изменяется
      const plateNorm = vehicleNumber !== undefined 
        ? normalizePlate(vehicleNumber)
        : pass.plate_norm || normalizePlate(pass.vehicleNumber);

      // Обновляем пропуск
      await dbRun(
        'UPDATE passes SET "vehicleType" = $1, "vehicleBrand" = $2, "vehicleNumber" = $3, "entryDate" = $4, address = $5, "plotNumber" = $6, comment = $7, "securityComment" = $8, status = $9, plate_norm = $10 WHERE id = $11',
        [
          vehicleType !== undefined ? vehicleType : pass.vehicleType,
          vehicleBrand !== undefined ? vehicleBrand : pass.vehicleBrand,
          normalizedVehicleNumber,
          entryDate !== undefined ? entryDate : pass.entryDate,
          address !== undefined ? address : pass.address,
          updatePlotNumber,
          updateComment,
          securityComment !== undefined ? securityComment : pass.securityComment,
          status !== undefined ? status : pass.status,
          plateNorm,
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
    
    // Отправляем событие об удалении заявки через SSE
    broadcastEvent('pass-deleted', { message: 'Заявка удалена', passId: pass.id });
    
    res.json({ message: 'Заявка удалена' });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Экспорт заявок в Excel
router.get('/export/excel', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, vehicleType, userId, plotNumber, isPermanent, vehicleNumber } = req.query;
    
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
          WHEN p.status = 'personal_vehicle' THEN 'Личный транспорт'
          ELSE p.status
        END as "Статус",
        p."createdAt" as "Дата создания"
      FROM passes p
      JOIN users u ON p."userId" = u.id
      WHERE p."deletedAt" IS NULL
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // Фильтр по личному транспорту
    if (isPermanent !== undefined) {
      if (isPermanent === 'true') {
        query += ` AND (p."isPermanent" = true OR p.status = 'personal_vehicle')`;
      } else if (isPermanent === 'false') {
        query += ` AND (p."isPermanent" IS NULL OR p."isPermanent" = false) AND p.status != 'personal_vehicle'`;
      }
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

    if (vehicleNumber) {
      query += ` AND p."vehicleNumber" ILIKE $${paramIndex}`;
      params.push(`%${vehicleNumber}%`);
      paramIndex++;
    }

    query += ' ORDER BY p."isPermanent" DESC, p."entryDate" DESC, p."createdAt" DESC';

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
