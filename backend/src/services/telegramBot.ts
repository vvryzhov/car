import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { dbGet, dbRun, dbAll } from '../database';
import crypto from 'crypto';
import { validateVehicleNumber, formatVehicleNumber } from '../utils/vehicleNumberValidator';
import { getBrandByAlias } from '../data/carBrandAliases';
import { broadcastEvent } from './sse';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

let bot: TelegramBot | null = null;

// Хранилище состояний пользователей (в production лучше использовать Redis или БД)
interface UserState {
  action: 'creating_pass' | 'waiting_vehicle_type' | 'waiting_vehicle_brand' | 'waiting_vehicle_number' | 'waiting_entry_date' | 'waiting_plot' | 'waiting_comment' | 'waiting_vehicle_number_and_brand' | 'waiting_vehicle_brand_future' | 'waiting_vehicle_number_future';
  data?: any;
}

const userStates = new Map<number, UserState>();

// Функция для обновления времени последней активности пользователя
async function updateUserActivity(userId: number, role: string) {
  // Обновляем только для пользователей и прорабов
  if (role === 'user' || role === 'foreman') {
    try {
      await dbRun('UPDATE users SET "lastLoginAt" = NOW() WHERE id = $1', [userId]);
    } catch (error) {
      console.error('Ошибка обновления lastLoginAt для пользователя', userId, error);
    }
  }
}

