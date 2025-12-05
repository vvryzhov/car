import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

interface Plot {
  id: number;
  address: string;
  plotNumber: string;
}

interface Pass {
  id?: number;
  vehicleType: string;
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

  useEffect(() => {
    if (pass) {
      setVehicleType(pass.vehicleType);
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
        setAddress(firstPlot.address);
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
        setAddress(plot.address);
        setPlotNumber(plot.plotNumber);
      }
    }
  }, [selectedPlotId, user.plots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        vehicleType,
        vehicleNumber,
        entryDate,
        address,
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
      setError(err.response?.data?.error || 'Ошибка сохранения заявки');
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

          <div className="form-group">
            <label htmlFor="vehicleNumber">Номер авто</label>
            <input
              type="text"
              id="vehicleNumber"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              required
              placeholder="А123БВ777"
            />
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

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
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

