import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import { carBrands } from '../data/carBrands';
import { getBrandByAlias, searchBrands } from '../data/carBrandAliases';
import { validateVehicleNumber } from '../utils/vehicleNumberValidator';

interface Plot {
  id: number;
  address: string;
  plotNumber: string;
}

interface Pass {
  id?: number;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleNumber: string;
  entryDate: string;
  address: string;
  plotNumber?: string;
  comment: string | null;
}

interface User {
  id: number;
  plots?: Plot[];
}

interface PassModalProps {
  pass: Pass | null;
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const PassModal = ({ pass, user, onClose, onSave }: PassModalProps) => {
  // Правильно инициализируем entryDate: если есть pass, используем его дату, иначе текущую дату
  const getInitialEntryDate = () => {
    if (pass && pass.entryDate) {
      // Если дата в формате YYYY-MM-DD, используем как есть
      // Если в другом формате, конвертируем
      const dateStr = pass.entryDate;
      if (dateStr.includes('T')) {
        // Если есть время, берем только дату
        return dateStr.split('T')[0];
      }
      return dateStr;
    }
    return format(new Date(), 'yyyy-MM-dd');
  };

  const [vehicleType, setVehicleType] = useState(pass?.vehicleType || 'легковой');
  const [vehicleBrand, setVehicleBrand] = useState(pass?.vehicleBrand || '');
  const [vehicleNumber, setVehicleNumber] = useState(pass?.vehicleNumber || '');
  const [entryDate, setEntryDate] = useState(getInitialEntryDate());
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(
    pass ? (user.plots?.find(p => p.address === pass.address && p.plotNumber === pass.plotNumber)?.id || null) : null
  );
  const [address, setAddress] = useState(pass?.address || '');
  const [plotNumber, setPlotNumber] = useState(pass?.plotNumber || '');
  const [comment, setComment] = useState(pass?.comment || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Блокировка прокрутки body при открытом модальном окне
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.classList.add('modal-open');
    
    return () => {
      document.body.classList.remove('modal-open');
      // Восстанавливаем прокрутку после небольшой задержки
      setTimeout(() => {
        if (!document.body.classList.contains('modal-open')) {
          document.body.style.overflow = originalStyle;
        }
      }, 100);
    };
  }, []);

