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
  const russianFormat = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;
  
  // Формат Казахстан: 123АВС01 (1-4 цифры, 2-3 буквы, 2 цифры)
  const kazakhstanFormat = /^\d{1,4}[АВЕКМНОРСТУХ]{2,3}\d{2}$/;
  
  // Формат Узбекистан: 01А123ВС (2 цифры, 1 буква, 3 цифры, 2 буквы)
  const uzbekistanFormat = /^\d{2}[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}$/;

  if (russianFormat.test(trimmed)) {
    return { valid: true };
  }

  if (kazakhstanFormat.test(trimmed)) {
    return { valid: true };
  }

  if (uzbekistanFormat.test(trimmed)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Неверный формат номера. Используйте формат РФ (А123БВ777), Казахстан (123АВС01) или Узбекистан (01А123ВС)'
  };
};

