import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

interface Pass {
  id?: number;
  vehicleType: string;
  vehicleNumber: string;
  entryDate: string;
  address: string;
  comment: string | null;
}

interface User {
  id: number;
  address: string;
}

interface PassModalProps {
  pass: Pass | null;
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const PassModal = ({ pass, user, onClose, onSave }: PassModalProps) => {
  const [vehicleType, setVehicleType] = useState('легковой');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [address, setAddress] = useState(user.address);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pass) {
      setVehicleType(pass.vehicleType);
      setVehicleNumber(pass.vehicleNumber);
      // Сохраняем дату въезда при редактировании
      if (pass.entryDate) {
        setEntryDate(pass.entryDate);
      }
      setAddress(pass.address);
      setComment(pass.comment || '');
    } else {
      // При создании новой заявки адрес подтягивается из профиля
      setAddress(user.address);
      // Сбрасываем дату только при создании новой заявки
      setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [pass, user]);

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
            <label htmlFor="address">Адрес</label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
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

