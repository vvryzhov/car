import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
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

  useEffect(() => {
    fetchPasses();
  }, [filterDate, filterVehicleType]);

  const fetchPasses = async () => {
    try {
      const params: any = {};
      if (filterDate) params.date = filterDate;
      if (filterVehicleType) params.vehicleType = filterVehicleType;

      const response = await api.get('/passes/all', { params });
      setPasses(response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    setLoading(true);
    fetchPasses();
  };

  const clearFilters = () => {
    setFilterDate('');
    setFilterVehicleType('');
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Панель охраны</h1>
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
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((pass) => (
                  <tr key={pass.id}>
                    <td>{pass.fullName}</td>
                    <td>{pass.plotNumber}</td>
                    <td>{pass.phone}</td>
                    <td>{pass.vehicleType}</td>
                    <td>{pass.vehicleNumber}</td>
                    <td>
                      {format(new Date(pass.entryDate), 'dd.MM.yyyy')}
                    </td>
                    <td>{pass.address}</td>
                    <td>{pass.comment || '-'}</td>
                    <td>
                      <span className={`badge badge-${pass.status}`}>
                        {pass.status === 'pending' ? 'Ожидает' : pass.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;

