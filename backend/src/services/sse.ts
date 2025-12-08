import { Response } from 'express';

// Хранилище подключенных клиентов SSE
const clients = new Set<Response>();

// Функция для отправки события всем подключенным клиентам
export const broadcastEvent = (event: string, data: any) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const clientsCount = clients.size;
  
  console.log(`📢 Отправка SSE события "${event}" для ${clientsCount} клиентов`, data);
  console.log(`📝 Формат сообщения:`, message.replace(/\n/g, '\\n'));
  
  let sentCount = 0;
  let errorCount = 0;
  
  clients.forEach((client) => {
    try {
      // Проверяем, что соединение еще активно
      if (!client.writable || client.destroyed) {
        console.warn('⚠️ Клиент не доступен для записи, удаляем из списка');
        clients.delete(client);
        errorCount++;
        return;
      }
      
      client.write(message);
      sentCount++;
    } catch (error) {
      // Если клиент отключился, удаляем его из списка
      console.error('❌ Ошибка отправки SSE события:', error);
      clients.delete(client);
      errorCount++;
    }
  });
  
  console.log(`✅ Отправлено: ${sentCount}, Ошибок: ${errorCount}, Всего клиентов: ${clientsCount}`);
  
  if (clientsCount === 0) {
    console.warn('⚠️ Нет подключенных клиентов для отправки события');
  }
};

// Функция для добавления нового клиента
export const addClient = (client: Response) => {
  clients.add(client);
  
  // Отправляем начальное сообщение для установки соединения
  client.write('data: connected\n\n');
  
  // Обработка отключения клиента
  client.on('close', () => {
    clients.delete(client);
  });
  
  // Обработка ошибок
  client.on('error', () => {
    clients.delete(client);
  });
};

// Функция для удаления клиента
export const removeClient = (client: Response) => {
  clients.delete(client);
};

// Получить количество подключенных клиентов
export const getClientsCount = () => clients.size;

