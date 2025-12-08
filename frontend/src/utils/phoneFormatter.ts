// Форматирует номер телефона в формат 8 (999) 111-22-33
export const formatPhone = (value: string): string => {
  // Удаляем все нецифровые символы
  const digits = value.replace(/\D/g, '');
  
  // Если начинается не с 8, добавляем 8
  let phone = digits;
  if (phone.length > 0 && phone[0] !== '8') {
    phone = '8' + phone;
  }
  
  // Ограничиваем до 11 цифр (8 + 10 цифр)
  phone = phone.substring(0, 11);
  
  // Форматируем: 8 (999) 111-22-33
  if (phone.length <= 1) {
    return phone;
  } else if (phone.length <= 4) {
    return `${phone[0]} (${phone.substring(1)}`;
  } else if (phone.length <= 7) {
    return `${phone[0]} (${phone.substring(1, 4)}) ${phone.substring(4)}`;
  } else if (phone.length <= 9) {
    return `${phone[0]} (${phone.substring(1, 4)}) ${phone.substring(4, 7)}-${phone.substring(7)}`;
  } else {
    return `${phone[0]} (${phone.substring(1, 4)}) ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9)}`;
  }
};

// Извлекает только цифры из отформатированного номера
export const unformatPhone = (value: string): string => {
  return value.replace(/\D/g, '');
};











