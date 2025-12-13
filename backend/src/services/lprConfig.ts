import { dbGet } from '../database';

/**
 * Получить настройки LPR из БД
 * Использует значения из БД, с fallback на переменные окружения
 */
export async function getLprConfig() {
  try {
    const settings = await dbGet('SELECT * FROM lpr_settings ORDER BY id DESC LIMIT 1');
    
    if (settings) {
      return {
        cooldownSeconds: settings.cooldown_seconds || parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10),
        allowedStatuses: (settings.allowed_statuses || process.env.LPR_ALLOWED_STATUSES || 'pending')
          .split(',')
          .map((s: string) => s.trim()),
        allowRepeatAfterEntered: settings.allow_repeat_after_entered !== undefined 
          ? settings.allow_repeat_after_entered 
          : process.env.LPR_ALLOW_REPEAT_AFTER_ENTERED === 'true',
        timezone: settings.timezone || process.env.TZ || 'Asia/Almaty',
      };
    }
  } catch (error) {
    console.error('Ошибка получения настроек LPR из БД:', error);
  }

  // Fallback на переменные окружения
  return {
    cooldownSeconds: parseInt(process.env.LPR_COOLDOWN_SECONDS || '15', 10),
    allowedStatuses: (process.env.LPR_ALLOWED_STATUSES || 'pending').split(',').map(s => s.trim()),
    allowRepeatAfterEntered: process.env.LPR_ALLOW_REPEAT_AFTER_ENTERED === 'true',
    timezone: process.env.TZ || 'Asia/Almaty',
  };
}
