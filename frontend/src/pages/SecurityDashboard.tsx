import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import SecurityPassModal from '../components/SecurityPassModal';
import Footer from '../components/Footer';
import { format } from 'date-fns';

interface Pass {
  id: number;
  vehicleType: string;
  vehicleNumber: string;
  entryDate: string;
  address: string;
  comment: string | null;
  securityComment: string | null;
  status: string;
  createdAt: string;
  fullName: string;
  plotNumber: string;
  phone: string;
}

const SecurityDashboard = () => {
  const { user, logout } = useAuth();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterVehicleType, setFilterVehicleType] = useState('');
  const [editingPass, setEditingPass] = useState<Pass | null>(null);

  const fetchPasses = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const params: any = {};
      if (filterDate) params.date = filterDate;
      if (filterVehicleType) params.vehicleType = filterVehicleType;

      const response = await api.get('/passes/all', { params });
      setPasses(response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [filterDate, filterVehicleType]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  // Автоматическое обновление списка каждые 30 секунд
  useEffect(() => {
    // Не обновляем, если открыто модальное окно редактирования
    if (editingPass) return;

    const interval = setInterval(() => {
      fetchPasses(false); // false - не показывать loading при автообновлении
    }, 30000); // 30 секунд

    return () => clearInterval(interval);
  }, [fetchPasses, editingPass]);

  const clearFilters = () => {
    setFilterDate('');
    setFilterVehicleType('');
  };

  const handleEditPass = (pass: Pass) => {
    setEditingPass(pass);
  };

  const handlePassSaved = () => {
    setEditingPass(null);
    fetchPasses();
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Панель охраны</h1>
          <div className="header-actions">
            <span className="user-info">{user?.fullName}</span>
            <button className="btn btn-secondary" onClick={() => window.location.href = '/help'} style={{ marginRight: '10px' }}>
              Справка
            </button>
            <button className="btn btn-secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h2>Заявки на пропуск</h2>

          <div className="filters">
            <div className="form-group">
              <label htmlFor="filterDate">Дата въезда</label>
              <input
                type="date"
                id="filterDate"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="filterVehicleType">Тип транспорта</label>
              <select
                id="filterVehicleType"
                value={filterVehicleType}
                onChange={(e) => setFilterVehicleType(e.target.value)}
              >
                <option value="">Все</option>
                <option value="грузовой">Грузовой</option>
                <option value="легковой">Легковой</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={clearFilters}>
                Сбросить фильтры
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : passes.length === 0 ? (
            <div className="empty-state">
              <p>Заявок не найдено</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Участок</th>
                    <th>Телефон</th>
                    <th>Тип транспорта</th>
                    <th>Номер авто</th>
                    <th>Дата въезда</th>
                    <th>Адрес</th>
                    <th>Комментарий</th>
                    <th>Комментарий охраны</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
              <tbody>
                {passes.map((pass) => (
                  <tr key={pass.id}>
                    <td data-label="ФИО">{pass.fullName}</td>
                    <td data-label="Участок">{pass.plotNumber}</td>
                    <td data-label="Телефон">{pass.phone}</td>
                    <td data-label="Тип транспорта">{pass.vehicleType}</td>
                    <td data-label="Номер авто">{pass.vehicleNumber}</td>
                    <td data-label="Дата въезда">
                      {format(new Date(pass.entryDate), 'dd.MM.yyyy')}
                    </td>
                    <td data-label="Адрес">{pass.address}</td>
                    <td data-label="Комментарий">{pass.comment || '-'}</td>
                    <td data-label="Комментарий охраны">{pass.securityComment || '-'}</td>
                    <td data-label="Статус">
                      <span className={`badge badge-${pass.status}`}>
                        {pass.status === 'pending' ? 'Ожидает' : 
                         pass.status === 'activated' ? 'Заехал' : 
                         'Отклонено'}
                      </span>
                    </td>
                    <td data-label="Действия">
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEditPass(pass)}
                        style={{ padding: '5px 10px', fontSize: '14px' }}
                      >
                        Редактировать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingPass && (
        <SecurityPassModal
          pass={editingPass}
          onClose={() => setEditingPass(null)}
          onSave={handlePassSaved}
        />
      )}
      <Footer />
    </div>
  );
};

export default SecurityDashboard;

