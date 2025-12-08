import { useState, useEffect } from 'react';
import api from '../services/api';
import { carBrands } from '../data/carBrands';
import { getBrandByAlias, searchBrands } from '../data/carBrandAliases';
import { validateVehicleNumber } from '../utils/vehicleNumberValidator';

interface PermanentPass {
  id: number;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleNumber: string;
  comment: string | null;
}

interface PermanentPassesManagerProps {
  userId: number;
}

const PermanentPassesManager = ({ userId }: PermanentPassesManagerProps) => {
  const [passes, setPasses] = useState<PermanentPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPass, setEditingPass] = useState<PermanentPass | null>(null);
  const [error, setError] = useState('');

  const [vehicleType, setVehicleType] = useState('легковой');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchPasses();
  }, [userId]);

  useEffect(() => {
    if (vehicleBrand.trim().length > 0) {
      const filtered = searchBrands(vehicleBrand, carBrands);
      setBrandSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setBrandSuggestions([]);
      setShowSuggestions(false);
    }
  }, [vehicleBrand]);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/me/permanent-passes');
      console.log('Загружены постоянные пропуска:', response.data);
      setPasses(response.data || []);
    } catch (error: any) {
      console.error('Ошибка загрузки постоянных пропусков:', error);
      setError(error.response?.data?.error || 'Ошибка загрузки постоянных пропусков');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    console.log('➕ handleCreate вызван - открытие формы создания постоянного пропуска');
    setEditingPass(null);
    setVehicleType('легковой');
    setVehicleBrand('');
    setVehicleNumber('');
    setComment('');
    setError('');
    setShowForm(true);
    console.log('✅ Форма должна быть открыта, showForm = true');
  };

  const handleEdit = (pass: PermanentPass) => {
    setEditingPass(pass);
    setVehicleType(pass.vehicleType);
    setVehicleBrand(pass.vehicleBrand || '');
    setVehicleNumber(pass.vehicleNumber);
    setComment(pass.comment || '');
    setError('');
    setShowForm(true);
  };

  const handleCancel = () => {
    console.log('❌ handleCancel вызван - закрытие формы');
    setShowForm(false);
    setEditingPass(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 handleSubmit вызван');
    setError('');
    setSaving(true);

    console.log('📋 Данные формы:', { vehicleType, vehicleBrand, vehicleNumber, comment });

    if (!vehicleBrand || vehicleBrand.trim() === '') {
      console.error('❌ Ошибка: марка авто пустая');
      setError('Марка авто обязательна');
      setSaving(false);
      return;
    }

    const numberValidation = validateVehicleNumber(vehicleNumber);
    if (!numberValidation.valid) {
      console.error('❌ Ошибка валидации номера:', numberValidation.error);
      setError(numberValidation.error || 'Некорректный формат номера');
      setSaving(false);
      return;
    }

    try {
      let finalBrand = vehicleBrand.trim();
      const aliasBrand = getBrandByAlias(finalBrand);
      if (aliasBrand) {
        finalBrand = aliasBrand;
      }

      const requestData = {
        vehicleType,
        vehicleBrand: finalBrand,
        vehicleNumber,
        comment: comment || null,
      };

      console.log('📤 Отправка запроса:', editingPass ? 'PUT' : 'POST', requestData);

      let response;
      if (editingPass) {
        console.log('✏️ Обновление постоянного пропуска:', editingPass.id);
        response = await api.put(`/users/me/permanent-passes/${editingPass.id}`, requestData);
        console.log('✅ Постоянный пропуск обновлен:', response.data);
      } else {
        console.log('➕ Создание нового постоянного пропуска');
        response = await api.post('/users/me/permanent-passes', requestData);
        console.log('✅ Постоянный пропуск создан:', response.data);
      }

      // Обновляем список
      console.log('🔄 Обновление списка пропусков...');
      await fetchPasses();
      setShowForm(false);
      setEditingPass(null);
      setError(''); // Очищаем ошибки при успехе
      console.log('✅ Успешно завершено');
    } catch (err: any) {
      console.error('❌ Ошибка сохранения постоянного пропуска:', err);
      console.error('   Детали ошибки:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.errors?.[0]?.msg || 
                          err.message || 
                          'Ошибка сохранения постоянного пропуска';
      setError(errorMessage);
      alert(`Ошибка: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот постоянный пропуск?')) {
      return;
    }

    try {
      await api.delete(`/users/me/permanent-passes/${id}`);
      await fetchPasses();
    } catch (error) {
      console.error('Ошибка удаления постоянного пропуска:', error);
      alert('Ошибка удаления постоянного пропуска');
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <label style={{ marginBottom: 0 }}>Постоянные пропуска (личный транспорт)</label>
        {!showForm && (
          <button type="button" className="btn btn-secondary" onClick={handleCreate} style={{ padding: '5px 15px', fontSize: '14px' }}>
            + Добавить
          </button>
        )}
      </div>

      {showForm ? (
        <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '15px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '15px' }}>
            {editingPass ? 'Редактировать постоянный пропуск' : 'Добавить постоянный пропуск'}
          </h4>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="pp-vehicleType">Тип транспорта</label>
              <select
                id="pp-vehicleType"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="легковой">Легковой</option>
                <option value="грузовой">Грузовой</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '15px', position: 'relative' }}>
              <label htmlFor="pp-vehicleBrand">Марка авто</label>
              <input
                type="text"
                id="pp-vehicleBrand"
                value={vehicleBrand}
                onChange={(e) => setVehicleBrand(e.target.value)}
                onFocus={() => {
                  if (vehicleBrand.trim().length > 0 && brandSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                required
                placeholder="Начните вводить марку"
                autoComplete="off"
                style={{ width: '100%' }}
              />
              {showSuggestions && brandSuggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginTop: '2px',
                  }}
                >
                  {brandSuggestions.map((brand) => (
                    <div
                      key={brand}
                      onClick={() => {
                        setVehicleBrand(brand);
                        setShowSuggestions(false);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      {brand}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="pp-vehicleNumber">Номер авто</label>
              <input
                type="text"
                id="pp-vehicleNumber"
                value={vehicleNumber}
                onChange={(e) => {
                  setVehicleNumber(e.target.value);
                  if (error && error.includes('номер')) {
                    setError('');
                  }
                }}
                onBlur={() => {
                  if (vehicleNumber.trim()) {
                    const validation = validateVehicleNumber(vehicleNumber);
                    if (!validation.valid) {
                      setError(validation.error || 'Некорректный формат номера');
                    }
                  }
                }}
                required
                placeholder="А123БВ777"
                style={{
                  textTransform: 'uppercase',
                  width: '100%',
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="pp-comment">Комментарий (необязательно)</label>
              <textarea
                id="pp-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Дополнительная информация"
                rows={2}
                style={{ width: '100%' }}
              />
            </div>

            {error && <div className="error" style={{ marginBottom: '15px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Сохранение...' : editingPass ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {passes.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic', marginBottom: '10px' }}>
              Нет постоянных пропусков
            </div>
          ) : (
            <div style={{ marginBottom: '10px' }}>
              {passes.map((pass) => (
                <div
                  key={pass.id}
                  style={{
                    padding: '10px',
                    marginBottom: '10px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div><strong>{pass.vehicleBrand || 'Без марки'}</strong> - {pass.vehicleNumber}</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {pass.vehicleType} {pass.comment ? `• ${pass.comment}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleEdit(pass)}
                      style={{ padding: '5px 10px', fontSize: '14px' }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleDelete(pass.id)}
                      style={{ padding: '5px 10px', fontSize: '14px' }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <small style={{ color: '#666', fontSize: '12px', display: 'block' }}>
            Постоянные пропуска действуют без срока окончания. Охрана видит их в отдельном списке и при поиске по номеру авто.
          </small>
        </>
      )}
    </div>
  );
};

export default PermanentPassesManager;

