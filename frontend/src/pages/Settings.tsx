import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Footer from '../components/Footer';

const Settings = () => {
  const { user, logout } = useAuth();
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    from_email: '',
    from_name: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/smtp');
      setSmtpSettings(response.data);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/settings/smtp', smtpSettings);
      setSuccess('Настройки SMTP сохранены');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    const testEmail = smtpSettings.user || smtpSettings.from_email;
    if (!testEmail) {
      setError('Сначала заполните email пользователя или отправителя');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/settings/smtp/test', { email: testEmail });
      setSuccess('Тестовое письмо отправлено на ' + testEmail);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки тестового письма');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="app">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Настройки</h1>
          <div className="header-actions">
            <span className="user-info">{user?.fullName}</span>
            <button className="btn btn-secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h2>Настройки почтового сервера (SMTP)</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Настройте SMTP сервер для отправки писем с восстановлением пароля.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="host">SMTP Хост</label>
              <input
                type="text"
                id="host"
                value={smtpSettings.host}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                required
                placeholder="smtp.gmail.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="port">Порт</label>
              <input
                type="number"
                id="port"
                value={smtpSettings.port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) })}
                required
                min="1"
                max="65535"
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={smtpSettings.secure}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Использовать SSL/TLS (secure)
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="user">Пользователь (email)</label>
              <input
                type="email"
                id="user"
                value={smtpSettings.user}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                required
                placeholder="your-email@gmail.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <input
                type="password"
                id="password"
                value={smtpSettings.password}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                required
                placeholder="Пароль от email или пароль приложения"
              />
            </div>

            <div className="form-group">
              <label htmlFor="from_email">Email отправителя</label>
              <input
                type="email"
                id="from_email"
                value={smtpSettings.from_email}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, from_email: e.target.value })}
                required
                placeholder="noreply@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="from_name">Имя отправителя</label>
              <input
                type="text"
                id="from_name"
                value={smtpSettings.from_name}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, from_name: e.target.value })}
                placeholder="Система управления пропусками"
              />
            </div>

            {error && <div className="error">{error}</div>}
            {success && <div style={{ color: '#28a745', marginBottom: '15px' }}>{success}</div>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleTestEmail} disabled={loading}>
                Отправить тестовое письмо
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>

          <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <h3 style={{ marginTop: 0 }}>Примеры настроек:</h3>
            <p><strong>Gmail:</strong></p>
            <ul>
              <li>Хост: smtp.gmail.com</li>
              <li>Порт: 587 (или 465 для SSL)</li>
              <li>Secure: true для порта 465, false для 587</li>
              <li>Используйте пароль приложения, а не обычный пароль</li>
            </ul>
            <p><strong>Yandex:</strong></p>
            <ul>
              <li>Хост: smtp.yandex.ru</li>
              <li>Порт: 465</li>
              <li>Secure: true</li>
            </ul>
            <p><strong>Mail.ru:</strong></p>
            <ul>
              <li>Хост: smtp.mail.ru</li>
              <li>Порт: 465</li>
              <li>Secure: true</li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Settings;

