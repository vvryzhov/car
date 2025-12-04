import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import PassModal from '../components/PassModal';
import ProfileModal from '../components/ProfileModal';
import { format } from 'date-fns';

interface Pass {
  id: number;
  vehicleType: string;
  vehicleNumber: string;
  entryDate: string;
  address: string;
  comment: string | null;
  status: string;
  createdAt: string;
}

const Dashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingPass, setEditingPass] = useState<Pass | null>(null);

  useEffect(() => {
    fetchPasses();
  }, []);

  const fetchPasses = async () => {
    try {
      const response = await api.get('/passes');
      setPasses(response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePass = () => {
    setEditingPass(null);
    setShowPassModal(true);
  };

  const handleEditPass = (pass: Pass) => {
    setEditingPass(pass);
    setShowPassModal(true);
  };

  const handleDeletePass = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту заявку?')) {
      return;
    }

    try {
      await api.delete(`/passes/${id}`);
      fetchPasses();
    } catch (error) {
      console.error('Ошибка удаления заявки:', error);
      alert('Ошибка удаления заявки');
    }
  };

  const handlePassSaved = () => {
    setShowPassModal(false);
    setEditingPass(null);
    fetchPasses();
  };

  const handleProfileSaved = (userData: any) => {
    updateUser(userData);
    setShowProfileModal(false);
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Личный кабинет</h1>
          <div className="header-actions">
            <span className="user-info">
              {user?.fullName} ({user?.plotNumber})
            </span>
            <button className="btn btn-secondary" onClick={() => setShowProfileModal(true)}>
              Профиль
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
            <h2>Мои заявки на пропуск</h2>
            <button className="btn btn-primary" onClick={handleCreatePass}>
              Заказать пропуск
            </button>
          </div>

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : passes.length === 0 ? (
            <div className="empty-state">
              <p>У вас пока нет заявок</p>
              <button className="btn btn-primary" onClick={handleCreatePass}>
                Создать первую заявку
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Тип транспорта</th>
                  <th>Номер авто</th>
                  <th>Дата въезда</th>
                  <th>Адрес</th>
                  <th>Комментарий</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((pass) => (
                  <tr key={pass.id}>
                    <td data-label="Тип транспорта">{pass.vehicleType}</td>
                    <td data-label="Номер авто">{pass.vehicleNumber}</td>
                    <td data-label="Дата въезда">
                      {format(new Date(pass.entryDate), 'dd.MM.yyyy')}
                    </td>
                    <td data-label="Адрес">{pass.address}</td>
                    <td data-label="Комментарий">{pass.comment || '-'}</td>
                    <td data-label="Статус">
                      <span className={`badge badge-${pass.status}`}>
                        {pass.status === 'pending' ? 'Ожидает' : 
                         pass.status === 'approved' ? 'Одобрено' : 
                         pass.status === 'activated' ? 'Активирован' : 
                         'Отклонено'}
                      </span>
                    </td>
                    <td data-label="Действия">
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEditPass(pass)}
                          style={{ padding: '5px 10px', fontSize: '14px' }}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeletePass(pass.id)}
                          style={{ padding: '5px 10px', fontSize: '14px' }}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showPassModal && (
        <PassModal
          pass={editingPass}
          user={user!}
          onClose={() => {
            setShowPassModal(false);
            setEditingPass(null);
          }}
          onSave={handlePassSaved}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          user={user!}
          onClose={() => setShowProfileModal(false)}
          onSave={handleProfileSaved}
        />
      )}
    </div>
  );
};

export default Dashboard;

