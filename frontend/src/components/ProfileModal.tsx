import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatPhone } from '../utils/phoneFormatter';

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
}

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (userData: User) => void;
}

const ProfileModal = ({ user, onClose, onSave }: ProfileModalProps) => {
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(formatPhone(user.phone || ''));
  const [plots, setPlots] = useState<Plot[]>(user.plots || []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  useEffect(() => {
    // Загружаем участки только для ролей user и foreman
    if (user.role === 'user' || user.role === 'foreman') {
      fetchPlots();
    }
  }, [user.id, user.role]);

  const fetchPlots = async () => {
    try {
      const response = await api.get(`/users/${user.id}/plots`);
      setPlots(response.data);
    } catch (error) {
      console.error('Ошибка загрузки участков:', error);
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
      // Обновляем email и телефон
      const response = await api.put('/users/me', {
        email,
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Редактировать профиль</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
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

export default ProfileModal;
