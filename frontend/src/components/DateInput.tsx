import { useState, useEffect } from 'react';

interface DateInputProps {
  value: string; // Формат YYYY-MM-DD для внутреннего хранения
  onChange: (value: string) => void; // Возвращает YYYY-MM-DD
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

const DateInput = ({ value, onChange, id, required, disabled }: DateInputProps) => {
  // Конвертация YYYY-MM-DD в DD-MM-YYYY для отображения
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Конвертация DD-MM-YYYY в YYYY-MM-DD для сохранения
  const parseDateInput = (inputStr: string): string | null => {
    if (!inputStr) return null;
    // Убираем все кроме цифр и дефисов
    const cleaned = inputStr.replace(/[^\d-]/g, '');
    // Удаляем лишние дефисы
    const parts = cleaned.split('-').filter(p => p);
    
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      
      // Если год введен двумя цифрами, дополняем до 2000-2099
      const fullYear = year.length === 2 ? `20${year}` : year;
      
      // Проверяем валидность даты
      const date = new Date(`${fullYear}-${month}-${day}`);
      if (!isNaN(date.getTime()) && 
          date.getDate() === parseInt(day) && 
          date.getMonth() + 1 === parseInt(month)) {
        return `${fullYear}-${month}-${day}`;
      }
    }
    return null;
  };

  const [displayValue, setDisplayValue] = useState(formatDateForDisplay(value));

  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);
    
    const parsed = parseDateInput(input);
    if (parsed) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseDateInput(displayValue);
    if (parsed) {
      setDisplayValue(formatDateForDisplay(parsed));
      onChange(parsed);
    } else if (displayValue) {
      // Если введено что-то невалидное, пробуем исправить или сбрасываем
      const currentParsed = parseDateInput(value);
      if (currentParsed) {
        setDisplayValue(formatDateForDisplay(currentParsed));
      } else {
        setDisplayValue('');
      }
    }
  };

  return (
    <input
      type="text"
      id={id}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="дд-мм-гггг"
      required={required}
      disabled={disabled}
      pattern="\d{2}-\d{2}-\d{4}"
      maxLength={10}
      style={{
        fontFamily: 'monospace',
      }}
    />
  );
};

export default DateInput;

