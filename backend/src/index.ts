import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import passRoutes from './routes/passes';
import settingsRoutes from './routes/settings';
import { initTelegramBot } from './services/telegramBot';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/passes', passRoutes);
app.use('/api/settings', settingsRoutes);

// Инициализация базы данных и запуск сервера
initDatabase()
  .then(() => {
    // Инициализация Telegram бота
    initTelegramBot();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Ошибка инициализации базы данных:', error);
    process.exit(1);
  });

