import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbGet, dbRun, dbAll } from '../database';
import { requireLprToken } from '../middleware/lprAuth';
import { normalizePlate } from '../utils/plateNormalizer';
import { randomUUID } from 'crypto';

const router = express.Router();

// Все эндпоинты LPR требуют токен
router.use(requireLprToken);

/**
 * POST /api/lpr/check
 * Проверяет, разрешён ли проезд для номера
 */
router.post(
  '/check',
  [
    body('plate').notEmpty().withMessage('plate обязателен'),
    body('gateId').optional().isString(),
    body('capturedAt').optional().isISO8601(),
    body('confidence').optional().isFloat({ min: 0, max: 1 }),
  ],
  async (req: express.Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { plate, gateId = 'main', capturedAt, confidence } = req.body;

    try {
      // Нормализуем номер
      const plateNorm = normalizePlate(plate);

      if (!plateNorm) {
        return res.status(200).json({
          allowed: false,
          reason: 'PLATE_INVALID',
          plateNorm: '',
          cooldownSeconds: parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10),
        });
      }

      // Определяем "сегодня" в локальной временной зоне
      // Используем временную зону из переменной окружения или по умолчанию Asia/Almaty
      const timezone = process.env.TZ || 'Asia/Almaty';
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD

      // Записываем событие CHECK_SENT
      const requestId = randomUUID();
      await dbRun(
        `INSERT INTO lpr_events (gate_id, event_type, plate_raw, plate_norm, confidence, request_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          gateId,
          'CHECK_SENT',
          plate,
          plateNorm,
          confidence || null,
          requestId,
          JSON.stringify({ ...req.body, requestId }),
        ]
      );

      // Ищем активную заявку
      // MVP: ищем по plate_norm, entryDate = сегодня, status = 'pending' (Ожидает)
      const allowedStatuses = (process.env.LPR_ALLOWED_STATUSES || 'pending').split(',').map(s => s.trim());

      const pass = await dbGet(
        `SELECT id, status, "entryDate", "vehicleNumber", plate_norm
         FROM passes
         WHERE plate_norm = $1
           AND "entryDate" = $2
           AND status = ANY($3)
           AND "deletedAt" IS NULL
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [plateNorm, todayStr, allowedStatuses]
      );

      if (pass) {
        // Найдена активная заявка
        const cooldownSeconds = parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10);

        // Записываем событие DECISION_ALLOW
        await dbRun(
          `INSERT INTO lpr_events (gate_id, event_type, plate_raw, plate_norm, confidence, pass_id, request_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            gateId,
            'DECISION_ALLOW',
            plate,
            plateNorm,
            confidence || null,
            pass.id,
            requestId,
            JSON.stringify({ reason: 'ACTIVE_PASS_FOUND', passId: pass.id }),
          ]
        );

        return res.json({
          allowed: true,
          reason: 'ACTIVE_PASS_FOUND',
          passId: pass.id,
          plateNorm,
          cooldownSeconds,
        });
      } else {
        // Заявка не найдена
        const cooldownSeconds = parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10);

        // Записываем событие DECISION_DENY
        await dbRun(
          `INSERT INTO lpr_events (gate_id, event_type, plate_raw, plate_norm, confidence, request_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            gateId,
            'DECISION_DENY',
            plate,
            plateNorm,
            confidence || null,
            requestId,
            JSON.stringify({ reason: 'NO_ACTIVE_PASS' }),
          ]
        );

        return res.json({
          allowed: false,
          reason: 'NO_ACTIVE_PASS',
          plateNorm,
          cooldownSeconds,
        });
      }
    } catch (error: any) {
      console.error('Ошибка проверки пропуска LPR:', error);

      // Записываем событие SYSTEM_TEMP_UNAVAILABLE
      try {
        await dbRun(
          `INSERT INTO lpr_events (gate_id, event_type, plate_raw, plate_norm, request_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            gateId,
            'SYSTEM_TEMP_UNAVAILABLE',
            plate,
            normalizePlate(plate),
            randomUUID(),
            JSON.stringify({ error: error.message }),
          ]
        );
      } catch (e) {
        // Игнорируем ошибку записи события
      }

      // Возвращаем ошибку, но HTTP 200 чтобы агент не падал
      return res.status(200).json({
        allowed: false,
        reason: 'SYSTEM_TEMP_UNAVAILABLE',
        plateNorm: normalizePlate(plate),
        cooldownSeconds: parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10),
      });
    }
  }
);

/**
 * POST /api/lpr/event
 * Сохраняет событие от LPR Agent
 */
router.post(
  '/event',
  [
    body('gateId').notEmpty().withMessage('gateId обязателен'),
    body('eventType').isIn([
      'PLATE_DETECTED',
      'CHECK_SENT',
      'DECISION_ALLOW',
      'DECISION_DENY',
      'GATE_OPENED',
      'OPEN_FAILED',
      'SYSTEM_UNAVAILABLE',
      'CAR_ENTERED',
    ]).withMessage('Недопустимый eventType'),
    body('eventAt').optional().isISO8601(),
    body('plate').optional().isString(),
    body('passId').optional().isInt(),
    body('requestId').optional().isUUID(),
    body('confidence').optional().isFloat({ min: 0, max: 1 }),
  ],
  async (req: express.Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gateId, eventType, eventAt, plate, passId, requestId, confidence, meta } = req.body;

    try {
      // Нормализуем номер, если есть
      const plateNorm = plate ? normalizePlate(plate) : null;

      // Сохраняем событие
      await dbRun(
        `INSERT INTO lpr_events (gate_id, event_type, plate_raw, plate_norm, confidence, pass_id, request_id, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          gateId,
          eventType,
          plate || null,
          plateNorm,
          confidence || null,
          passId || null,
          requestId || null,
          JSON.stringify({ ...req.body, meta: meta || {} }),
          eventAt ? new Date(eventAt) : new Date(),
        ]
      );

      // Если событие GATE_OPENED или CAR_ENTERED и есть passId - обновляем статус заявки
      if ((eventType === 'GATE_OPENED' || eventType === 'CAR_ENTERED') && passId) {
        const allowRepeatAfterEntered = process.env.LPR_ALLOW_REPEAT_AFTER_ENTERED === 'true';

        // Проверяем текущий статус
        const currentPass = await dbGet('SELECT status FROM passes WHERE id = $1', [passId]);

        if (currentPass && (allowRepeatAfterEntered || currentPass.status === 'pending')) {
          // Обновляем статус на 'activated' (Заехал)
          await dbRun(
            `UPDATE passes 
             SET status = 'activated', "updatedAt" = NOW() 
             WHERE id = $1`,
            [passId]
          );

          console.log(`✅ Заявка #${passId} переведена в статус "Заехал" после события ${eventType}`);
        }
      }

      return res.json({ ok: true });
    } catch (error: any) {
      console.error('Ошибка сохранения события LPR:', error);
      return res.status(500).json({ error: 'Ошибка сохранения события' });
    }
  }
);

export default router;
