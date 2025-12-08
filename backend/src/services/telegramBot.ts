import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { dbGet, dbRun, dbAll } from '../database';
import crypto from 'crypto';
import { validateVehicleNumber } from '../utils/vehicleNumberValidator';
import { getBrandByAlias } from '../data/carBrandAliases';
import { broadcastEvent } from './sse';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

let bot: TelegramBot | null = null;

// Хранилище состояний пользователей (в production лучше использовать Redis или БД)
interface UserState {
  action: 'creating_pass' | 'waiting_vehicle_type' | 'waiting_vehicle_brand' | 'waiting_vehicle_number' | 'waiting_entry_date' | 'waiting_plot' | 'waiting_comment';
  data?: any;
}

const userStates = new Map<number, UserState>();

export const initTelegramBot = () => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN не установлен, бот не будет запущен');
    return null;
  }

  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  // Команда /start
  bot.onText(/\/start/, async (msg: Message) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      bot?.sendMessage(chatId, 'Ошибка: не удалось определить ваш Telegram ID');
      return;
    }

    // Проверяем, привязан ли аккаунт
    const user = await dbGet('SELECT id, "fullName", email FROM users WHERE "telegramId" = $1', [telegramId]) as any;
    
    if (user) {
      const welcomeText = `
👋 Добро пожаловать, ${user.fullName}!

Вы уже привязали свой Telegram аккаунт.

📋 Доступные команды:
/create - Создать новую заявку на пропуск
/list - Просмотреть мои заявки
/help - Справка

Для управления профилем и всеми функциями используйте веб-интерфейс:
https://пропуск.аносинопарк.рф
      `.trim();
      bot?.sendMessage(chatId, welcomeText);
    } else {
      const welcomeText = `
👋 Добро пожаловать в систему управления пропусками!

Для использования бота необходимо привязать ваш Telegram аккаунт к аккаунту в системе.

🔗 Как привязать:
1. Перейдите в веб-интерфейс: https://пропуск.аносинопарк.рф
2. Войдите в свой аккаунт
3. Перейдите в раздел "Профиль"
4. Найдите кнопку "Привязать Telegram" или используйте команду /link

Или используйте команду /link прямо сейчас, если у вас есть код привязки.
      `.trim();
      bot?.sendMessage(chatId, welcomeText);
    }
  });

  // Команда /link
  bot.onText(/\/link (.+)/, async (msg: Message, match: RegExpExecArray | null) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const token = match?.[1];

    if (!telegramId || !token) {
      bot?.sendMessage(chatId, 'Использование: /link <код_привязки>\n\nПолучите код в веб-интерфейсе в разделе "Профиль".');
      return;
    }

    try {
      const linkToken = await dbGet(
        'SELECT * FROM telegram_link_tokens WHERE token = $1 AND "expiresAt" > NOW()',
        [token]
      ) as any;

      if (!linkToken) {
        bot?.sendMessage(chatId, '❌ Недействительный или истекший код привязки.\n\nПолучите новый код в веб-интерфейсе.');
        return;
      }

      // Проверяем, не привязан ли уже этот Telegram ID
      const existingUser = await dbGet('SELECT id FROM users WHERE "telegramId" = $1', [telegramId]) as any;
      if (existingUser) {
        bot?.sendMessage(chatId, '❌ Этот Telegram аккаунт уже привязан к другому пользователю');
        return;
      }

      // Проверяем, не привязан ли уже этот пользователь к другому Telegram
      const user = await dbGet('SELECT id, "fullName", "telegramId" FROM users WHERE id = $1', [linkToken.userId]) as any;
      if (user.telegramId) {
        bot?.sendMessage(chatId, '❌ Этот аккаунт уже привязан к другому Telegram аккаунту');
        return;
      }

      // Обновляем токен с реальным Telegram ID
      await dbRun(
        'UPDATE telegram_link_tokens SET "telegramId" = $1 WHERE token = $2',
        [telegramId, token]
      );

      // Привязываем Telegram ID к пользователю
      await dbRun(
        'UPDATE users SET "telegramId" = $1 WHERE id = $2',
        [telegramId, linkToken.userId]
      );

      // Удаляем использованный токен
      await dbRun('DELETE FROM telegram_link_tokens WHERE token = $1', [token]);
      
      bot?.sendMessage(chatId, `✅ Аккаунт успешно привязан! Добро пожаловать, ${user.fullName}!\n\nИспользуйте /start для просмотра команд.`);
    } catch (error) {
      console.error('Ошибка привязки Telegram:', error);
      bot?.sendMessage(chatId, '❌ Ошибка при привязке аккаунта. Попробуйте позже.');
    }
  });

  // Команда /create
  bot.onText(/\/create/, async (msg: Message) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      bot?.sendMessage(chatId, 'Ошибка: не удалось определить ваш Telegram ID');
      return;
    }

    const user = await dbGet('SELECT id, role FROM users WHERE "telegramId" = $1', [telegramId]) as any;
    
    if (!user) {
      bot?.sendMessage(chatId, '❌ Ваш Telegram аккаунт не привязан. Используйте /link для привязки.');
      return;
    }

    if (user.role !== 'user' && user.role !== 'foreman' && user.role !== 'admin') {
      bot?.sendMessage(chatId, '❌ У вас нет прав на создание заявок');
      return;
    }

    // Проверяем наличие участков
    const plots = await dbAll(
      'SELECT id, address, "plotNumber" FROM user_plots WHERE "userId" = $1',
      [user.id]
    ) as any[];

    if (plots.length === 0) {
      bot?.sendMessage(chatId, '❌ У вас нет добавленных участков. Добавьте участок в веб-интерфейсе.');
      return;
    }

    // Инициализируем состояние создания заявки
    userStates.set(telegramId, {
      action: 'waiting_vehicle_type',
      data: { userId: user.id, plots }
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚗 Легковой', callback_data: 'vehicle_type:легковой' }],
          [{ text: '🚚 Грузовой', callback_data: 'vehicle_type:грузовой' }]
        ]
      }
    };

    bot?.sendMessage(chatId, '📝 Создание новой заявки на пропуск\n\nВыберите тип транспорта:', keyboard);
  });

  // Обработка callback кнопок
  bot.on('callback_query', async (query: CallbackQuery) => {
    const chatId = query.message?.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (!chatId || !telegramId || !data) return;

    await bot?.answerCallbackQuery(query.id);

    const state = userStates.get(telegramId);
    
    if (!state || !state.data) {
      bot?.sendMessage(chatId, '❌ Сессия истекла. Начните заново с команды /create');
      return;
    }

    // Обработка выбора типа транспорта
    if (data.startsWith('vehicle_type:')) {
      const vehicleType = data.split(':')[1];
      state.data.vehicleType = vehicleType;
      state.action = 'waiting_vehicle_brand';
      userStates.set(telegramId, state);

      bot?.sendMessage(chatId, `✅ Тип транспорта: ${vehicleType}\n\n✍️ Введите марку автомобиля (например: Toyota, BMW, Лада):`);
    }
    // Обработка выбора участка
    else if (data.startsWith('plot:')) {
      const plotId = parseInt(data.split(':')[1]);
      const plot = state.data.plots.find((p: any) => p.id === plotId);
      
      if (plot) {
        state.data.plotId = plotId;
        state.data.address = plot.address || plot.plotNumber;
        state.data.plotNumber = plot.plotNumber;
        state.action = 'waiting_comment';
        userStates.set(telegramId, state);

        bot?.sendMessage(chatId, `✅ Участок: ${plot.plotNumber}\nАдрес: ${plot.address || plot.plotNumber}\n\n💬 Введите комментарий (или отправьте "-" для пропуска):`);
      }
    }
  });

  // Обработка текстовых сообщений для создания заявки
  bot.on('message', async (msg: Message) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const text = msg.text;

    // Пропускаем команды и сообщения без текста
    if (!telegramId || !text || text.startsWith('/')) return;

    const state = userStates.get(telegramId);
    if (!state || !state.data) return;

    try {
      switch (state.action) {
        case 'waiting_vehicle_brand': {
          let vehicleBrand = text.trim();
          // Проверяем алиасы
          const aliasBrand = getBrandByAlias(vehicleBrand);
          if (aliasBrand) {
            vehicleBrand = aliasBrand;
          }
          
          state.data.vehicleBrand = vehicleBrand;
          state.action = 'waiting_vehicle_number';
          userStates.set(telegramId, state);

          bot?.sendMessage(chatId, `✅ Марка: ${vehicleBrand}\n\n🔢 Введите номер автомобиля (например: А123БВ777):`);
          break;
        }

        case 'waiting_vehicle_number': {
          const validation = validateVehicleNumber(text.trim());
          if (!validation.valid) {
            bot?.sendMessage(chatId, `❌ ${validation.error}\n\nПопробуйте еще раз:`);
            return;
          }

          state.data.vehicleNumber = text.trim().toUpperCase();
          state.action = 'waiting_entry_date';
          userStates.set(telegramId, state);

          const today = new Date().toISOString().split('T')[0];
          bot?.sendMessage(chatId, `✅ Номер: ${state.data.vehicleNumber}\n\n📅 Введите дату въезда в формате ГГГГ-ММ-ДД (например: ${today}):`);
          break;
        }

        case 'waiting_entry_date': {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(text.trim())) {
            bot?.sendMessage(chatId, '❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД (например: 2024-12-25)');
            return;
          }

          const entryDate = new Date(text.trim());
          if (isNaN(entryDate.getTime())) {
            bot?.sendMessage(chatId, '❌ Неверная дата. Попробуйте еще раз:');
            return;
          }

          state.data.entryDate = text.trim();
          state.action = 'waiting_plot';
          userStates.set(telegramId, state);

          // Создаем клавиатуру с участками
          const plotButtons = state.data.plots.map((plot: any) => [
            { text: `${plot.plotNumber} - ${plot.address || 'Без адреса'}`, callback_data: `plot:${plot.id}` }
          ]);

          const keyboard = {
            reply_markup: {
              inline_keyboard: plotButtons
            }
          };

          bot?.sendMessage(chatId, `✅ Дата въезда: ${text.trim()}\n\n🏠 Выберите участок:`, keyboard);
          break;
        }

        case 'waiting_comment': {
          state.data.comment = text.trim() === '-' ? null : text.trim();
          userStates.set(telegramId, state);

          // Создаем заявку
          await createPassFromBot(state.data);

          userStates.delete(telegramId);

          bot?.sendMessage(chatId, '✅ Заявка успешно создана!\n\nИспользуйте /list для просмотра ваших заявок.');
          break;
        }
      }
    } catch (error: any) {
      console.error('Ошибка обработки сообщения:', error);
      bot?.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз или начните заново с /create');
      userStates.delete(telegramId);
    }
  });

  // Команда /list
  bot.onText(/\/list/, async (msg: Message) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      bot?.sendMessage(chatId, 'Ошибка: не удалось определить ваш Telegram ID');
      return;
    }

    const user = await dbGet('SELECT id FROM users WHERE "telegramId" = $1', [telegramId]) as any;
    
    if (!user) {
      bot?.sendMessage(chatId, '❌ Ваш Telegram аккаунт не привязан. Используйте /link для привязки.');
      return;
    }

    try {
      const passes = await dbAll(
        'SELECT * FROM passes WHERE "userId" = $1 AND "deletedAt" IS NULL ORDER BY "entryDate" DESC, "createdAt" DESC LIMIT 10',
        [user.id]
      ) as any[];

      if (passes.length === 0) {
        bot?.sendMessage(chatId, '📋 У вас пока нет заявок на пропуск.\n\nИспользуйте /create для создания новой заявки.');
        return;
      }

      let message = '📋 Ваши заявки на пропуск:\n\n';
      
      passes.forEach((pass, index) => {
        const status = pass.status === 'pending' ? '⏳ Ожидает' : 
                      pass.status === 'activated' ? '✅ Заехал' : 
                      '❌ Отклонено';
        
        message += `${index + 1}. ${pass.vehicleType === 'грузовой' ? '🚚' : '🚗'} ${pass.vehicleBrand || 'N/A'}\n`;
        message += `   Номер: ${pass.vehicleNumber}\n`;
        message += `   Дата: ${new Date(pass.entryDate).toLocaleDateString('ru-RU')}\n`;
        message += `   Статус: ${status}\n`;
        if (pass.comment) {
          message += `   Комментарий: ${pass.comment}\n`;
        }
        message += '\n';
      });

      bot?.sendMessage(chatId, message);
    } catch (error) {
      console.error('Ошибка получения заявок:', error);
      bot?.sendMessage(chatId, '❌ Ошибка при получении заявок');
    }
  });

  // Команда /help
  bot.onText(/\/help/, (msg: Message) => {
    const chatId = msg.chat.id;
    const helpText = `
📖 Справка по использованию бота

🔹 /start - Начать работу с ботом
🔹 /link <код> - Привязать Telegram к аккаунту
🔹 /create - Создать новую заявку на пропуск
🔹 /list - Просмотреть мои заявки (последние 10)
🔹 /help - Показать эту справку

💡 Для полного управления заявками используйте веб-интерфейс:
https://пропуск.аносинопарк.рф

❓ Если у вас возникли вопросы, обратитесь к администратору.
    `.trim();
    bot?.sendMessage(chatId, helpText);
  });

  console.log('Telegram бот успешно инициализирован');
  return bot;
};

