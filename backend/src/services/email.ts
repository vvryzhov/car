import nodemailer from 'nodemailer';
import { dbGet } from '../database';

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from_email: string;
  from_name: string;
}

export const getSMTPConfig = async (): Promise<SMTPConfig | null> => {
  try {
    const config = await dbGet('SELECT * FROM smtp_settings ORDER BY id DESC LIMIT 1');
    if (!config || !config.host) {
      return null;
    }
    return {
      host: config.host,
      port: config.port,
      secure: config.secure || false,
      user: config.user,
      password: config.password,
      from_email: config.from_email,
      from_name: config.from_name || 'Система управления пропусками',
    };
  } catch (error) {
    console.error('Ошибка получения настроек SMTP:', error);
    return null;
  }
};

export const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    const config = await getSMTPConfig();
    if (!config) {
      console.error('SMTP настройки не найдены');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error('Ошибка отправки email:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (email: string, token: string, resetUrl: string): Promise<boolean> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Восстановление пароля</h2>
        <p>Вы запросили восстановление пароля для вашей учетной записи.</p>
        <p>Для смены пароля перейдите по ссылке:</p>
        <a href="${resetUrl}" class="button">Сменить пароль</a>
        <p>Или скопируйте эту ссылку в браузер:</p>
        <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
        <p>Ссылка действительна в течение 1 часа.</p>
        <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
        <div class="footer">
          <p>С уважением,<br>Система управления пропусками</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(email, 'Восстановление пароля', html);
};

