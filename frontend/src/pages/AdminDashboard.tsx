import { useState, useEffect } from 'react';
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
  createdAt: string;
}

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);

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
                        <span className={`badge ${u.role === 'admin' ? 'badge-approved' : u.role === 'security' ? 'badge-pending' : ''}`}>
                          {u.role === 'admin' ? 'Администратор' : u.role === 'security' ? 'Охрана' : 'Пользователь'}
                        </span>
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

