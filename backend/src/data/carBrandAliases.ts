// Русские алиасы для марок автомобилей
export const carBrandAliases: Record<string, string> = {
  'Тесла': 'Tesla',
  'Тесла Моторс': 'Tesla',
  'Мерседес': 'Mercedes-Benz',
  'Мерседес-Бенц': 'Mercedes-Benz',
  'БМВ': 'BMW',
  'Ауди': 'Audi',
  'Фольксваген': 'Volkswagen',
  'Тойота': 'Toyota',
  'Ниссан': 'Nissan',
  'Хонда': 'Honda',
  'Мазда': 'Mazda',
  'Лада': 'LADA',
  'ВАЗ': 'ВАЗ',
  'УАЗ': 'УАЗ',
  'Порше': 'Porsche',
  'Вольво': 'Volvo',
  'Рено': 'Renault',
  'Форд': 'Ford',
  'Опель': 'Opel',
  'Пежо': 'Peugeot',
  'Шкода': 'Skoda',
  'Киа': 'Kia',
  'Хёндай': 'Hyundai',
  'Шевроле': 'Chevrolet',
  'Лексус': 'Lexus',
  'Инфинити': 'Infiniti',
};

// Функция для получения правильного названия марки по алиасу
export const getBrandByAlias = (input: string): string | null => {
  const normalized = input.trim();
  if (!normalized) return null;
  
  const lowerInput = normalized.toLowerCase();
  for (const [alias, brand] of Object.entries(carBrandAliases)) {
    if (alias.toLowerCase() === lowerInput) {
      return brand;
    }
  }
  
  return null;
};