  useEffect(() => {
    if (pass) {
      setVehicleType(pass.vehicleType);
      setVehicleBrand(pass.vehicleBrand || '');
      setVehicleNumber(pass.vehicleNumber);
      // Сохраняем дату въезда при редактировании
      if (pass.entryDate) {
        const dateStr = pass.entryDate;
        // Обрабатываем разные форматы даты
        const formattedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        setEntryDate(formattedDate);
      }
      setAddress(pass.address);
      setPlotNumber(pass.plotNumber || '');
      setComment(pass.comment || '');
      // Находим выбранный участок
      const plot = user.plots?.find(p => p.address === pass.address && p.plotNumber === pass.plotNumber);
      setSelectedPlotId(plot?.id || null);
    } else {
      // При создании новой заявки выбираем первый участок, если есть
      if (user.plots && user.plots.length > 0) {
        const firstPlot = user.plots[0];
        setSelectedPlotId(firstPlot.id);
        // Если адрес пустой, используем номер участка как адрес
        setAddress(firstPlot.address && firstPlot.address.trim() !== '' ? firstPlot.address : firstPlot.plotNumber);
        setPlotNumber(firstPlot.plotNumber);
      }
      // Сбрасываем дату только при создании новой заявки
      setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [pass, user]);

  // Обновляем адрес и номер участка при выборе участка
  useEffect(() => {
    if (selectedPlotId && user.plots) {
      const plot = user.plots.find(p => p.id === selectedPlotId);
      if (plot) {
        // Если адрес пустой, используем номер участка как адрес
        setAddress(plot.address && plot.address.trim() !== '' ? plot.address : plot.plotNumber);
        setPlotNumber(plot.plotNumber);
      }
    }
  }, [selectedPlotId, user.plots]);

  // Фильтруем марки при вводе (включая русские алиасы)
  useEffect(() => {
    if (vehicleBrand.trim().length > 0) {
      // Используем функцию поиска с поддержкой алиасов
      const filtered = searchBrands(vehicleBrand, carBrands);
      setBrandSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setBrandSuggestions([]);
      setShowSuggestions(false);
    }
  }, [vehicleBrand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Проверка обязательных полей перед отправкой
    if (!vehicleBrand || vehicleBrand.trim() === '') {
      setError('Марка авто обязательна');
      setLoading(false);
      return;
    }

    // Валидация номера автомобиля
    const numberValidation = validateVehicleNumber(vehicleNumber);
    if (!numberValidation.valid) {
      setError(numberValidation.error || 'Некорректный формат номера');
      setLoading(false);
      return;
    }

    try {
      // Если адрес пустой, но участок выбран, используем номер участка как адрес
      const finalAddress = address && address.trim() !== '' ? address.trim() : (plotNumber || '');
      
      // Проверяем, есть ли алиас для введенной марки
      let finalBrand = vehicleBrand.trim();
      const aliasBrand = getBrandByAlias(finalBrand);
      if (aliasBrand) {
        finalBrand = aliasBrand;
      }
      
      const data = {
        vehicleType,
        vehicleBrand: finalBrand,
        vehicleNumber,
        entryDate,
        address: finalAddress,
        plotNumber,
        comment: comment || null,
      };

      if (pass?.id) {
        await api.put(`/passes/${pass.id}`, data);
      } else {
        await api.post('/passes', data);
      }

      onSave();
    } catch (err: any) {
      // Обрабатываем ошибки валидации
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const validationErrors = err.response.data.errors.map((e: any) => e.msg || e.message).join(', ');
        setError(validationErrors || 'Ошибка валидации');
      } else {
        setError(err.response?.data?.error || 'Ошибка сохранения заявки');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{pass ? 'Редактировать заявку' : 'Заказать пропуск'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-form-content">
          <div className="form-group">
            <label htmlFor="vehicleType">Тип транспорта</label>
            <select
              id="vehicleType"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              required
            >
              <option value="легковой">Легковой</option>
              <option value="грузовой">Грузовой</option>
            </select>
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="vehicleBrand">Марка авто</label>
            <input
              type="text"
              id="vehicleBrand"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
              onFocus={() => {
                if (vehicleBrand.trim().length > 0 && brandSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Небольшая задержка, чтобы клик по подсказке успел сработать
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              required
              placeholder="Начните вводить марку"
              autoComplete="off"
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
                    onMouseDown={(e) => e.preventDefault()} // Предотвращаем blur при клике
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

          <div className="form-group">
            <label htmlFor="vehicleNumber">Номер авто</label>
            <input
              type="text"
              id="vehicleNumber"
              value={vehicleNumber}
              onChange={(e) => {
                setVehicleNumber(e.target.value);
                // Очищаем ошибку при вводе
                if (error && error.includes('номер')) {
                  setError('');
                }
              }}
              onBlur={() => {
                // Валидация при потере фокуса
                if (vehicleNumber.trim()) {
                  const validation = validateVehicleNumber(vehicleNumber);
                  if (!validation.valid) {
                    setError(validation.error || 'Некорректный формат номера');
                  }
                }
              }}
              required
              placeholder="А123БВ777 (РФ), 123АВС01 (КЗ), 01А123ВС (УЗ)"
              style={{
                textTransform: 'uppercase',
              }}
            />
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              Форматы: РФ (А123БВ777), Казахстан (123АВС01), Узбекистан (01А123ВС)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="entryDate">Дата въезда</label>
            <input
              type="date"
              id="entryDate"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="plot">Участок и адрес</label>
            {user.plots && user.plots.length > 0 ? (
              <select
                id="plot"
                value={selectedPlotId || ''}
                onChange={(e) => setSelectedPlotId(parseInt(e.target.value))}
                required
              >
                <option value="">Выберите участок</option>
                {user.plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.plotNumber} - {plot.address}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ color: '#dc3545', padding: '10px', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
                У вас нет добавленных участков. Пожалуйста, добавьте участок в профиле.
              </div>
            )}
            {selectedPlotId && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <div><strong>Адрес:</strong> {address}</div>
                <div><strong>Номер участка:</strong> {plotNumber}</div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="comment">Комментарий</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Дополнительная информация"
            />
          </div>

          {error && <div className="error">{error}</div>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : pass ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PassModal;

