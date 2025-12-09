import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatPhone } from '../utils/phoneFormatter';
import { useAuth } from '../contexts/AuthContext';
import './UserModal.css';

interface Plot {
  id: number;
  address: string;
  plotNumber: string;
}

interface User {
  id?: number;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  deactivatedAt?: string | null;
  deactivationDate?: string | null;
  plots?: Plot[];
}

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}

const UserModal = ({ user, onClose, onSave }: UserModalProps) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('user');
  const [deactivationDate, setDeactivationDate] = useState('');
  const [deactivate, setDeactivate] = useState(false);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [originalPlots, setOriginalPlots] = useState<Plot[]>([]); // Сохраняем исходные участки для сравнения
  const [editingPlotIndex, setEditingPlotIndex] = useState<number | null>(null);
  const [editingPlotAddress, setEditingPlotAddress] = useState('');
  const [editingPlotNumber, setEditingPlotNumber] = useState('');
  const [newPlotAddress, setNewPlotAddress] = useState('');
  const [newPlotNumber, setNewPlotNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setFullName(user.fullName);
      setPhone(formatPhone(user.phone || ''));
      setRole(user.role);
      // Форматируем дату для input type="date" (нужен формат YYYY-MM-DD)
      const dateValue = user.deactivationDate 
        ? (user.deactivationDate.split('T')[0] || user.deactivationDate) 
        : '';
      setDeactivationDate(dateValue);
      setDeactivate(!!user.deactivatedAt);
      // Загружаем участки: для ролей user и foreman всегда, для других - только если админ редактирует
      if (user.role === 'user' || user.role === 'foreman' || (isAdmin && user.role !== 'security' && user.role !== 'admin')) {
        fetchUserPlots();
      } else {
        setPlots([]);
      }
    } else {
      setPlots([]);
    }
  }, [user, isAdmin]);

  const fetchUserPlots = async () => {
    if (!user?.id) return;
    try {
      const response = await api.get(`/users/${user.id}/plots`);
      const plotsData = response.data || [];
      setPlots(plotsData);
      setOriginalPlots(plotsData); // Сохраняем исходные участки
    } catch (error) {
      console.error('Ошибка загрузки участков:', error);
    }
  };

  const handleAddPlot = () => {
    if (!newPlotAddress || !newPlotNumber) {
      setError('Заполните адрес и номер участка');
      return;
    }
    setPlots([...plots, { id: Date.now(), address: newPlotAddress, plotNumber: newPlotNumber }]);
    setNewPlotAddress('');
    setNewPlotNumber('');
    setError('');
  };

  const handleRemovePlot = (index: number) => {
    setPlots(plots.filter((_, i) => i !== index));
    setEditingPlotIndex(null);
  };

  const handleStartEditPlot = (index: number) => {
    setEditingPlotIndex(index);
    setEditingPlotAddress(plots[index].address);
    setEditingPlotNumber(plots[index].plotNumber);
  };

  const handleSaveEditPlot = () => {
    if (editingPlotIndex === null) return;
    if (!editingPlotAddress || !editingPlotNumber) {
      setError('Заполните адрес и номер участка');
      return;
    }
    
    const updatedPlots = [...plots];
    updatedPlots[editingPlotIndex] = {
      ...updatedPlots[editingPlotIndex],
      address: editingPlotAddress,
      plotNumber: editingPlotNumber,
    };
    setPlots(updatedPlots);
    setEditingPlotIndex(null);
    setEditingPlotAddress('');
    setEditingPlotNumber('');
    setError('');
  };

  const handleCancelEditPlot = () => {
    setEditingPlotIndex(null);
    setEditingPlotAddress('');
    setEditingPlotNumber('');
  };

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
        // Участки обязательны только для ролей user и foreman
        if ((role === 'user' || role === 'foreman') && plots.length === 0) {
          setError('Добавьте хотя бы один участок');
          return;
        }
        const data: any = {
          email,
          password,
          fullName,
          phone: phone.replace(/\D/g, ''), // Отправляем только цифры
          role,
        };
        // Отправляем участки только для ролей user и foreman
        if (role === 'user' || role === 'foreman') {
          data.plots = plots.map(p => ({ address: p.address, plotNumber: p.plotNumber }));
        }
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
        // Отправляем участки только если они были изменены
        const shouldSendPlots = role === 'user' || role === 'foreman' || (isAdmin && role !== 'security' && role !== 'admin');
        if (shouldSendPlots) {
          // Проверяем, изменились ли участки
          const plotsChanged = JSON.stringify(plots) !== JSON.stringify(originalPlots);
          if (plotsChanged) {
            // Отправляем участки только если они изменились
            data.plots = plots.map(p => ({ 
              id: p.id && p.id > 1000000 ? p.id : null, // Отправляем ID только для существующих участков
              address: p.address || '', 
              plotNumber: p.plotNumber 
            }));
          }
          // Если участки не изменились, не отправляем их вообще (undefined)
        } else if (role === 'security' || role === 'admin') {
          // Для security и admin отправляем пустой массив, чтобы удалить участки
          data.plots = [];
        }
        console.log('Отправка данных пользователя с участками:', data);
        const response = await api.put(`/users/${user.id}`, data);
        console.log('Ответ сервера:', response.data);
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

          {/* Участки отображаются для ролей user и foreman, или если админ редактирует пользователя */}
          {(role === 'user' || role === 'foreman' || (isAdmin && role !== 'security' && role !== 'admin')) && (
            <div className="form-group">
              <label>Участки (адрес и номер участка - единое целое)</label>
              {plots.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  {plots.map((plot, index) => (
                    <div key={plot.id || index} style={{ 
                      padding: '10px',
                      marginBottom: '10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: editingPlotIndex === index ? '2px solid #007bff' : '1px solid #ddd'
                    }}>
                      {editingPlotIndex === index ? (
                        <div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Номер участка</label>
                            <input
                              type="text"
                              value={editingPlotNumber}
                              onChange={(e) => setEditingPlotNumber(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                          </div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Адрес</label>
                            <input
                              type="text"
                              value={editingPlotAddress}
                              onChange={(e) => setEditingPlotAddress(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleSaveEditPlot}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={handleCancelEditPlot}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div><strong>Участок:</strong> {plot.plotNumber}</div>
                            <div><strong>Адрес:</strong> {plot.address || '(не указан)'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            {isAdmin && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleStartEditPlot(index)}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                Редактировать
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleRemovePlot(index)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ borderTop: '1px solid #ddd', paddingTop: '15px', marginTop: '15px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Добавить участок</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Номер участка"
                    value={newPlotNumber}
                    onChange={(e) => setNewPlotNumber(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="Адрес"
                    value={newPlotAddress}
                    onChange={(e) => setNewPlotAddress(e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddPlot}
                  >
                    Добавить
                  </button>
                </div>
              </div>
              {!user && plots.length === 0 && (
                <small style={{ color: '#dc3545', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  Необходимо добавить хотя бы один участок
                </small>
              )}
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
                // Если меняем роль на security или admin, очищаем участки
                if (e.target.value === 'security' || e.target.value === 'admin') {
                  setPlots([]);
                } else if (user && (e.target.value === 'user' || e.target.value === 'foreman')) {
                  // Если меняем на user или foreman, загружаем участки
                  fetchUserPlots();
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
