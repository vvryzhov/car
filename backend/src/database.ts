import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';

// Создаем пул подключений к PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'passes_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const dbRun = async (sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number; rows?: any[] }> => {
  try {
    const result: QueryResult = await pool.query(sql, params);
    return {
      lastID: result.rows[0]?.id,
      changes: result.rowCount || 0,
      rows: result.rows,
    };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const dbGet = async (sql: string, params?: any[]): Promise<any> => {
  try {
    const result: QueryResult = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const dbAll = async (sql: string, params?: any[]): Promise<any[]> => {
  try {
    const result: QueryResult = await pool.query(sql, params);
    return result.rows || [];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const initDatabase = async () => {
  try {
    // Таблица пользователей
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        "fullName" VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        "plotNumber" VARCHAR(50) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        "deactivatedAt" TIMESTAMP,
        "deactivationDate" DATE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем поля деактивации, если их нет
    const deactivatedAtCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='deactivatedAt'
    `);
    if (!deactivatedAtCheck) {
      await dbRun('ALTER TABLE users ADD COLUMN "deactivatedAt" TIMESTAMP');
    }

    const deactivationDateCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='deactivationDate'
    `);
    if (!deactivationDateCheck) {
      await dbRun('ALTER TABLE users ADD COLUMN "deactivationDate" DATE');
    }

    // Добавляем поле telegramId, если его нет
    const telegramIdCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='telegramId'
    `);
    if (!telegramIdCheck) {
      await dbRun('ALTER TABLE users ADD COLUMN "telegramId" BIGINT UNIQUE');
    }

    // Добавляем поле lastLoginAt, если его нет
    const lastLoginAtCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='lastLoginAt'
    `);
    if (!lastLoginAtCheck) {
      await dbRun('ALTER TABLE users ADD COLUMN "lastLoginAt" TIMESTAMP');
    }

    // Таблица заявок на пропуск
    await dbRun(`
      CREATE TABLE IF NOT EXISTS passes (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "vehicleType" VARCHAR(50) NOT NULL,
        "vehicleBrand" VARCHAR(100),
        "vehicleNumber" VARCHAR(50) NOT NULL,
        "entryDate" DATE NOT NULL,
        address VARCHAR(255) NOT NULL,
        "plotNumber" VARCHAR(50),
        comment TEXT,
        "securityComment" TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Добавляем поле plotNumber, если его нет
    const plotNumberCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='passes' AND column_name='plotNumber'
    `);
    if (!plotNumberCheck) {
      await dbRun('ALTER TABLE passes ADD COLUMN "plotNumber" VARCHAR(50)');
    }

    // Добавляем поле deletedAt, если его нет
    const deletedAtCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='passes' AND column_name='deletedAt'
    `);
    if (!deletedAtCheck) {
      await dbRun('ALTER TABLE passes ADD COLUMN "deletedAt" TIMESTAMP');
    }

    // Проверяем наличие поля securityComment и добавляем если его нет
    const columnCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='passes' AND column_name='securityComment'
    `);
    
    if (!columnCheck) {
      await dbRun('ALTER TABLE passes ADD COLUMN "securityComment" TEXT');
    }

    // Проверяем наличие поля vehicleBrand и добавляем если его нет
    const vehicleBrandCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='passes' AND column_name='vehicleBrand'
    `);
    
    if (!vehicleBrandCheck) {
      await dbRun('ALTER TABLE passes ADD COLUMN "vehicleBrand" VARCHAR(100)');
    }

    // Добавляем поле isPermanent для постоянных пропусков
    const isPermanentCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='passes' AND column_name='isPermanent'
    `);
    
    if (!isPermanentCheck) {
      console.log('Добавление поля isPermanent в таблицу passes...');
      await dbRun('ALTER TABLE passes ADD COLUMN "isPermanent" BOOLEAN DEFAULT false');
      console.log('Поле isPermanent успешно добавлено');
    } else {
      console.log('Поле isPermanent уже существует в таблице passes');
    }

    // Таблица настроек SMTP
    await dbRun(`
      CREATE TABLE IF NOT EXISTS smtp_settings (
        id SERIAL PRIMARY KEY,
        host VARCHAR(255),
        port INTEGER,
        secure BOOLEAN DEFAULT false,
        "user" VARCHAR(255),
        password VARCHAR(255),
        from_email VARCHAR(255),
        from_name VARCHAR(255),
        frontend_url VARCHAR(255),
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем поле frontend_url, если его нет
    const frontendUrlCheck = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='smtp_settings' AND column_name='frontend_url'
    `);
    if (!frontendUrlCheck) {
      await dbRun('ALTER TABLE smtp_settings ADD COLUMN frontend_url VARCHAR(255)');
    }

    // Таблица токенов восстановления пароля
    await dbRun(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица токенов подтверждения смены email
    await dbRun(`
      CREATE TABLE IF NOT EXISTS email_change_tokens (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "oldEmail" VARCHAR(255) NOT NULL,
        "newEmail" VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица токенов привязки Telegram аккаунта
    await dbRun(`
      CREATE TABLE IF NOT EXISTS telegram_link_tokens (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        token VARCHAR(32) NOT NULL UNIQUE,
        "telegramId" BIGINT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица участков пользователей (адрес и номер участка - единое целое)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_plots (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        address VARCHAR(255) NOT NULL,
        "plotNumber" VARCHAR(50) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE("userId", address, "plotNumber")
      )
    `);

    // Миграция: переносим существующие данные из users в user_plots
    const userPlotsCheck = await dbGet(`
      SELECT COUNT(*) as count FROM user_plots
    `);
    
    if (userPlotsCheck && parseInt(userPlotsCheck.count) === 0) {
      // Переносим существующие данные
      const users = await dbAll('SELECT id, address, "plotNumber" FROM users WHERE address IS NOT NULL AND "plotNumber" IS NOT NULL');
      for (const user of users) {
        try {
          await dbRun(
            'INSERT INTO user_plots ("userId", address, "plotNumber") VALUES ($1, $2, $3)',
            [user.id, user.address, user.plotNumber]
          );
        } catch (error) {
          // Игнорируем ошибки дубликатов
          console.log('Пропуск дубликата для пользователя', user.id);
        }
      }
      console.log('Миграция данных в user_plots завершена');
    }

    // Создаем администратора по умолчанию (email: admin@admin.com, password: admin123)
    const adminExists = await dbGet('SELECT id FROM users WHERE email = $1', ['admin@admin.com']);
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const result = await dbRun(
        'INSERT INTO users (email, password, "fullName", address, "plotNumber", phone, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['admin@admin.com', hashedPassword, 'Администратор', 'Административный корпус', '0', '+7 (999) 000-00-00', 'admin']
      );
      console.log('Администратор создан с ID:', result.rows?.[0]?.id);
    }

    console.log('База данных PostgreSQL инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации базы данных:', error);
    throw error;
  }
};

// Закрытие пула при завершении приложения
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

export default pool;
