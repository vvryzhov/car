// Валидация номеров автомобилей (РФ, Казахстан, Узбекистан)

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Функция для конвертации латинских букв в кириллические (для номеров)
const convertLatinToCyrillic = (text: string): string => {
  const mapping: { [key: string]: string } = {
    'A': 'А',
    'B': 'В',
    'C': 'С',
    'E': 'Е',
    'H': 'Н',
    'K': 'К',
    'M': 'М',
    'O': 'О',
    'P': 'Р',
    'T': 'Т',
    'X': 'Х',
    'Y': 'У',
  };

  return text.split('').map(char => mapping[char] || char).join('');
};

export const validateVehicleNumber = (number: string): ValidationResult => {
  if (!number || typeof number !== 'string') {
    return { valid: false, error: 'Номер автомобиля обязателен' };
  }

  const trimmed = number.trim().toUpperCase().replace(/\s+/g, '');

  if (trimmed.length === 0) {
    return { valid: false, error: 'Номер автомобиля не может быть пустым' };
  }

  // Конвертируем латинские буквы в кириллические для проверки
  const converted = convertLatinToCyrillic(trimmed);

  // Формат РФ: А123БВ777 (1 буква, 3 цифры, 2 буквы, 2-3 цифры)
  // Поддерживаем как кириллицу, так и латиницу
  const russianFormat = /^[АВЕКМНОРСТУХABCEHKMOPTXY]\d{3}[АВЕКМНОРСТУХABCEHKMOPTXY]{2}\d{2,3}$/;
  
  // Формат Казахстан: 123АВС01 (1-4 цифры, 2-3 буквы, 2 цифры)
  const kazakhstanFormat = /^\d{1,4}[АВЕКМНОРСТУХABCEHKMOPTXY]{2,3}\d{2}$/;
  
  // Формат Узбекистан: 01А123ВС (2 цифры, 1 буква, 3 цифры, 2 буквы)
  const uzbekistanFormat = /^\d{2}[АВЕКМНОРСТУХABCEHKMOPTXY]\d{3}[АВЕКМНОРСТУХABCEHKMOPTXY]{2}$/;

  // Проверяем оригинальный формат (с латиницей)
  if (russianFormat.test(trimmed)) {
    return { valid: true };
  }

  if (kazakhstanFormat.test(trimmed)) {
    return { valid: true };
  }

  if (uzbekistanFormat.test(trimmed)) {
    return { valid: true };
  }

  // Проверяем конвертированный формат (кириллица)
  if (russianFormat.test(converted)) {
    return { valid: true };
  }

  if (kazakhstanFormat.test(converted)) {
    return { valid: true };
  }

  if (uzbekistanFormat.test(converted)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Неверный формат номера. Используйте формат РФ (А123БВ777 или A123BC777), Казахстан (123АВС01 или 123ABC01) или Узбекистан (01А123ВС или 01A123BC)'
  };
};

