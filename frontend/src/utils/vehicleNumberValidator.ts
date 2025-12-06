// Валидация номеров автомобилей для разных стран (клиентская версия)

interface ValidationResult {
  valid: boolean;
  error?: string;
  country?: string;
}

// Форматы номеров по странам
const numberFormats = {
  // Российская Федерация: А123БВ777 или А123БВ77
  RU: [
    /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/i, // Старый формат
    /^[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}$/i, // Новый формат (2 буквы)
  ],
  // Украина: АА1234БВ или 1234АА
  UA: [
    /^[АВЕІКМНОРСТХ]{2}\d{4}[АВЕІКМНОРСТХ]{2}$/i,
    /^\d{4}[АВЕІКМНОРСТХ]{2}$/i,
  ],
  // Беларусь: 1234 АВ-1
  BY: [
    /^\d{4}\s?[АВЕКМНОРСТУХ]{2}[-]?\d{1}$/i,
  ],
  // Казахстан: 123 АВС 01
  KZ: [
    /^\d{3}\s?[АВЕКМНОРСТУХ]{3}\s?\d{2}$/i,
  ],
  // Европейские форматы (примеры)
  EU: [
    /^[A-Z]{1,3}\d{1,4}[A-Z]{0,3}$/i, // Германия, Франция и др.
    /^[A-Z]{2}\d{2}\s?\d{2}[A-Z]{2}$/i, // Нидерланды
    /^\d{1,4}[A-Z]{1,3}\d{1,4}$/i, // Италия
  ],
  // США/Канада: ABC-1234 или 123-ABC
  US: [
    /^[A-Z]{1,3}[-]?\d{1,4}$/i,
    /^\d{1,4}[-]?[A-Z]{1,3}$/i,
  ],
};

/**
 * Валидация номера автомобиля
 */
export const validateVehicleNumber = (vehicleNumber: string): ValidationResult => {
  if (!vehicleNumber || vehicleNumber.trim() === '') {
    return { valid: false, error: 'Номер автомобиля обязателен' };
  }

  // Убираем пробелы и дефисы для унификации
  const normalized = vehicleNumber.trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();

  if (normalized.length < 4 || normalized.length > 12) {
    return { valid: false, error: 'Номер должен содержать от 4 до 12 символов' };
  }

  // Проверяем по странам
  for (const [country, patterns] of Object.entries(numberFormats)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return { valid: true, country };
      }
    }
  }

  // Если не подошел ни один формат, но содержит буквы и цифры - разрешаем
  if (/[А-ЯA-Z]/.test(normalized) && /\d/.test(normalized)) {
    return { valid: true };
  }

  // Если только цифры или только буквы - невалидно
  if (/^\d+$/.test(normalized)) {
    return { valid: false, error: 'Номер должен содержать буквы' };
  }

  if (/^[А-ЯA-Z]+$/.test(normalized)) {
    return { valid: false, error: 'Номер должен содержать цифры' };
  }

  return { valid: false, error: 'Некорректный формат номера' };
};

