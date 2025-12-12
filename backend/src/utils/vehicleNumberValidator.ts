// Валидация номеров автомобилей (РФ, Казахстан, Узбекистан)

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateVehicleNumber = (number: string): ValidationResult => {
  if (!number || typeof number !== 'string') {
    return { valid: false, error: 'Номер автомобиля обязателен' };
  }

  const trimmed = number.trim().toUpperCase().replace(/\s+/g, '');

  if (trimmed.length === 0) {
    return { valid: false, error: 'Номер автомобиля не может быть пустым' };
  }

  // Формат РФ: А123БВ777 (1 буква, 3 цифры, 2 буквы, 2-3 цифры)
  // Поддерживаем как кириллицу, так и латиницу (A, B, C, E, H, K, M, O, P, T, X, Y)
  const russianFormat = /^[АВЕКМНОРСТУХABCEHKMOPTXY]\d{3}[АВЕКМНОРСТУХABCEHKMOPTXY]{2}\d{2,3}$/;
  
  // Формат Казахстан: 123АВС01 (1-4 цифры, 2-3 буквы, 2 цифры)
  const kazakhstanFormat = /^\d{1,4}[АВЕКМНОРСТУХABCEHKMOPTXY]{2,3}\d{2}$/;
  
  // Формат Узбекистан: 01А123ВС (2 цифры, 1 буква, 3 цифры, 2 буквы)
  const uzbekistanFormat = /^\d{2}[АВЕКМНОРСТУХABCEHKMOPTXY]\d{3}[АВЕКМНОРСТУХABCEHKMOPTXY]{2}$/;

  // Формат Беларусь:
  // 1. 1234 AB-5 — для легковых автомобилей (4 цифры, 2 буквы, дефис, 1 цифра)
  // 2. E123 AB-5 — для электромобилей (буква E, 3 цифры, 2 буквы, дефис, 1 цифра)
  // 3. AB 1234-5 — для грузовых автомобилей и автобусов (2 буквы, 4 цифры, дефис, 1 цифра)
  // 4. A1234B-5 — для прицепов (1 буква, 4 цифры, 1 буква, дефис, 1 цифра)
  // Буквы для белорусских номеров: А, В, Е, К, М, Н, О, Р, С, Т, У, Х, I
  const belarusLetters = '[АВЕКМНОРСТУХABCEHKMOPTXYI]';
  const belarusFormats = [
    new RegExp(`^\\d{4}${belarusLetters}{2}-?\\d$`), // 1234AB-5
    new RegExp(`^[ЕE]\\d{3}${belarusLetters}{2}-?\\d$`), // E123AB-5
    new RegExp(`^${belarusLetters}{2}\\d{4}-?\\d$`), // AB1234-5
    new RegExp(`^${belarusLetters}\\d{4}${belarusLetters}-?\\d$`), // A1234B-5
  ];

  if (russianFormat.test(trimmed)) {
    return { valid: true };
  }

  if (kazakhstanFormat.test(trimmed)) {
    return { valid: true };
  }

  if (uzbekistanFormat.test(trimmed)) {
    return { valid: true };
  }

  for (const belarusFormat of belarusFormats) {
    if (belarusFormat.test(trimmed)) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: 'Неверный формат номера. Используйте формат: РФ (А123БВ777 или A123BC777), Казахстан (123АВС01 или 123ABC01), Узбекистан (01А123ВС или 01A123BC) или Беларусь (1234АВ-5, E123АВ-5, АВ1234-5, А1234В-5)'
  };
};

/**
 * Форматирует номер автомобиля с пробелами для лучшей читаемости
 * Пример: A111AA11 -> A 111 AA 11
 */