// Функция создания заявки из данных бота
async function createPassFromBot(data: any) {
  const { userId, vehicleType, vehicleBrand, vehicleNumber, entryDate, address, plotNumber, comment } = data;

  try {
    const result = await dbRun(
      'INSERT INTO passes ("userId", "vehicleType", "vehicleBrand", "vehicleNumber", "entryDate", address, "plotNumber", comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [userId, vehicleType, vehicleBrand, vehicleNumber, entryDate, address, plotNumber, comment]
    );

    const passId = result.rows?.[0]?.id;
    
    // Отправляем событие о новой заявке через SSE
    if (passId) {
      broadcastEvent('new-pass', { message: 'Новая заявка создана', passId });
    }
  } catch (error) {
    console.error('Ошибка создания заявки через бота:', error);
    throw error;
  }
}

// Функция генерации токена привязки
export const generateTelegramLinkToken = async (userId: number, telegramId: number = 0): Promise<string> => {
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Токен действителен 15 минут

  // Удаляем старые токены для этого пользователя
  await dbRun('DELETE FROM telegram_link_tokens WHERE "userId" = $1', [userId]);

  // Создаем новый токен (telegramId будет обновлен при привязке)
  await dbRun(
    'INSERT INTO telegram_link_tokens ("userId", token, "telegramId", "expiresAt") VALUES ($1, $2, $3, $4)',
    [userId, token, telegramId, expiresAt]
  );

  return token;
};

export default bot;

