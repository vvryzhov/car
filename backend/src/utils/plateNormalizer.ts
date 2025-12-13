/**
 * Нормализация номеров автомобилей для сравнения
 * Приводит номер к единому формату для корректного сравнения
 */
export function normalizePlate(plate: string): string {
  if (!plate || typeof plate !== 'string') {
    return '';
  }

  // Приводим к верхнему регистру
  let normalized = plate.toUpperCase();

  // Удаляем пробелы, дефисы, точки, подчёркивания
  normalized = normalized.replace(/[\s\-._]/g, '');

  // Удаляем все символы кроме [0-9A-ZА-ЯЁ]
  normalized = normalized.replace(/[^0-9A-ZА-ЯЁ]/g, '');

  // Заменяем похожие латинские символы на кириллицу
  const latinToCyrillic: Record<string, string> = {
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

  normalized = normalized.split('').map(char => latinToCyrillic[char] || char).join('');

  // Заменяем Ё на Е
  normalized = normalized.replace(/Ё/g, 'Е');

  return normalized;
}
