import { useState, useEffect } from 'react';

const DateTimeDisplay = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000); // Обновляем каждую секунду

    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      padding: '8px 12px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      fontSize: '14px',
      fontWeight: '500',
      color: '#333',
      zIndex: 1000,
      fontFamily: 'monospace',
    }}>
      {formatDateTime(dateTime)}
    </div>
  );
};

export default DateTimeDisplay;

