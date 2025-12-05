import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatPhone } from '../utils/phoneFormatter';
import './UserModal.css';

interface User {
  id?: number;
  email: string;
  fullName: string;
  address: string;
  plotNumber: string;
  phone: string;
  role: string;
  deactivatedAt?: string | null;
  deactivationDate?: string | null;
}

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}

const UserModal = ({ user, onClose, onSave }: UserModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [plotNumber, setPlotNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('user');
  const [deactivationDate, setDeactivationDate] = useState('');
  const [deactivate, setDeactivate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setFullName(user.fullName);
      setAddress(user.address);
      setPlotNumber(user.plotNumber);
      setPhone(formatPhone(user.phone || ''));
      setRole(user.role);
      setDeactivationDate(user.deactivationDate || '');
      setDeactivate(!!user.deactivatedAt);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user && !password) {
      setError('Пароль обязателен для нового пользователя');
      return;
    }

    setLoading(true);

    try {
      if (!user) {
        // Создание нового пользователя
        const data: any = {
          email,
          password,
          fullName,
          address,
          plotNumber,
          phone,
          role,
        };
        if (role === 'foreman') {
          // Отправляем null если дата не указана или пустая
          const dateValue = deactivationDate?.trim();
          data.deactivationDate = (dateValue && dateValue !== '') ? dateValue : null;
        }
        await api.post('/users', data);
      } else {
        // Редактирование существующего пользователя
        const data: any = {
          email,
          fullName,
          address,
          plotNumber,
          phone: phone.replace(/\D/g, ''), // Отправляем только цифры
          role,
        };
        // Если роль прораб, отправляем дату деактивации
        if (role === 'foreman') {
          // Отправляем null если дата не указана или пустая
          const dateValue = deactivationDate?.trim();
          data.deactivationDate = (dateValue && dateValue !== '') ? dateValue : null;
        } else {
          // Если роль не прораб, отправляем null чтобы очистить существующую дату
          data.deactivationDate = null;
        }
        data.deactivate = deactivate;
        await api.put(`/users/${user.id}`, data);
      }

      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения пользователя');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{user ? 'Редактировать пользователя' : 'Создать пользователя'}</h2>
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

          {!user && (
            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="fullName">ФИО</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Адрес</label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="plotNumber">Номер участка</label>
            <input
              type="text"
              id="plotNumber"
              value={plotNumber}
              onChange={(e) => setPlotNumber(e.target.value)}
              required
            />
          </div>

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
            <label htmlFor="role">Роль</label>
            <select
              id="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                // Если меняем роль с прораба на другую, очищаем дату деактивации
                if (e.target.value !== 'foreman') {
                  setDeactivationDate('');
                }
              }}
              required
            >
              <option value="user">Пользователь</option>
              <option value="foreman">Прораб</option>
              <option value="security">Охрана</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

          {role === 'foreman' && (
            <div className="form-group">
              <label htmlFor="deactivationDate">Дата деактивации аккаунта</label>
              <input
                type="date"
                id="deactivationDate"
                value={deactivationDate}
                onChange={(e) => setDeactivationDate(e.target.value)}
                placeholder="Выберите дату деактивации"
              />
              <small style={{ color: '#666', fontSize: '12px' }}>Оставьте пустым, если деактивация не требуется</small>
            </div>
          )}

          {user && (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <div className="deactivate-checkbox-wrapper">
                <input
                  type="checkbox"
                  id="deactivate-checkbox"
                  checked={deactivate}
                  onChange={(e) => setDeactivate(e.target.checked)}
                />
                <label htmlFor="deactivate-checkbox">
                  Деактивировать аккаунт
                </label>
              </div>
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px', marginLeft: '28px' }}>
                Деактивированный пользователь не сможет войти в систему
              </small>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : user ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
