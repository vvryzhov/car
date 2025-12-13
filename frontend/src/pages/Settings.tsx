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
    frontend_url: '',
  });
  const [lprSettings, setLprSettings] = useState({
    lpr_token: '',
    cooldown_seconds: 15,
    allowed_statuses: 'pending',
    allow_repeat_after_entered: false,
    timezone: 'Asia/Almaty',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'smtp' | 'lpr'>('smtp');

  useEffect(() => {
    fetchSettings();
    fetchLprSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/smtp');
      // Убеждаемся, что frontend_url инициализирован
      setSmtpSettings({
        host: response.data.host || '',
        port: response.data.port || 587,
        secure: response.data.secure || false,
        user: response.data.user || '',
        password: response.data.password || '',
        from_email: response.data.from_email || '',
        from_name: response.data.from_name || '',
        frontend_url: response.data.frontend_url || '',
      });
    } catch (error) {
      console.error('Ошибка загрузки настроек SMTP:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchLprSettings = async () => {
    try {
      const response = await api.get('/settings/lpr');
      setLprSettings({
        lpr_token: response.data.lpr_token || '',
        cooldown_seconds: response.data.cooldown_seconds || 15,
        allowed_statuses: response.data.allowed_statuses || 'pending',
        allow_repeat_after_entered: response.data.allow_repeat_after_entered || false,
        timezone: response.data.timezone || 'Asia/Almaty',
      });
    } catch (error) {
      console.error('Ошибка загрузки настроек LPR:', error);
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

  const handleLprSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/settings/lpr', lprSettings);
      setLprSettings({
        ...lprSettings,
        lpr_token: response.data.lpr_token || lprSettings.lpr_token,
      });
      setSuccess('Настройки LPR сохранены');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения настроек LPR');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/settings/lpr', {
        ...lprSettings,
        generate_new_token: true,
      });
      setLprSettings({
        ...lprSettings,
        lpr_token: response.data.lpr_token,
      });
      setSuccess('Новый токен LPR сгенерирован');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка генерации токена');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.trim()) {
      setError('Введите email получателя тестового письма');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/settings/smtp/test', { email: testEmail.trim() });
      setSuccess(response.data?.message || `Тестовое письмо успешно отправлено на ${testEmail}`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Ошибка отправки тестового письма';
      const errorDetails = err.response?.data?.details || err.response?.data?.error || err.message || 'Неизвестная ошибка';
      
      // Формируем подробное сообщение об ошибке
      let fullError = errorMessage;
      if (errorDetails && errorDetails !== errorMessage) {
        fullError += `\n\nДетали: ${errorDetails}`;
      }
      
      // Добавляем информацию о возможных причинах
      if (errorMessage.includes('аутентификац') || errorMessage.includes('EAUTH')) {
        fullError += '\n\nВозможные причины:\n- Неверный логин или пароль SMTP\n- Для Gmail необходимо использовать пароль приложения, а не обычный пароль';
      } else if (errorMessage.includes('подключен') || errorMessage.includes('ECONNECTION')) {
        fullError += '\n\nВозможные причины:\n- Неверный хост или порт SMTP\n- Проблемы с сетью или файрволом';
      } else if (errorMessage.includes('таймаут') || errorMessage.includes('ETIMEDOUT')) {
        fullError += '\n\nВозможные причины:\n- SMTP сервер недоступен\n- Проблемы с сетью';
      }
      
      setError(fullError);
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
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
            <button
              className={`btn ${activeTab === 'smtp' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('smtp')}
              style={{ padding: '8px 16px' }}
            >
              Настройки SMTP
            </button>
            <button
              className={`btn ${activeTab === 'lpr' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('lpr')}
              style={{ padding: '8px 16px' }}
            >
              Настройки LPR
            </button>
          </div>

          {activeTab === 'smtp' && (
            <>
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

            <div className="form-group" style={{ 
              marginTop: '25px', 
              paddingTop: '20px', 
              borderTop: '2px solid #007bff',
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '6px'
            }}>
              <label htmlFor="frontend_url" style={{ fontWeight: 'bold', color: '#007bff', fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                🌐 URL фронтенда (для ссылок в письмах)
              </label>
              <input
                type="url"
                id="frontend_url"
                value={smtpSettings.frontend_url || ''}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, frontend_url: e.target.value })}
                placeholder="https://yourdomain.com или http://yourdomain.com:8080"
                style={{ 
                  marginTop: '8px',
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '10px', lineHeight: '1.6' }}>
                <strong>Важно:</strong> Этот URL используется для ссылок в письмах (например, для восстановления пароля). 
                Укажите полный URL с протоколом (http:// или https://). 
                Если не указан, будет использоваться значение из переменной окружения FRONTEND_URL.
              </small>
            </div>

            {error && (
              <div className="error" style={{ whiteSpace: 'pre-line', marginBottom: '15px' }}>
                {error}
              </div>
            )}
            {success && <div style={{ color: '#28a745', marginBottom: '15px' }}>{success}</div>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>

          <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Тестовая отправка письма</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Введите email получателя для отправки тестового письма и проверки настроек SMTP.
            </p>
            <div className="form-group">
              <label htmlFor="testEmail">Email получателя</label>
              <input
                type="email"
                id="testEmail"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                style={{ marginBottom: '10px' }}
              />
            </div>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleTestEmail} 
              disabled={loading || !testEmail.trim()}
            >
              {loading ? 'Отправка...' : 'Отправить тестовое письмо'}
            </button>
          </div>

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
            </>
          )}

          {activeTab === 'lpr' && (
            <>
          <h2>Настройки LPR (Автоматическое открытие шлагбаума)</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Настройте параметры интеграции с LPR Agent для автоматического открытия шлагбаума по распознаванию госномера.
          </p>

          <form onSubmit={handleLprSubmit}>
            <div className="form-group" style={{ 
              marginTop: '25px', 
              paddingTop: '20px', 
              borderTop: '2px solid #007bff',
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '6px'
            }}>
              <label htmlFor="lpr_token" style={{ fontWeight: 'bold', color: '#007bff', fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                🔑 LPR Token (секретный ключ)
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  id="lpr_token"
                  value={lprSettings.lpr_token}
                  readOnly
                  style={{ 
                    flex: 1,
                    padding: '10px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5'
                  }}
                  placeholder="Токен будет сгенерирован автоматически"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleGenerateToken}
                  disabled={loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {loading ? 'Генерация...' : 'Сгенерировать новый'}
                </button>
              </div>
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '10px', lineHeight: '1.6' }}>
                <strong>Важно:</strong> Этот токен используется для авторизации запросов от LPR Agent. 
                Укажите его в настройках LPR Agent в поле "Pass API LPR Token". 
                При генерации нового токена не забудьте обновить его в LPR Agent.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="cooldown_seconds">Cooldown (секунды)</label>
              <input
                type="number"
                id="cooldown_seconds"
                value={lprSettings.cooldown_seconds}
                onChange={(e) => setLprSettings({ ...lprSettings, cooldown_seconds: parseInt(e.target.value) || 15 })}
                required
                min="1"
                max="3600"
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Время между проверками одного номера (1-3600 секунд)
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="allowed_statuses">Разрешённые статусы</label>
              <input
                type="text"
                id="allowed_statuses"
                value={lprSettings.allowed_statuses}
                onChange={(e) => setLprSettings({ ...lprSettings, allowed_statuses: e.target.value })}
                required
                placeholder="pending,approved"
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Статусы заявок, при которых разрешён проезд (через запятую). Например: pending,approved
              </small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={lprSettings.allow_repeat_after_entered}
                  onChange={(e) => setLprSettings({ ...lprSettings, allow_repeat_after_entered: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Разрешить повторный проезд после "Заехал"
              </label>
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Если включено, автомобиль сможет проехать повторно даже после того, как статус заявки изменился на "Заехал"
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="timezone">Временная зона</label>
              <input
                type="text"
                id="timezone"
                value={lprSettings.timezone}
                onChange={(e) => setLprSettings({ ...lprSettings, timezone: e.target.value })}
                required
                placeholder="Asia/Almaty"
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Временная зона для определения "сегодня" при проверке заявок (например: Asia/Almaty, Europe/Moscow)
              </small>
            </div>

            {error && (
              <div className="error" style={{ whiteSpace: 'pre-line', marginBottom: '15px' }}>
                {error}
              </div>
            )}
            {success && <div style={{ color: '#28a745', marginBottom: '15px' }}>{success}</div>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Settings;

