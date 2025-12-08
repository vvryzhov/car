import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import UserModal from '../components/UserModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import Footer from '../components/Footer';
import { format } from 'date-fns';

interface Plot {
  id: number;
  address: string;
  plotNumber: string;
}

interface User {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  deactivatedAt?: string | null;
  deactivationDate?: string | null;
  createdAt: string;
  plots?: Plot[];
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
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'passes'>('users');
  const [filters, setFilters] = useState({
    email: '',
    phone: '',
    fullName: '',
    plotNumber: '',
    role: '',
  });
  const [passes, setPasses] = useState<any[]>([]);
  const [passesLoading, setPassesLoading] = useState(false);
  const [passFilters, setPassFilters] = useState({
    date: '',
    vehicleType: '',
    userId: '',
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
      if (filters.role) params.append('role', filters.role);

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
    setFilters({ email: '', phone: '', fullName: '', plotNumber: '', role: '' });
    setLoading(true);
    setTimeout(() => {
      fetchUsers();
    }, 100);
  };

  const fetchPasses = async () => {
    try {
      setPassesLoading(true);
      const params = new URLSearchParams();
      if (passFilters.date) params.append('date', passFilters.date);
      if (passFilters.vehicleType) params.append('vehicleType', passFilters.vehicleType);
      if (passFilters.userId) params.append('userId', passFilters.userId);
      if (passFilters.plotNumber) params.append('plotNumber', passFilters.plotNumber);

      const response = await api.get(`/passes/all?${params.toString()}`);
      setPasses(response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    } finally {
      setPassesLoading(false);
    }
  };

  const handlePassFilterChange = (field: string, value: string) => {
    setPassFilters({ ...passFilters, [field]: value });
  };

  const handlePassFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPasses();
  };

  const handleClearPassFilters = () => {
    setPassFilters({ date: '', vehicleType: '', userId: '', plotNumber: '' });
    fetchPasses();
  };

  const handleExportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (passFilters.date) params.append('date', passFilters.date);
      if (passFilters.vehicleType) params.append('vehicleType', passFilters.vehicleType);
      if (passFilters.userId) params.append('userId', passFilters.userId);
      if (passFilters.plotNumber) params.append('plotNumber', passFilters.plotNumber);

      const response = await api.get(`/passes/export/excel?${params.toString()}`, {
        responseType: 'blob',
      });

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `заявки_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Ошибка при экспорте файла');
    }
  };

  const handleDeletePass = async (passId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту заявку?')) {
      return;
    }

    try {
      await api.delete(`/passes/${passId}`);
      fetchPasses(); // Обновляем список
    } catch (error) {
      console.error('Ошибка удаления заявки:', error);
      alert('Ошибка при удалении заявки');
    }
  };

  useEffect(() => {
    if (activeTab === 'passes') {
      // Загружаем пользователей для фильтра, если они еще не загружены
      if (users.length === 0) {
        fetchUsers();
      }
      fetchPasses();
    }
  }, [activeTab]);

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleUserSaved = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setSelectedUsers([]);
    fetchUsers();
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка удаления пользователя');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      alert('Выберите пользователей для удаления');
      return;
    }

    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedUsers.length} пользователей?`)) {
      return;
    }

    try {
      await api.post('/users/bulk-delete', { userIds: selectedUsers });
      setSelectedUsers([]);
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка массового удаления');
    }
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      alert('Выберите CSV файл');
      return;
    }

    const formData = new FormData();
    formData.append('csv', csvFile);

    try {
      const response = await api.post('/users/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadResult(response.data);
      setCsvFile(null);
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка загрузки CSV');
    }
  };

  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSendResetLink = async (userId: number, email: string) => {
    if (!window.confirm(`Отправить ссылку на сброс пароля пользователю ${email}?`)) {
      return;
    }

    try {
      const response = await api.post(`/users/${userId}/send-reset-link`);
      alert(response.data.message || 'Ссылка на сброс пароля отправлена');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка отправки ссылки');
    }
  };

  const handleBulkSendResetLink = async () => {
    if (selectedUsers.length === 0) {
      alert('Выберите пользователей для отправки ссылки');
      return;
    }

    if (!window.confirm(`Отправить ссылку на сброс пароля ${selectedUsers.length} пользователям?`)) {
      return;
    }

    try {
      const response = await api.post('/users/bulk-send-reset-link', { userIds: selectedUsers });
      alert(response.data.message || `Обработано: ${response.data.success}, Ошибок: ${response.data.errors?.length || 0}`);
      if (response.data.errors && response.data.errors.length > 0) {
        console.error('Ошибки отправки:', response.data.errors);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка массовой отправки ссылок');
    }
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
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/help')}
              style={{ marginRight: '10px' }}
            >
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('users')}
                style={{ padding: '8px 16px' }}
              >
                Пользователи
              </button>
              <button
                className={`btn ${activeTab === 'passes' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('passes')}
                style={{ padding: '8px 16px' }}
              >
                Заявки
              </button>
            </div>
            {activeTab === 'users' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedUsers.length > 0 && (
                  <>
                    <button className="btn btn-success" onClick={handleBulkSendResetLink}>
                      Отправить ссылку на сброс ({selectedUsers.length})
                    </button>
                    <button className="btn btn-danger" onClick={handleBulkDelete}>
                      Удалить выбранных ({selectedUsers.length})
                    </button>
                  </>
                )}
                <button className="btn btn-secondary" onClick={() => setShowBulkUpload(!showBulkUpload)}>
                  {showBulkUpload ? 'Отменить загрузку' : 'Загрузить из CSV'}
                </button>
                <button className="btn btn-primary" onClick={handleCreateUser}>
                  Создать пользователя
                </button>
              </div>
            )}
          </div>

          {activeTab === 'users' && (
            <>

          {showBulkUpload && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <h3 style={{ marginTop: 0 }}>Массовая загрузка пользователей из CSV</h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                Формат CSV: <strong>email, fullName, plotNumber, phone</strong> (phone опционально)
              </p>
              <p style={{ color: '#666', fontSize: '12px', marginBottom: '15px', fontStyle: 'italic' }}>
                Примечание: Пароль будет сгенерирован автоматически. Пользователь должен будет сменить его при первом входе.
              </p>
              <form onSubmit={handleCsvUpload}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="csvFile">Выберите CSV файл</label>
                  <input
                    type="file"
                    id="csvFile"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    required
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Загрузить
                </button>
              </form>
              {uploadResult && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: uploadResult.errors.length > 0 ? '#fff3cd' : '#d4edda', borderRadius: '4px' }}>
                  <p><strong>{uploadResult.message}</strong></p>
                  {uploadResult.errors.length > 0 && (
                    <div>
                      <p><strong>Ошибки:</strong></p>
                      <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        {uploadResult.errors.slice(0, 10).map((err: any, idx: number) => (
                          <li key={idx}>Строка {err.row}: {err.email} - {err.error}</li>
                        ))}
                        {uploadResult.errors.length > 10 && (
                          <li>... и еще {uploadResult.errors.length - 10} ошибок</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Роль</label>
                <select
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">Все роли</option>
                  <option value="user">Пользователь</option>
                  <option value="foreman">Прораб</option>
                  <option value="security">Охрана</option>
                  <option value="admin">Администратор</option>
                </select>
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
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>Email</th>
                    <th>ФИО</th>
                    <th>Участки</th>
                    <th>Телефон</th>
                    <th>Роль</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td data-label="">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.id)}
                          onChange={(e) => handleSelectUser(u.id, e.target.checked)}
                        />
                      </td>
                      <td data-label="Email">{u.email}</td>
                      <td data-label="ФИО">{u.fullName}</td>
                      <td data-label="Участки">
                        {u.plots && u.plots.length > 0 ? (
                          <div>
                            {u.plots.map((plot, idx) => (
                              <div key={plot.id || idx} style={{ marginBottom: '5px' }}>
                                <strong>{plot.plotNumber}</strong> - {plot.address}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#999' }}>Нет участков</span>
                        )}
                      </td>
                      <td data-label="Телефон">{u.phone}</td>
                      <td data-label="Роль">
                        <span className={`badge ${u.role === 'admin' ? 'badge-admin' : u.role === 'security' ? 'badge-pending' : u.role === 'foreman' ? 'badge-activated' : 'badge-user'}`}>
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
                          <button
                            className="btn btn-success"
                            onClick={() => handleSendResetLink(u.id, u.email)}
                            style={{ padding: '5px 10px', fontSize: '14px' }}
                          >
                            Отправить ссылку на сброс
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteUser(u.id)}
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
            </div>
          )}
            </>
          )}

          {activeTab === 'passes' && (
            <>
              <h2 style={{ marginBottom: '20px' }}>Заявки на пропуск</h2>

              <form onSubmit={handlePassFilterSubmit} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Дата въезда</label>
                    <input
                      type="date"
                      value={passFilters.date}
                      onChange={(e) => handlePassFilterChange('date', e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Тип транспорта</label>
                    <select
                      value={passFilters.vehicleType}
                      onChange={(e) => handlePassFilterChange('vehicleType', e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">Все</option>
                      <option value="грузовой">Грузовой</option>
                      <option value="легковой">Легковой</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Пользователь</label>
                    <select
                      value={passFilters.userId}
                      onChange={(e) => handlePassFilterChange('userId', e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">Все пользователи</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Участок</label>
                    <input
                      type="text"
                      value={passFilters.plotNumber}
                      onChange={(e) => handlePassFilterChange('plotNumber', e.target.value)}
                      placeholder="Поиск по участку"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    Применить фильтры
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleClearPassFilters} style={{ padding: '8px 16px' }}>
                    Очистить
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-success" 
                    onClick={handleExportToExcel} 
                    style={{ padding: '8px 16px' }}
                    disabled={passesLoading || passes.length === 0}
                  >
                    Экспорт в Excel
                  </button>
                </div>
              </form>

              {passesLoading ? (
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
                        <th>Участок</th>
                        <th>Тип транспорта</th>
                        <th>Марка авто</th>
                        <th>Номер авто</th>
                        <th>Дата въезда</th>
                        <th>Адрес</th>
                        <th>Комментарий</th>
                        <th>Комментарий охраны</th>
                        <th>Статус</th>
                        <th>Дата создания</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passes.map((pass) => (
                        <tr key={pass.id}>
                          <td data-label="ФИО">{pass.fullName}</td>
                          <td data-label="Телефон">{pass.phone}</td>
                          <td data-label="Участок">{pass.plotNumber || '-'}</td>
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
                            ) : (
                              <span className={`badge badge-${pass.status}`}>
                                {pass.status === 'pending' ? 'Ожидает' : 
                                 pass.status === 'activated' ? 'Заехал' : 
                                 'Отклонено'}
                              </span>
                            )}
                          </td>
                          <td data-label="Дата создания">
                            {format(new Date(pass.createdAt), 'dd.MM.yyyy HH:mm')}
                          </td>
                          <td data-label="Действия">
                            <button
                              className="btn btn-danger"
                              onClick={() => handleDeletePass(pass.id)}
                              style={{ padding: '5px 10px', fontSize: '14px' }}
                            >
                              Удалить
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

