import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import PassForm from '../components/PassForm';
import ProfileForm from '../components/ProfileForm';
import Footer from '../components/Footer';
import { format } from 'date-fns';
import { formatVehicleNumber } from '../utils/vehicleNumberValidator';

interface Pass {
  id: number;
  vehicleType: string;
  vehicleBrand?: string;
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
  const [showProfileForm, setShowProfileForm] = useState(false);
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
    setShowProfileForm(false);
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Личный кабинет</h1>
          <div className="header-actions">
            <span className="user-info">
              {user?.fullName}
              {/* Показываем количество участков только для ролей user и foreman */}
              {user?.role !== 'security' && user?.role !== 'admin' && user?.plots && user.plots.length > 0 && (
                <span style={{ color: '#666', fontSize: '0.9em', marginLeft: '8px' }}>
                  ({user.plots.length} {user.plots.length === 1 ? 'участок' : 'участков'})
                </span>
              )}
            </span>
            <button className="btn btn-secondary" onClick={() => setShowProfileForm(true)}>
              Профиль
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.href = '/help'} style={{ marginRight: '10px' }}>
              Справка
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.href = '/feedback'} style={{ marginRight: '10px' }}>
              Обратная связь
            </button>
            <button className="btn btn-secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {showProfileForm ? (
          <ProfileForm
            user={user!}
            onCancel={() => setShowProfileForm(false)}
            onSave={handleProfileSaved}
          />
        ) : showPassModal ? (
          <PassForm
            pass={editingPass}
            user={user!}
            onCancel={() => {
              setShowPassModal(false);
              setEditingPass(null);
            }}
            onSave={handlePassSaved}
          />
        ) : (
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
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Тип транспорта</th>
                      <th>Марка авто</th>
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
                      <td data-label="Марка авто">{pass.vehicleBrand || '-'}</td>
                      <td data-label="Номер авто">{formatVehicleNumber(pass.vehicleNumber)}</td>
                      <td data-label="Дата въезда">
                        {format(new Date(pass.entryDate), 'dd.MM.yyyy')}
                      </td>
                      <td data-label="Адрес">{pass.address}</td>
                      <td data-label="Комментарий">{pass.comment || '-'}</td>
                      <td data-label="Статус">
                        {pass.status === 'personal_vehicle' ? (
                          <span className="badge badge-personal_vehicle">
                            Личный транспорт
                          </span>
                        ) : (
                          <span className={`badge badge-${pass.status}`}>
                            {pass.status === 'pending' ? 'Ожидает' : 
                             pass.status === 'activated' ? 'Заехал' : 
                             'Отклонено'}
                          </span>
                        )}
                      </td>
                      <td data-label="Действия">
                        {pass.status === 'activated' ? (
                          <span style={{ color: '#666', fontSize: '14px' }}>
                            Заявка завершена
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleEditPass(pass)}
                              style={{ padding: '5px 10px', fontSize: '14px' }}
                            >
                              Редактировать
                            </button>
                            {pass.status !== 'activated' && (
                              <button
                                className="btn btn-danger"
                                onClick={() => handleDeletePass(pass.id)}
                                style={{ padding: '5px 10px', fontSize: '14px' }}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;

