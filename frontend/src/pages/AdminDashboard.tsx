import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import UserModal from '../components/UserModal';

interface User {
  id: number;
  email: string;
  fullName: string;
  address: string;
  plotNumber: string;
  phone: string;
  role: string;
  createdAt: string;
}

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    } finally {
      setLoading(false);
    }
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

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>Пользователей не найдено</p>
            </div>
          ) : (
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
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.fullName}</td>
                    <td>{u.address}</td>
                    <td>{u.plotNumber}</td>
                    <td>{u.phone}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-approved' : u.role === 'security' ? 'badge-pending' : ''}`}>
                        {u.role === 'admin' ? 'Администратор' : u.role === 'security' ? 'Охрана' : 'Пользователь'}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
};

export default AdminDashboard;

