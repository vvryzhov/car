import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatPhone } from '../utils/phoneFormatter';
import PermanentPassesManager from './PermanentPassesManager';

interface Plot {
  id: number;
  address: string;
  plotNumber: string;
}

interface User {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  role?: 'user' | 'security' | 'admin' | 'foreman';
  plots?: Plot[];
  telegramLinked?: boolean;
}

interface ProfileFormProps {
  user: User;
  onCancel: () => void;
  onSave: (userData: User) => void;
}

const ProfileForm = ({ user, onCancel, onSave }: ProfileFormProps) => {
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(formatPhone(user.phone || ''));
  const [plots, setPlots] = useState<Plot[]>(user.plots || []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  // Состояния для смены email с подтверждением
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [emailChangeStep, setEmailChangeStep] = useState<'input' | 'confirm'>('input');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  
  // Состояния для привязки Telegram
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLinkToken, setTelegramLinkToken] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  useEffect(() => {
    // Загружаем участки только для ролей user и foreman
    if (user.role === 'user' || user.role === 'foreman') {
      fetchPlots();
    }
    // Проверяем статус привязки Telegram
    checkTelegramStatus();
  }, [user.id, user.role]);

  const checkTelegramStatus = async () => {
    try {
      const response = await api.get('/users/me');
      setTelegramLinked(response.data.telegramLinked || false);
    } catch (error) {
      console.error('Ошибка проверки статуса Telegram:', error);
    }
  };

  const fetchPlots = async () => {
    try {
      const response = await api.get(`/users/${user.id}/plots`);
      setPlots(response.data);
    } catch (error) {
      console.error('Ошибка загрузки участков:', error);
    }
  };


  const handleRequestEmailChange = async () => {
    setError('');
    setEmailChangeLoading(true);

    try {
      await api.post('/users/me/request-email-change', {
        newEmail: newEmail.trim(),
      });
      setEmailChangeStep('confirm');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки кода подтверждения');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    setError('');
    setEmailChangeLoading(true);

    try {
      const response = await api.post('/users/me/confirm-email-change', {
        code: confirmationCode.trim(),
      });
      setEmail(response.data.user.email);
      setShowEmailChange(false);
      setEmailChangeStep('input');
      setNewEmail('');
      setConfirmationCode('');
      onSave(response.data.user);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка подтверждения смены email');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleTelegramLink = async () => {
    setError('');
    setTelegramLoading(true);

    try {
      const response = await api.get('/users/me/telegram-link-token');
      setTelegramLinkToken(response.data.token);
      setError('');
      // Копируем код в буфер обмена
      try {
        await navigator.clipboard.writeText(response.data.token);
      } catch (e) {
        // Игнорируем ошибки копирования
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка получения кода привязки');
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTelegramUnlink = async () => {
    if (!window.confirm('Вы уверены, что хотите отвязать Telegram?')) {
      return;
    }

    setError('');
    setTelegramLoading(true);

    try {
      await api.post('/users/me/telegram-unlink');
      setTelegramLinked(false);
      setTelegramLinkToken(null);
      await checkTelegramStatus();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отвязки Telegram');
    } finally {
      setTelegramLoading(false);
    }
  };

  const copyTokenToClipboard = async () => {
    if (telegramLinkToken) {
      try {
        await navigator.clipboard.writeText(telegramLinkToken);
        setError('');
      } catch (e) {
        setError('Не удалось скопировать код');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Если меняем пароль, проверяем совпадение
    if (showPasswordChange) {
      if (newPassword !== confirmPassword) {
        setError('Новые пароли не совпадают');
        return;
      }
      if (newPassword.length < 6) {
        setError('Пароль должен быть не менее 6 символов');
        return;
      }

      // Проверка: пароль должен содержать буквы и числа
      const hasLetter = /[a-zA-Zа-яА-Я]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      if (!hasLetter || !hasNumber) {
        setError('Пароль должен содержать буквы и числа');
        return;
      }
    }

    setLoading(true);

    try {
      // Обновляем только телефон (email меняется через отдельный механизм)
      const response = await api.put('/users/me', {
        phone: phone.replace(/\D/g, ''), // Отправляем только цифры
      });

      // Если меняем пароль
      if (showPasswordChange && currentPassword && newPassword) {
        await api.put('/users/me/password', {
          currentPassword,
          newPassword,
        });
      }

      onSave(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-form-container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Редактировать профиль</h2>
          <button className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            {/* Показываем кнопку смены email только для user и foreman */}
            {(user.role === 'user' || user.role === 'foreman') && (
              <>
                {!showEmailChange ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowEmailChange(true);
                      setEmailChangeStep('input');
                      setNewEmail('');
                      setConfirmationCode('');
                      setError('');
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    Изменить email
                  </button>
                ) : (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    {emailChangeStep === 'input' ? (
                      <>
                        <label htmlFor="newEmail">Новый email</label>
                        <input
                          type="email"
                          id="newEmail"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="example@mail.com"
                          style={{ marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleRequestEmailChange}
                            disabled={emailChangeLoading || !newEmail.trim()}
                          >
                            {emailChangeLoading ? 'Отправка...' : 'Отправить код'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowEmailChange(false);
                              setNewEmail('');
                              setError('');
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                        <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '10px' }}>
                          На новый email будет отправлен код подтверждения
                        </small>
                      </>
                    ) : (
                      <>
                        <label htmlFor="confirmationCode">Код подтверждения</label>
                        <input
                          type="text"
                          id="confirmationCode"
                          value={confirmationCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setConfirmationCode(value);
                          }}
                          placeholder="000000"
                          maxLength={6}
                          style={{ 
                            marginBottom: '10px',
                            fontSize: '18px',
                            letterSpacing: '5px',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleConfirmEmailChange}
                            disabled={emailChangeLoading || confirmationCode.length !== 6}
                          >
                            {emailChangeLoading ? 'Подтверждение...' : 'Подтвердить'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setEmailChangeStep('input');
                              setConfirmationCode('');
                            }}
                          >
                            Назад
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowEmailChange(false);
                              setEmailChangeStep('input');
                              setNewEmail('');
                              setConfirmationCode('');
                              setError('');
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                        <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '10px' }}>
                          Код отправлен на {newEmail}. Код действителен 15 минут.
                        </small>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            {user.role !== 'user' && user.role !== 'foreman' && (
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Администратор и охрана могут изменить email напрямую через администратора
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="fullName">ФИО</label>
            <input
              type="text"
              id="fullName"
              value={user.fullName}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>ФИО можно изменить только через администратора</small>
          </div>

          {/* Участки отображаются только для ролей user и foreman (только просмотр) */}
          {(user.role === 'user' || user.role === 'foreman') && (
            <div className="form-group">
              <label>Участки</label>
              {plots.length > 0 ? (
                <div style={{ marginBottom: '15px' }}>
                  {plots.map((plot) => (
                    <div key={plot.id} style={{ 
                      padding: '10px',
                      marginBottom: '10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px'
                    }}>
                      <div>
                        <div><strong>Участок:</strong> {plot.plotNumber}</div>
                        <div><strong>Адрес:</strong> {plot.address || '(не указан)'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#666', marginBottom: '15px' }}>Нет добавленных участков</div>
              )}
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '10px' }}>
                Для добавления или изменения участков обратитесь к администратору
              </small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="phone">Контактный телефон</label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                setPhone(formatted);
              }}
              placeholder="8(999)111-22-33"
              required
            />
          </div>

          <div className="form-group">
            <label>Telegram</label>
            {telegramLinkToken ? (
              <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '4px', border: '1px solid #b3d9ff' }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>📱 Код привязки Telegram:</p>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px', 
                  fontFamily: 'monospace', 
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: '10px',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  position: 'relative'
                }} onClick={copyTokenToClipboard} title="Нажмите для копирования">
                  {telegramLinkToken}
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  Откройте бота в Telegram: <a href="https://t.me/anosinopark_bot" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>@anosinopark_bot</a>
                </p>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  И отправьте команду:
                </p>
                <div style={{ 
                  padding: '8px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  marginBottom: '10px'
                }}>
                  /link {telegramLinkToken}
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>
                  ⏱ Код действителен 15 минут. Код скопирован в буфер обмена.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setTelegramLinkToken(null);
                    checkTelegramStatus();
                  }}
                  style={{ marginTop: '10px' }}
                >
                  Отменить
                </button>
              </div>
            ) : telegramLinked ? (
              <div style={{ marginTop: '10px' }}>
                <p style={{ color: '#28a745', marginBottom: '10px' }}>✅ Telegram привязан</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTelegramUnlink}
                  disabled={telegramLoading}
                >
                  {telegramLoading ? 'Отвязка...' : 'Отвязать Telegram'}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '10px' }}>
                <p style={{ color: '#666', marginBottom: '10px', fontSize: '14px' }}>
                  Telegram не привязан. Привяжите для создания заявок через бота.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTelegramLink}
                  disabled={telegramLoading}
                >
                  {telegramLoading ? 'Получение кода...' : '📱 Привязать Telegram'}
                </button>
              </div>
            )}
          </div>

          {/* Постоянные пропуска (только для user и foreman) */}
          {(user.role === 'user' || user.role === 'foreman') && (
            <PermanentPassesManager userId={user.id} />
          )}

          <div className="form-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              style={{ marginBottom: '10px' }}
            >
              {showPasswordChange ? 'Отменить смену пароля' : 'Изменить пароль'}
            </button>
          </div>

          {showPasswordChange && (
            <>
              <div className="form-group">
                <label htmlFor="currentPassword">Текущий пароль</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required={showPasswordChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">Новый пароль</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required={showPasswordChange}
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Подтвердите новый пароль</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={showPasswordChange}
                  minLength={6}
                />
              </div>
            </>
          )}

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileForm;

