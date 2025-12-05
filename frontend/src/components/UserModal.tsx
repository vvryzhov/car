import { useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id?: number;
  email: string;
  fullName: string;
  address: string;
  plotNumber: string;
  phone: string;
  role: string;
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setFullName(user.fullName);
      setAddress(user.address);
      setPlotNumber(user.plotNumber);
      setPhone(user.phone);
      setRole(user.role);
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
        await api.post('/users', data);
      } else {
        // Редактирование существующего пользователя
        const data: any = {
          email,
          fullName,
          address,
          plotNumber,
          phone,
          role,
        };
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
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Роль</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="user">Пользователь</option>
              <option value="security">Охрана</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

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
