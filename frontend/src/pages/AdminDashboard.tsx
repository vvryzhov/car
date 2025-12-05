import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import UserModal from '../components/UserModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import Footer from '../components/Footer';

interface User {
  id: number;
  email: string;
  fullName: string;
  address: string;
  plotNumber: string;
  phone: string;
  role: string;
  deactivatedAt?: string | null;
  deactivationDate?: string | null;
  createdAt: string;
}

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    email: '',
    phone: '',
    fullName: '',
    plotNumber: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.email) params.append('email', filters.email);
      if (filters.phone) params.append('phone', filters.phone);
      if (filters.fullName) params.append('fullName', filters.fullName);
      if (filters.plotNumber) params.append('plotNumber', filters.plotNumber);

      const response = await api.get(`/users?${params.toString()}`);
      setUsers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchUsers();
  };

  const handleClearFilters = () => {
    setFilters({ email: '', phone: '', fullName: '', plotNumber: '' });
    setLoading(true);
    setTimeout(() => {
      fetchUsers();
    }, 100);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleUserSaved = () => {
    setShowUserModal(false);
    setEditingUser(null);
    fetchUsers();
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Панель администратора</h1>
          <div className="header-actions">
            <span className="user-info">{user?.fullName}</span>
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/settings')}
              style={{ marginRight: '10px' }}
            >
              Настройки
            </button>
            <button className="btn btn-secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Управление пользователями</h2>
            <button className="btn btn-primary" onClick={handleCreateUser}>
              Создать пользователя
            </button>
          </div>

          <form onSubmit={handleFilterSubmit} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Email</label>
                <input
                  type="text"
                  value={filters.email}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  placeholder="Поиск по email"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Телефон</label>
                <input
                  type="text"
                  value={filters.phone}
                  onChange={(e) => handleFilterChange('phone', e.target.value)}
                  placeholder="Поиск по телефону"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>ФИО</label>
                <input
                  type="text"
                  value={filters.fullName}
                  onChange={(e) => handleFilterChange('fullName', e.target.value)}
                  placeholder="Поиск по ФИО"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Участок</label>
                <input
                  type="text"
                  value={filters.plotNumber}
                  onChange={(e) => handleFilterChange('plotNumber', e.target.value)}
                  placeholder="Поиск по участку"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                Применить фильтры
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClearFilters} style={{ padding: '8px 16px' }}>
                Очистить
              </button>
            </div>
          </form>

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>Пользователей не найдено</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>ФИО</th>
                    <th>Адрес</th>
                    <th>Участок</th>
                    <th>Телефон</th>
                    <th>Роль</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Email">{u.email}</td>
                      <td data-label="ФИО">{u.fullName}</td>
                      <td data-label="Адрес">{u.address}</td>
                      <td data-label="Участок">{u.plotNumber}</td>
                      <td data-label="Телефон">{u.phone}</td>
                      <td data-label="Роль">
                        <span className={`badge ${u.role === 'admin' ? 'badge-approved' : u.role === 'security' ? 'badge-pending' : u.role === 'foreman' ? 'badge-activated' : ''}`}>
                          {u.role === 'admin' ? 'Администратор' : u.role === 'security' ? 'Охрана' : u.role === 'foreman' ? 'Прораб' : 'Пользователь'}
                        </span>
                        {(u.deactivatedAt || (u.deactivationDate && new Date(u.deactivationDate) <= new Date())) && (
                          <span className="badge" style={{ backgroundColor: '#dc3545', marginLeft: '5px' }}>Деактивирован</span>
                        )}
                      </td>
                      <td data-label="Дата создания">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                      <td data-label="Действия">
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingUser(u);
                              setShowUserModal(true);
                            }}
                            style={{ padding: '5px 10px', fontSize: '14px' }}
                          >
                            Редактировать
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setPasswordUserId(u.id);
                              setShowPasswordModal(true);
                            }}
                            style={{ padding: '5px 10px', fontSize: '14px' }}
                          >
                            Сменить пароль
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showUserModal && (
        <UserModal
          user={editingUser}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
          }}
          onSave={handleUserSaved}
        />
      )}

      {showPasswordModal && passwordUserId && (
        <ChangePasswordModal
          userId={passwordUserId}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordUserId(null);
          }}
          onSuccess={() => {
            fetchUsers();
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default AdminDashboard;

