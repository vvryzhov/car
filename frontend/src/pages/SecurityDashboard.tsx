import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import SecurityPassModal from '../components/SecurityPassModal';
import Footer from '../components/Footer';
import { format } from 'date-fns';
import { formatPhone } from '../utils/phoneFormatter';

interface Pass {
  id: number;
  vehicleType: string;
  vehicleBrand?: string;
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
  const [activeTab, setActiveTab] = useState<'passes' | 'permanent'>('passes');
  const [passes, setPasses] = useState<Pass[]>([]);
  const [permanentPasses, setPermanentPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [permanentLoading, setPermanentLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterVehicleType, setFilterVehicleType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlotNumber, setFilterPlotNumber] = useState('');
  const [filterVehicleNumber, setFilterVehicleNumber] = useState('');
  const [editingPass, setEditingPass] = useState<Pass | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const fetchPasses = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const params: any = {};
      if (filterDate) params.date = filterDate;
      if (filterVehicleType) params.vehicleType = filterVehicleType;
      if (filterStatus) params.status = filterStatus;
      if (filterPlotNumber) params.plotNumber = filterPlotNumber;
      if (filterVehicleNumber) params.vehicleNumber = filterVehicleNumber;

      console.log('📥 Загрузка заявок с параметрами:', params);
      const response = await api.get('/passes/all', { params });
      console.log('✅ Заявки загружены, получено:', response.data.length, 'заявок');
      setPasses(response.data);
    } catch (error) {
      console.error('❌ Ошибка загрузки заявок:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [filterDate, filterVehicleType, filterStatus, filterPlotNumber, filterVehicleNumber]);

  const fetchPermanentPasses = useCallback(async () => {
    try {
      setPermanentLoading(true);
      const params: any = {};
      if (filterVehicleNumber) params.vehicleNumber = filterVehicleNumber;

      const response = await api.get('/users/permanent-passes', { params });
      setPermanentPasses(response.data);
    } catch (error) {
      console.error('Ошибка загрузки постоянных пропусков:', error);
    } finally {
      setPermanentLoading(false);
    }
  }, [filterVehicleNumber]);

  useEffect(() => {
    if (activeTab === 'permanent') {
      fetchPermanentPasses();
    }
  }, [activeTab, fetchPermanentPasses]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  // Подключение к SSE для получения обновлений в реальном времени + polling как fallback
  useEffect(() => {
    // Не подключаемся, если открыто модальное окно редактирования
    if (editingPass) return;

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ Токен не найден, используем только polling');
      // Используем только polling если нет токена
      const pollInterval = setInterval(() => {
        fetchPasses(false);
        if (activeTab === 'permanent') {
          fetchPermanentPasses();
        }
      }, 5000); // Обновляем каждые 5 секунд
      
      return () => clearInterval(pollInterval);
    }

    let eventSource: EventSource | null = null;
    let pollInterval: number | null = null;
    let sseWorking = false;

    // Функция для обновления списков
    const refreshLists = () => {
      console.log('🔄 Обновление списков заявок...');
      // Обновляем список обычных заявок
      fetchPasses(false);
      // Также обновляем список постоянных пропусков, если открыта соответствующая вкладка
      if (activeTab === 'permanent') {
        fetchPermanentPasses();
      }
    };

    // Пытаемся подключиться к SSE
    console.log('🔌 Подключение к SSE...');
    try {
      eventSource = new EventSource(`/api/passes/events?token=${encodeURIComponent(token)}`);

      // Обработка события новой заявки
      const handleNewPass = (event: MessageEvent) => {
        console.log('📨 [new-pass] Получено событие: новая заявка', {
          type: event.type,
          data: event.data,
          origin: event.origin,
          lastEventId: event.lastEventId
        });
        if (event.data) {
          try {
            const data = JSON.parse(event.data);
            console.log('📦 [new-pass] Распарсенные данные события:', data);
          } catch (e) {
            console.log('⚠️ [new-pass] Данные события (не JSON):', event.data);
          }
        }
        refreshLists();
      };
      eventSource.addEventListener('new-pass', handleNewPass);

      // Обработка события обновления заявки
      const handlePassUpdated = (event: MessageEvent) => {
        console.log('📨 [pass-updated] Получено событие: заявка обновлена', {
          type: event.type,
          data: event.data,
          origin: event.origin,
          lastEventId: event.lastEventId
        });
        if (event.data) {
          try {
            const data = JSON.parse(event.data);
            console.log('📦 [pass-updated] Распарсенные данные события:', data);
          } catch (e) {
            console.log('⚠️ [pass-updated] Данные события (не JSON):', event.data);
          }
        }
        refreshLists();
      };
      eventSource.addEventListener('pass-updated', handlePassUpdated);

      // Обработка события удаления заявки
      const handlePassDeleted = (event: MessageEvent) => {
        console.log('📨 [pass-deleted] Получено событие: заявка удалена', {
          type: event.type,
          data: event.data,
          origin: event.origin,
          lastEventId: event.lastEventId
        });
        if (event.data) {
          try {
            const data = JSON.parse(event.data);
            console.log('📦 [pass-deleted] Распарсенные данные события:', data);
          } catch (e) {
            console.log('⚠️ [pass-deleted] Данные события (не JSON):', event.data);
          }
        }
        refreshLists();
      };
      eventSource.addEventListener('pass-deleted', handlePassDeleted);

      // Обработка общих сообщений (на случай, если события приходят без типа)
      eventSource.onmessage = (event: MessageEvent) => {
        console.log('📨 Получено общее сообщение SSE (onmessage):', {
          type: event.type,
          data: event.data,
          origin: event.origin,
          lastEventId: event.lastEventId,
          target: event.target
        });
        // Если пришло сообщение без типа события, обновляем списки
        if (event.data && event.data !== 'connected' && event.data !== 'ping') {
          console.log('🔄 Обновление списков из-за общего сообщения');
          refreshLists();
        } else if (event.data === 'connected') {
          console.log('✅ Получено подтверждение подключения');
        } else if (event.data === 'ping') {
          console.log('💓 Получен ping от сервера');
        }
      };

      // Обработка подключения
      eventSource.onopen = (event) => {
        if (!eventSource) return;
        console.log('✅ SSE подключен успешно, readyState:', eventSource.readyState, event);
        sseWorking = true;
        // Если SSE работает, останавливаем polling
        if (pollInterval !== null) {
          clearInterval(pollInterval);
          pollInterval = null;
          console.log('🛑 Polling остановлен, SSE работает');
        }
      };

      // Обработка ошибок
      eventSource.onerror = (error) => {
        if (!eventSource) return;
        console.error('❌ Ошибка SSE соединения:', error);
        console.log('Состояние EventSource:', eventSource.readyState);
        console.log('URL:', eventSource.url);
        
        // Если SSE не работает, запускаем polling
        if (!sseWorking && pollInterval === null) {
          console.log('🔄 SSE не работает, запускаем polling каждые 5 секунд...');
          pollInterval = window.setInterval(() => {
            refreshLists();
          }, 5000);
        }
        
        // EventSource автоматически переподключается при ошибках
        // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('⚠️ Соединение закрыто, EventSource попытается переподключиться автоматически...');
          sseWorking = false;
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          console.log('🔄 Переподключение...');
          sseWorking = false;
        } else if (eventSource.readyState === EventSource.OPEN) {
          console.log('✅ Соединение открыто, но произошла ошибка');
        }
      };
    } catch (error) {
      console.error('❌ Ошибка создания EventSource:', error);
      // Если не удалось создать EventSource, используем только polling
      console.log('🔄 Используем только polling...');
      pollInterval = window.setInterval(() => {
        refreshLists();
      }, 5000);
    }

    // Запускаем polling сразу как fallback (будет остановлен если SSE заработает)
    if (pollInterval === null) {
      pollInterval = window.setInterval(() => {
        refreshLists();
      }, 5000);
    }

    // Очистка при размонтировании или при открытии модального окна
    return () => {
      console.log('🔌 Закрытие SSE соединения и polling');
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval !== null) {
        clearInterval(pollInterval);
      }
    };
  }, [fetchPasses, fetchPermanentPasses, editingPass, activeTab]);

