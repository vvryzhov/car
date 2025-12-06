// Русские алиасы для марок автомобилей
// Маппинг: русское название -> английское название
export const carBrandAliases: Record<string, string> = {
  // Популярные марки
  'Тесла': 'Tesla',
  'Тесла Моторс': 'Tesla',
  
  'Мерседес': 'Mercedes-Benz',
  'Мерседес-Бенц': 'Mercedes-Benz',
  'Мерседес Бенц': 'Mercedes-Benz',
  'Мерседес Бенс': 'Mercedes-Benz',
  
  'БМВ': 'BMW',
  'Би-Эм-Вэ': 'BMW',
  
  'Ауди': 'Audi',
  
  'Фольксваген': 'Volkswagen',
  'Фольксваг': 'Volkswagen',
  
  'Тойота': 'Toyota',
  'Тойот': 'Toyota',
  
  'Ниссан': 'Nissan',
  'Нисан': 'Nissan',
  
  'Хонда': 'Honda',
  
  'Мазда': 'Mazda',
  'Мазд': 'Mazda',
  
  'Субару': 'Subaru',
  
  'Митсубиси': 'Mitsubishi',
  'Митсубиши': 'Mitsubishi',
  
  'Лексус': 'Lexus',
  'Лекс': 'Lexus',
  
  'Хёндай': 'Hyundai',
  'Хендай': 'Hyundai',
  
  'Киа': 'Kia',
  'КИА': 'Kia',
  
  'Шкода': 'Skoda',
  'Шкод': 'Skoda',
  
  'Пежо': 'Peugeot',
  
  'Рено': 'Renault',
  
  'Ситроен': 'Citroen',
  'Ситроён': 'Citroën',
  
  'Опель': 'Opel',
  'Опел': 'Opel',
  
  'Форд': 'Ford',
  
  'Шевроле': 'Chevrolet',
  
  'Додж': 'Dodge',
  
  'Джип': 'Jeep',
  
  'Лада': 'LADA',
  'ВАЗ': 'ВАЗ',
  'Ваз': 'ВАЗ',
  
  'ГАЗ': 'ГАЗ',
  'Газ': 'ГАЗ',
  'Газель': 'Газель',
  
  'УАЗ': 'УАЗ',
  'Уаз': 'УАЗ',
  
  'Камаз': 'KamAZ',
  'КАМАЗ': 'КАМАЗ',
  'КамАЗ': 'KamAZ',
  
  'МАЗ': 'МАЗ',
  'Маз': 'МАЗ',
  
  'Порше': 'Porsche',
  'Порш': 'Porsche',
  
  'Феррари': 'Ferrari',
  
  'Ламборгини': 'Lamborghini',
  
  'Бентли': 'Bentley',
  
  'Роллс-Ройс': 'Rolls-Royce',
  'Роллс Ройс': 'Rolls-Royce',
  
  'Ягуар': 'Jaguar',
  
  'Астон Мартин': 'Aston Martin',
  
  'Макларен': 'McLaren',
  
  'Мазерати': 'Maserati',
  
  'Вольво': 'Volvo',
  'Вольв': 'Volvo',
  
  'Линкольн': 'Lincoln',
  
  'Кадиллак': 'Cadillac',
  
  'Джи-Эм-Си': 'GMC',
  'GMC': 'GMC',
  
  'Хаммер': 'Hummer',
  
  'Москвич': 'Москвич',
  
  'Генезис': 'Genesis',
  
  'Инфинити': 'Infiniti',
  
  'Акура': 'Acura',
  
  'Ссанг-Йонг': 'SsangYong',
  'Ссанг Йонг': 'SsangYong',
  
  'Би-Уай-Ди': 'BYD',
  'BYD': 'BYD',
  
  'Чери': 'Chery',
  
  'Гили': 'Geely',
  
  'Хавейл': 'Haval',
  
  'Грейт Волл': 'Great Wall',
  
  'Лада ВАЗ': 'Lada (ВАЗ)',
  
  'Альфа Ромео': 'Alfa Romeo',
  
  'Фиат': 'Fiat',
  
  'Сеат': 'SEAT',
  'SEAT': 'SEAT',
  
  'Дачия': 'Dacia',
  
  'МГ': 'MG',
  'MG': 'MG',
  
  'Мини': 'Mini',
  
  'Смарт': 'Smart',
  
  'Лотус': 'Lotus',
  
  'Морган': 'Morgan',
  
  'Ровер': 'Rover',
  
  'Сааб': 'Saab',
  
  'Тата': 'Tata',
  
  'Дэу': 'Daewoo',
  
  'Равон': 'Ravon',
  
  'Дацун': 'Datsun',
  
  'Скания': 'Scania',
  
  'Ивеко': 'Iveco',
  
  'МАН': 'MAN',
  'MAN': 'MAN',
  
  'Польстар': 'Polestar',
  
  'Ривиан': 'Rivian',
  
  'Люсид': 'Lucid',
  
  'Фискер': 'Fisker',
  
  'Сяоми': 'Xiaomi',
  
  'Нио': 'Nio',
  
  'Зикр': 'Zeekr',
  
  'Сюпен': 'Xpeng',
};

// Функция для получения правильного названия марки по алиасу
export const getBrandByAlias = (input: string): string | null => {
  const normalized = input.trim();
  if (!normalized) return null;
  
  // Проверяем точное совпадение (без учета регистра)
  const lowerInput = normalized.toLowerCase();
  for (const [alias, brand] of Object.entries(carBrandAliases)) {
    if (alias.toLowerCase() === lowerInput) {
      return brand;
    }
  }
  
  return null;
};

// Функция для поиска марок по частичному совпадению (включая алиасы)
export const searchBrands = (query: string, brands: string[]): string[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  
  const results = new Set<string>();
  
  // Сначала проверяем алиасы
  for (const [alias, brand] of Object.entries(carBrandAliases)) {
    if (alias.toLowerCase().includes(normalizedQuery)) {
      results.add(brand);
    }
  }
  
  // Затем проверяем сами марки
  for (const brand of brands) {
    if (brand.toLowerCase().includes(normalizedQuery)) {
      results.add(brand);
    }
  }
  
  return Array.from(results).slice(0, 5); // Максимум 5 результатов
};
