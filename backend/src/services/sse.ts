import { Response } from 'express';

// Хранилище подключенных клиентов SSE
const clients = new Set<Response>();

// Функция для отправки события всем подключенным клиентам
export const broadcastEvent = (event: string, data: any) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const clientsCount = clients.size;
  
  console.log(`📢 Отправка SSE события "${event}" для ${clientsCount} клиентов`, data);
  
  clients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      // Если клиент отключился, удаляем его из списка
      console.error('Ошибка отправки SSE события:', error);
      clients.delete(client);
    }
  });
  
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

