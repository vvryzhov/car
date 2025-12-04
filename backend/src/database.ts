import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';

const db = new sqlite3.Database('./passes.db');

export const dbRun = promisify(db.run.bind(db));
export const dbGet = promisify(db.get.bind(db));
export const dbAll = promisify(db.all.bind(db));

export const initDatabase = async () => {
  // Таблица пользователей
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      address TEXT NOT NULL,
      plotNumber TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица заявок на пропуск
  await dbRun(`
    CREATE TABLE IF NOT EXISTS passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      vehicleType TEXT NOT NULL,
      vehicleNumber TEXT NOT NULL,
      entryDate TEXT NOT NULL,
      address TEXT NOT NULL,
      comment TEXT,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Создаем администратора по умолчанию (email: admin@admin.com, password: admin123)
  const adminExists = await dbGet('SELECT id FROM users WHERE email = ?', ['admin@admin.com']);
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await dbRun(
      'INSERT INTO users (email, password, fullName, address, plotNumber, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['admin@admin.com', hashedPassword, 'Администратор', 'Административный корпус', '0', '+7 (999) 000-00-00', 'admin']
    );
  }

  console.log('База данных инициализирована');
};

export default db;

