import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import { carBrands } from '../data/carBrands';
import { getBrandByAlias, searchBrands } from '../data/carBrandAliases';
import { validateVehicleNumber } from '../utils/vehicleNumberValidator';
import DateInput from './DateInput';

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

interface PassFormProps {
  pass: Pass | null;
  user: User;
  onCancel: () => void;
  onSave: () => void;
}

const PassForm = ({ pass, user, onCancel, onSave }: PassFormProps) => {
  // Правильно инициализируем entryDate: если есть pass, используем его дату, иначе текущую дату
  const getInitialEntryDate = () => {
    if (pass && pass.entryDate) {
      const dateStr = pass.entryDate;
      if (dateStr.includes('T')) {
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

  useEffect(() => {
    if (pass) {
      setVehicleType(pass.vehicleType);
      setVehicleBrand(pass.vehicleBrand || '');
      setVehicleNumber(pass.vehicleNumber);
      if (pass.entryDate) {
        const dateStr = pass.entryDate;
        const formattedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        setEntryDate(formattedDate);
      }
      setAddress(pass.address);
      setPlotNumber(pass.plotNumber || '');
      setComment(pass.comment || '');
      const plot = user.plots?.find(p => p.address === pass.address && p.plotNumber === pass.plotNumber);
      setSelectedPlotId(plot?.id || null);
    } else {
      if (user.plots && user.plots.length > 0) {
        const firstPlot = user.plots[0];
        setSelectedPlotId(firstPlot.id);
        setAddress(firstPlot.address && firstPlot.address.trim() !== '' ? firstPlot.address : firstPlot.plotNumber);
        setPlotNumber(firstPlot.plotNumber);
      }
      setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [pass, user]);

  useEffect(() => {
    if (selectedPlotId && user.plots) {
      const plot = user.plots.find(p => p.id === selectedPlotId);
      if (plot) {
        setAddress(plot.address && plot.address.trim() !== '' ? plot.address : plot.plotNumber);
        setPlotNumber(plot.plotNumber);
      }
    }
  }, [selectedPlotId, user.plots]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!vehicleBrand || vehicleBrand.trim() === '') {
      setError('Марка авто обязательна');
      setLoading(false);
      return;
    }

    const numberValidation = validateVehicleNumber(vehicleNumber);
    if (!numberValidation.valid) {
      setError(numberValidation.error || 'Некорректный формат номера');
      setLoading(false);
      return;
    }

    try {
      const finalAddress = address && address.trim() !== '' ? address.trim() : (plotNumber || '');
      
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
    <div className="pass-form-container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>{pass ? 'Редактировать заявку' : 'Заказать пропуск'}</h2>
          <button className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

          <div className="form-group">
            <label htmlFor="vehicleNumber">Номер авто</label>
            <input
              type="text"
              id="vehicleNumber"
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
            <DateInput
              id="entryDate"
              value={entryDate}
              onChange={(value) => setEntryDate(value)}
              required
            />
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              Формат: дд-мм-гггг
            </small>
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
              rows={4}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
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

export default PassForm;