export const initTelegramBot = () => {
  // Отладочная информация
  const tokenFromEnv = process.env.TELEGRAM_BOT_TOKEN;
  console.log('🔍 Проверка TELEGRAM_BOT_TOKEN:');
  console.log(`   - process.env.TELEGRAM_BOT_TOKEN существует: ${!!tokenFromEnv}`);
  console.log(`   - Длина токена: ${tokenFromEnv ? tokenFromEnv.length : 0}`);
  console.log(`   - Первые 10 символов: ${tokenFromEnv ? tokenFromEnv.substring(0, 10) + '...' : 'нет'}`);
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN не установлен, бот не будет запущен');
    return null;
  }

  try {
    console.log('🤖 Инициализация Telegram бота...');
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    
    // Обработка ошибок бота
    bot.on('polling_error', (error: Error) => {
      console.error('❌ Ошибка polling Telegram бота:', error.message);
      console.error('Полная ошибка:', error);
    });

    bot.on('error', (error: Error) => {
      console.error('❌ Ошибка Telegram бота:', error.message);
      console.error('Полная ошибка:', error);
    });

    console.log('✅ Telegram бот успешно инициализирован');
  } catch (error: any) {
    console.error('❌ Критическая ошибка при инициализации Telegram бота:', error.message);
    console.error('Полная ошибка:', error);
    bot = null;
    return null;
  }

  // Если бот не создан, выходим
  if (!bot) {
    return null;
  }

  // Команда /start
  bot.onText(/\/start/, async (msg: Message) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      bot?.sendMessage(chatId, 'Ошибка: не удалось определить ваш Telegram ID');
      return;
    }

    // Проверяем, привязан ли аккаунт
    const user = await dbGet('SELECT id, "fullName", email, role FROM users WHERE "telegramId" = $1', [telegramId]) as any;
    
    if (user) {
      // Обновляем активность для пользователей и прорабов
      await updateUserActivity(user.id, user.role);
      const welcomeText = `
👋 Добро пожаловать, ${user.fullName}!

Вы уже привязали свой Telegram аккаунт.

📋 Доступные команды:
/create - Создать заявку на легковой авто (на сегодня)
/create_truck - Создать пропуск на грузовое авто (на сегодня)
/create_future - Создать пропуск на будущую дату
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

  // Команда /create - создает заявку на легковой авто на текущий день
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

    // Обновляем активность для пользователей и прорабов
    await updateUserActivity(user.id, user.role);

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

    // Получаем текущую дату в формате ГГГГ-ММ-ДД
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayFormatted = `${year}-${month}-${day}`;

    // Если участок один, используем его автоматически
    if (plots.length === 1) {
      const plot = plots[0];
      userStates.set(telegramId, {
        action: 'waiting_vehicle_number_and_brand',
        data: {
          userId: user.id,
          plots,
          vehicleType: 'легковой',
          entryDate: todayFormatted,
          plotId: plot.id,
          address: plot.address || plot.plotNumber,
          plotNumber: plot.plotNumber
        }
      });
      bot?.sendMessage(chatId, '📝 Создание заявки на легковой авто на сегодня\n\n✍️ Введите номер авто и марку (например: Р074НН797 Kia K5):');
    } else {
      // Если участков несколько, сначала выбираем участок
      userStates.set(telegramId, {
        action: 'waiting_plot',
        data: {
          userId: user.id,
          plots,
          vehicleType: 'легковой',
          entryDate: todayFormatted,
          isQuickCreate: true // Флаг для быстрого создания
        }
      });

      const plotButtons = plots.map((plot: any) => [
        { text: `${plot.plotNumber} - ${plot.address || 'Без адреса'}`, callback_data: `plot:${plot.id}` }
      ]);

      const keyboard = {
        reply_markup: {
          inline_keyboard: plotButtons
        }
      };

      bot?.sendMessage(chatId, '📝 Создание заявки на легковой авто на сегодня\n\n🏠 Выберите участок:', keyboard);
    }
  });

  // Команда /create_truck - создает пропуск на грузовое авто на текущий день
  bot.onText(/\/create_truck/, async (msg: Message) => {
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

    // Обновляем активность для пользователей и прорабов
    await updateUserActivity(user.id, user.role);

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

    // Получаем текущую дату в формате ГГГГ-ММ-ДД
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayFormatted = `${year}-${month}-${day}`;

    // Если участок один, используем его автоматически
    if (plots.length === 1) {
      const plot = plots[0];
      userStates.set(telegramId, {
        action: 'waiting_vehicle_number_and_brand',
        data: {
          userId: user.id,
          plots,
          vehicleType: 'грузовой',
          entryDate: todayFormatted,
          plotId: plot.id,
          address: plot.address || plot.plotNumber,
          plotNumber: plot.plotNumber
        }
      });
      bot?.sendMessage(chatId, '📝 Создание пропуска на грузовое авто на сегодня\n\n✍️ Введите номер авто и марку (например: Р074НН797 Kia K5):');
    } else {
      // Если участков несколько, сначала выбираем участок
      userStates.set(telegramId, {
        action: 'waiting_plot',
        data: {
          userId: user.id,
          plots,
          vehicleType: 'грузовой',
          entryDate: todayFormatted,
          isQuickCreate: true // Флаг для быстрого создания
        }
      });

      const plotButtons = plots.map((plot: any) => [
        { text: `${plot.plotNumber} - ${plot.address || 'Без адреса'}`, callback_data: `plot:${plot.id}` }
      ]);

      const keyboard = {
        reply_markup: {
          inline_keyboard: plotButtons
        }
      };

      bot?.sendMessage(chatId, '📝 Создание пропуска на грузовое авто на сегодня\n\n🏠 Выберите участок:', keyboard);
    }
  });

  // Команда /create_future - создает пропуск с запросом типа, марки, номера, даты
  bot.onText(/\/create_future/, async (msg: Message) => {
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

    // Обновляем активность для пользователей и прорабов
    await updateUserActivity(user.id, user.role);

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
      data: { userId: user.id, plots, isFuture: true }
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚗 Легковой', callback_data: 'vehicle_type:легковой' }],
          [{ text: '🚚 Грузовой', callback_data: 'vehicle_type:грузовой' }]
        ]
      }
    };

    bot?.sendMessage(chatId, '📝 Создание пропуска на будущую дату\n\nВыберите тип транспорта:', keyboard);
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

    // Обновляем активность для пользователей и прорабов
    if (state.data.userId) {
      const user = await dbGet('SELECT role FROM users WHERE id = $1', [state.data.userId]) as any;
      if (user) {
        await updateUserActivity(state.data.userId, user.role);
      }
    }

    // Обработка выбора типа транспорта
    if (data.startsWith('vehicle_type:')) {
      const vehicleType = data.split(':')[1];
      state.data.vehicleType = vehicleType;
      
      // Если это команда create_future, запрашиваем марку отдельно
      if (state.data.isFuture) {
        state.action = 'waiting_vehicle_brand_future';
        userStates.set(telegramId, state);
        bot?.sendMessage(chatId, `✅ Тип транспорта: ${vehicleType}\n\n✍️ Введите марку автомобиля (например: Toyota, BMW, Лада):`);
      } else {
        // Старый путь для обратной совместимости
        state.action = 'waiting_vehicle_brand';
        userStates.set(telegramId, state);
        bot?.sendMessage(chatId, `✅ Тип транспорта: ${vehicleType}\n\n✍️ Введите марку автомобиля (например: Toyota, BMW, Лада):`);
      }
    }
    // Обработка выбора участка
    else if (data.startsWith('plot:')) {
      const plotId = parseInt(data.split(':')[1]);
      const plot = state.data.plots.find((p: any) => p.id === plotId);
      
      if (plot) {
        state.data.plotId = plotId;
        state.data.address = plot.address || plot.plotNumber;
        state.data.plotNumber = plot.plotNumber;
        
        // Если это быстрая команда (create или create_truck), запрашиваем номер и марку вместе
        if (state.data.isQuickCreate) {
          state.action = 'waiting_vehicle_number_and_brand';
          userStates.set(telegramId, state);
          bot?.sendMessage(chatId, `✅ Участок: ${plot.plotNumber}\nАдрес: ${plot.address || plot.plotNumber}\n\n✍️ Введите номер авто и марку (например: Р074НН797 Kia K5):`);
        } else if (state.data.isFuture) {
          // Для create_future после выбора участка сразу создаем заявку
          state.data.comment = null;
          userStates.set(telegramId, state);
          
          // Создаем заявку
          await createPassFromBot(state.data);
          userStates.delete(telegramId);
          
          bot?.sendMessage(chatId, `✅ Участок: ${plot.plotNumber}\nАдрес: ${plot.address || plot.plotNumber}\n\n✅ Заявка успешно создана!\n\nИспользуйте /list для просмотра ваших заявок.`);
        } else {
          // Старый путь - запрашиваем комментарий
          state.action = 'waiting_comment';
          userStates.set(telegramId, state);
          bot?.sendMessage(chatId, `✅ Участок: ${plot.plotNumber}\nАдрес: ${plot.address || plot.plotNumber}\n\n💬 Введите комментарий (или отправьте "-" для пропуска):`);
        }
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

          // Форматируем сегодняшнюю дату в дд-мм-гггг
          const today = new Date();
          const day = String(today.getDate()).padStart(2, '0');
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const year = today.getFullYear();
          const todayFormatted = `${day}-${month}-${year}`;
          
          bot?.sendMessage(chatId, `✅ Номер: ${state.data.vehicleNumber}\n\n📅 Введите дату въезда в формате дд-мм-гггг (например: ${todayFormatted}):`);
          break;
        }

        case 'waiting_entry_date': {
          // Проверяем формат дд-мм-гггг
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
          if (!dateRegex.test(text.trim())) {
            bot?.sendMessage(chatId, '❌ Неверный формат даты. Используйте дд-мм-гггг (например: 25-12-2024)');
            return;
          }

          // Парсим дату из дд-мм-гггг в ГГГГ-ММ-ДД для сохранения
          const parts = text.trim().split('-');
          if (parts.length !== 3) {
            bot?.sendMessage(chatId, '❌ Неверный формат даты. Используйте дд-мм-гггг (например: 25-12-2024)');
            return;
          }

          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);

          // Проверяем валидность даты
          if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12) {
            bot?.sendMessage(chatId, '❌ Неверная дата. Проверьте правильность ввода (дд-мм-гггг)');
            return;
          }

          const entryDate = new Date(year, month - 1, day);
          if (isNaN(entryDate.getTime()) || 
              entryDate.getDate() !== day || 
              entryDate.getMonth() + 1 !== month) {
            bot?.sendMessage(chatId, '❌ Неверная дата. Попробуйте еще раз (дд-мм-гггг):');
            return;
          }

          // Конвертируем в ГГГГ-ММ-ДД для сохранения в БД
          const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          state.data.entryDate = formattedDate;

          // Если участок один, используем его автоматически
          if (state.data.plots.length === 1) {
            const plot = state.data.plots[0];
            state.data.plotId = plot.id;
            state.data.address = plot.address || plot.plotNumber;
            state.data.plotNumber = plot.plotNumber;
            state.data.comment = null;
            state.action = 'waiting_comment'; // Устанавливаем для завершения
            userStates.set(telegramId, state);

            // Создаем заявку
            await createPassFromBot(state.data);
            userStates.delete(telegramId);

            bot?.sendMessage(chatId, `✅ Дата въезда: ${text.trim()}\n✅ Участок: ${plot.plotNumber}\n\n✅ Заявка успешно создана!\n\nИспользуйте /list для просмотра ваших заявок.`);
          } else {
            // Если участков несколько, запрашиваем выбор
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
          }
          break;
        }

        case 'waiting_vehicle_number_and_brand': {
          // Парсим номер и марку из одного сообщения
          // Формат: "Р074НН797 Kia K5" - первое слово это номер, остальное марка
          const parts = text.trim().split(/\s+/);
          if (parts.length < 2) {
            bot?.sendMessage(chatId, '❌ Неверный формат. Введите номер и марку через пробел (например: Р074НН797 Kia K5)');
            return;
          }

          const vehicleNumber = parts[0].trim().toUpperCase();
          const vehicleBrand = parts.slice(1).join(' ').trim();

          // Валидация номера
          const validation = validateVehicleNumber(vehicleNumber);
          if (!validation.valid) {
            bot?.sendMessage(chatId, `❌ ${validation.error}\n\nПопробуйте еще раз:`);
            return;
          }

          // Проверяем алиасы для марки
          let finalBrand = vehicleBrand;
          const aliasBrand = getBrandByAlias(vehicleBrand);
          if (aliasBrand) {
            finalBrand = aliasBrand;
          }

          state.data.vehicleNumber = vehicleNumber;
          state.data.vehicleBrand = finalBrand;
          state.data.comment = null; // Для быстрых команд комментарий не запрашиваем

          // Создаем заявку
          await createPassFromBot(state.data);

          userStates.delete(telegramId);

          bot?.sendMessage(chatId, `✅ Заявка успешно создана!\n\n🚗 ${finalBrand} ${formatVehicleNumber(vehicleNumber)}\n📅 ${new Date(state.data.entryDate).toLocaleDateString('ru-RU')}\n\nИспользуйте /list для просмотра ваших заявок.`);
          break;
        }

        case 'waiting_vehicle_brand_future': {
          let vehicleBrand = text.trim();
          // Проверяем алиасы
          const aliasBrand = getBrandByAlias(vehicleBrand);
          if (aliasBrand) {
            vehicleBrand = aliasBrand;
          }
          
          state.data.vehicleBrand = vehicleBrand;
          state.action = 'waiting_vehicle_number_future';
          userStates.set(telegramId, state);

          bot?.sendMessage(chatId, `✅ Марка: ${vehicleBrand}\n\n🔢 Введите номер автомобиля (например: А123БВ777):`);
          break;
        }

        case 'waiting_vehicle_number_future': {
          const validation = validateVehicleNumber(text.trim());
          if (!validation.valid) {
            bot?.sendMessage(chatId, `❌ ${validation.error}\n\nПопробуйте еще раз:`);
            return;
          }

          state.data.vehicleNumber = text.trim().toUpperCase();
          state.action = 'waiting_entry_date';
          userStates.set(telegramId, state);

          // Форматируем сегодняшнюю дату в дд-мм-гггг
          const today = new Date();
          const day = String(today.getDate()).padStart(2, '0');
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const year = today.getFullYear();
          const todayFormatted = `${day}-${month}-${year}`;
          
          bot?.sendMessage(chatId, `✅ Номер: ${state.data.vehicleNumber}\n\n📅 Введите дату въезда в формате дд-мм-гггг (например: ${todayFormatted}):`);
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

    const user = await dbGet('SELECT id, role FROM users WHERE "telegramId" = $1', [telegramId]) as any;
    
    if (!user) {
      bot?.sendMessage(chatId, '❌ Ваш Telegram аккаунт не привязан. Используйте /link для привязки.');
      return;
    }

    // Обновляем активность для пользователей и прорабов
    await updateUserActivity(user.id, user.role);

    try {
      const passes = await dbAll(
        'SELECT * FROM passes WHERE "userId" = $1 AND "deletedAt" IS NULL AND status != \'personal_vehicle\' AND ("isPermanent" IS NULL OR "isPermanent" = false) ORDER BY "entryDate" DESC, "createdAt" DESC LIMIT 10',
        [user.id]
      ) as any[];

      if (passes.length === 0) {
        bot?.sendMessage(chatId, '📋 У вас пока нет заявок на пропуск.\n\nИспользуйте команды:\n/create - для легкового авто (на сегодня)\n/create_truck - для грузового авто (на сегодня)\n/create_future - для пропуска на будущую дату');
        return;
      }

      let message = '📋 Ваши заявки на пропуск:\n\n';
      
      passes.forEach((pass, index) => {
        const status = pass.status === 'pending' ? '⏳ Ожидает' : 
                      pass.status === 'activated' ? '✅ Заехал' : 
                      '❌ Отклонено';
        
        message += `${index + 1}. ${pass.vehicleType === 'грузовой' ? '🚚' : '🚗'} ${pass.vehicleBrand || 'N/A'}\n`;
        message += `   Номер: ${formatVehicleNumber(pass.vehicleNumber)}\n`;
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
🔹 /create - Создать заявку на легковой авто (на сегодня)
🔹 /create_truck - Создать пропуск на грузовое авто (на сегодня)
🔹 /create_future - Создать пропуск на будущую дату
🔹 /list - Просмотреть мои заявки (последние 10)
🔹 /help - Показать эту справку

💡 Для полного управления заявками используйте веб-интерфейс:
https://пропуск.аносинопарк.рф
    `.trim();
    bot?.sendMessage(chatId, helpText);
  });

  console.log('Telegram бот успешно инициализирован');
  return bot;
};

// Функция создания заявки из данных бота
async function createPassFromBot(data: any) {
  const { userId, vehicleType, vehicleBrand, vehicleNumber, entryDate, address, plotNumber, comment } = data;

  // Преобразуем номер в верхний регистр
  const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

  try {
    const result = await dbRun(
      'INSERT INTO passes ("userId", "vehicleType", "vehicleBrand", "vehicleNumber", "entryDate", address, "plotNumber", comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [userId, vehicleType, vehicleBrand, normalizedVehicleNumber, entryDate, address, plotNumber, comment]
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