  const clearFilters = () => {
    setFilterDate('');
    setFilterVehicleType('');
    setFilterStatus('');
    setFilterPlotNumber('');
    setFilterVehicleNumber('');
  };

  const handleStatusToggle = async (pass: Pass) => {
    if (updatingStatus === pass.id) return; // Предотвращаем двойные клики
    
    setUpdatingStatus(pass.id);
    
    try {
      // Переключаем статус: pending <-> activated
      const newStatus = pass.status === 'pending' ? 'activated' : 'pending';
      
      await api.put(`/passes/${pass.id}`, {
        ...pass,
        status: newStatus,
      });
      
      // Обновляем список
      fetchPasses(false);
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      alert('Ошибка изменения статуса заявки');
    } finally {
      setUpdatingStatus(null);
    }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Заявки на пропуск</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className={`btn ${activeTab === 'passes' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('passes')}
              >
                Обычные заявки
              </button>
              <button
                className={`btn ${activeTab === 'permanent' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('permanent')}
              >
                Личный транспорт
              </button>
            </div>
          </div>

          {activeTab === 'passes' && (
            <>
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
            <div className="form-group">
              <label htmlFor="filterStatus">Статус</label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Все</option>
                <option value="pending">Ожидает</option>
                <option value="activated">Заехал</option>
                <option value="rejected">Отклонено</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="filterPlotNumber">Участок</label>
              <input
                type="text"
                id="filterPlotNumber"
                value={filterPlotNumber}
                onChange={(e) => setFilterPlotNumber(e.target.value)}
                placeholder="Номер участка"
              />
            </div>
            <div className="form-group">
              <label htmlFor="filterVehicleNumber">Номер авто</label>
              <input
                type="text"
                id="filterVehicleNumber"
                value={filterVehicleNumber}
                onChange={(e) => setFilterVehicleNumber(e.target.value.toUpperCase())}
                placeholder="Поиск по номеру"
                style={{ textTransform: 'uppercase' }}
              />
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
                    <th>Телефон</th>
                    <th>Тип транспорта</th>
                    <th>Марка авто</th>
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
                    <td data-label="Телефон">{formatPhone(pass.phone || '')}</td>
                    <td data-label="Тип транспорта">{pass.vehicleType}</td>
                    <td data-label="Марка авто">{pass.vehicleBrand || '-'}</td>
                    <td data-label="Номер авто">{pass.vehicleNumber}</td>
                    <td data-label="Дата въезда">
                      {format(new Date(pass.entryDate), 'dd.MM.yyyy')}
                    </td>
                    <td data-label="Адрес">{pass.address}</td>
                    <td data-label="Комментарий">{pass.comment || '-'}</td>
                    <td data-label="Комментарий охраны">{pass.securityComment || '-'}</td>
                    <td data-label="Статус">
                      {pass.status === 'personal_vehicle' ? (
                        <span className="badge badge-personal_vehicle">
                          Личный транспорт
                        </span>
                      ) : pass.status === 'pending' || pass.status === 'activated' ? (
                        <button
                          className={`btn ${pass.status === 'pending' ? 'btn-warning' : 'btn-success'}`}
                          onClick={() => handleStatusToggle(pass)}
                          disabled={updatingStatus === pass.id}
                          style={{
                            padding: '5px 10px',
                            fontSize: '14px',
                            minWidth: '100px',
                            cursor: updatingStatus === pass.id ? 'wait' : 'pointer',
                          }}
                          title={pass.status === 'pending' ? 'Нажмите, чтобы отметить как "Заехал"' : 'Нажмите, чтобы вернуть статус "Ожидает"'}
                        >
                          {updatingStatus === pass.id ? '...' : (pass.status === 'pending' ? 'Ожидает → Заехал' : 'Заехал → Ожидает')}
                        </button>
                      ) : (
                        <span className={`badge badge-${pass.status}`}>
                          Отклонено
                        </span>
                      )}
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
            </>
          )}

          {activeTab === 'permanent' && (
            <>
              <div className="filters" style={{ marginBottom: '20px' }}>
                <div className="form-group">
                  <label htmlFor="filterVehicleNumberPermanent">Номер авто</label>
                  <input
                    type="text"
                    id="filterVehicleNumberPermanent"
                    value={filterVehicleNumber}
                    onChange={(e) => setFilterVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="Поиск по номеру"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setFilterVehicleNumber('')}>
                    Сбросить
                  </button>
                </div>
              </div>

              {permanentLoading ? (
                <div className="loading">Загрузка...</div>
              ) : permanentPasses.length === 0 ? (
                <div className="empty-state">
                  <p>Постоянных пропусков не найдено</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ФИО</th>
                        <th>Телефон</th>
                        <th>Тип транспорта</th>
                        <th>Марка авто</th>
                        <th>Номер авто</th>
                        <th>Адрес</th>
                        <th>Комментарий</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permanentPasses.map((pass) => (
                        <tr key={pass.id}>
                          <td data-label="ФИО">{pass.fullName}</td>
                          <td data-label="Телефон">{formatPhone(pass.phone || '')}</td>
                          <td data-label="Тип транспорта">{pass.vehicleType}</td>
                          <td data-label="Марка авто">{pass.vehicleBrand || '-'}</td>
                          <td data-label="Номер авто">{pass.vehicleNumber}</td>
                          <td data-label="Адрес">{pass.address}</td>
                          <td data-label="Комментарий">{pass.comment || '-'}</td>
                          <td data-label="Статус">
                            <span className="badge badge-personal_vehicle">
                              Личный транспорт
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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