export const formatVehicleNumber = (vehicleNumber: string): string => {
  if (!vehicleNumber) return '';
  
  // Убираем все пробелы и дефисы, приводим к верхнему регистру
  const normalized = vehicleNumber.trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  
  if (!normalized) return vehicleNumber; // Если после нормализации пусто, возвращаем исходное
  
  // Российский формат: 1 буква, 3 цифры, 2 буквы, 2-3 цифры (A111AA11 или A111AA777)
  const ruFormat1 = /^([АВЕКМНОРСТУХABCEHKMOPTXY])(\d{3})([АВЕКМНОРСТУХABCEHKMOPTXY]{2})(\d{2,3})$/i;
  if (ruFormat1.test(normalized)) {
    const match = normalized.match(ruFormat1);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
  }
  
  // Российский формат (новый): 2 буквы, 3 цифры, 2-3 цифры (AA11177 или AA111777)
  const ruFormat2 = /^([АВЕКМНОРСТУХABCEHKMOPTXY]{2})(\d{3})(\d{2,3})$/i;
  if (ruFormat2.test(normalized)) {
    const match = normalized.match(ruFormat2);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
  }
  
  // Казахстанский формат: 3 цифры, 3 буквы, 2 цифры (123ABC01)
  const kzFormat = /^(\d{3})([АВЕКМНОРСТУХABCEHKMOPTXY]{3})(\d{2})$/i;
  if (kzFormat.test(normalized)) {
    const match = normalized.match(kzFormat);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
  }
  
  // Узбекский формат: 2 цифры, 1 буква, 3 цифры, 2 буквы (01A123BC)
  const uzFormat = /^(\d{2})([АВЕКМНОРСТУХABCEHKMOPTXY])(\d{3})([АВЕКМНОРСТУХABCEHKMOPTXY]{2})$/i;
  if (uzFormat.test(normalized)) {
    const match = normalized.match(uzFormat);
    if (match) {
      return `${match[1]}${match[2]} ${match[3]} ${match[4]}`;
    }
  }

  // Белорусский формат 1: 4 цифры, 2 буквы, 1 цифра региона (1234 AB-5)
  const byFormat1 = /^(\d{4})([АВЕКМНОРСТУХABCEHKMOPTXYI]{2})-?(\d)$/i;
  if (byFormat1.test(normalized)) {
    const match = normalized.match(byFormat1);
    if (match) {
      return `${match[1]} ${match[2]}-${match[3]}`;
    }
  }

  // Белорусский формат 2: буква E, 3 цифры, 2 буквы, 1 цифра региона (E123 AB-5)
  const byFormat2 = /^([ЕE])(\d{3})([АВЕКМНОРСТУХABCEHKMOPTXYI]{2})-?(\d)$/i;
  if (byFormat2.test(normalized)) {
    const match = normalized.match(byFormat2);
    if (match) {
      return `${match[1]}${match[2]} ${match[3]}-${match[4]}`;
    }
  }

  // Белорусский формат 3: 2 буквы, 4 цифры, 1 цифра региона (AB 1234-5)
  const byFormat3 = /^([АВЕКМНОРСТУХABCEHKMOPTXYI]{2})(\d{4})-?(\d)$/i;
  if (byFormat3.test(normalized)) {
    const match = normalized.match(byFormat3);
    if (match) {
      return `${match[1]} ${match[2]}-${match[3]}`;
    }
  }

  // Белорусский формат 4: 1 буква, 4 цифры, 1 буква, 1 цифра региона (A1234B-5)
  const byFormat4 = /^([АВЕКМНОРСТУХABCEHKMOPTXYI])(\d{4})([АВЕКМНОРСТУХABCEHKMOPTXYI])-?(\d)$/i;
  if (byFormat4.test(normalized)) {
    const match = normalized.match(byFormat4);
    if (match) {
      return `${match[1]}${match[2]}${match[3]}-${match[4]}`;
    }
  }
  
  // Универсальный формат: если номер содержит буквы и цифры, пытаемся разбить по группам
  const parts: string[] = [];
  let currentPart = '';
  let lastType: 'letter' | 'digit' | null = null;
  
  for (const char of normalized) {
    const isLetter = /[А-ЯA-Z]/.test(char);
    const isDigit = /\d/.test(char);
    const currentType = isLetter ? 'letter' : isDigit ? 'digit' : null;
    
    if (currentType && currentType !== lastType && currentPart) {
      parts.push(currentPart);
      currentPart = char;
    } else {
      currentPart += char;
    }
    
    lastType = currentType || lastType;
  }
  
  if (currentPart) {
    parts.push(currentPart);
  }
  
  // Если удалось разбить на части, объединяем с пробелами
  if (parts.length > 1) {
    return parts.join(' ');
  }
  
  // Если не удалось определить формат, возвращаем исходное значение
  return vehicleNumber;
};

