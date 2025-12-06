import { useState, useEffect } from 'react';
import api from '../services/api';
import { carBrands } from '../data/carBrands';

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
  fullName: string;
  plotNumber: string;
  phone: string;
}

interface SecurityPassModalProps {
  pass: Pass;
  onClose: () => void;
  onSave: () => void;
}

const SecurityPassModal = ({ pass, onClose, onSave }: SecurityPassModalProps) => {
  // Функция для правильного форматирования даты
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    // Если дата в формате YYYY-MM-DD, используем как есть
    // Если в другом формате, конвертируем
    if (dateStr.includes('T')) {
      // Если есть время, берем только дату
      return dateStr.split('T')[0];
    }
    return dateStr;
  };

  const [vehicleType, setVehicleType] = useState(pass.vehicleType);
  const [vehicleBrand, setVehicleBrand] = useState(pass.vehicleBrand || '');
  const [vehicleNumber, setVehicleNumber] = useState(pass.vehicleNumber);
  const [entryDate, setEntryDate] = useState(formatDateForInput(pass.entryDate));
  const [address, setAddress] = useState(pass.address);
  const [fullName, setFullName] = useState(pass.fullName);
  const [comment, setComment] = useState(pass.comment || '');
  const [securityComment, setSecurityComment] = useState(pass.securityComment || '');
  const [status, setStatus] = useState(pass.status);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setVehicleType(pass.vehicleType);
    setVehicleBrand(pass.vehicleBrand || '');
    setVehicleNumber(pass.vehicleNumber);
    // Правильно форматируем дату при обновлении
    setEntryDate(formatDateForInput(pass.entryDate));
    setAddress(pass.address);
    setFullName(pass.fullName);
    setComment(pass.comment || '');
    setSecurityComment(pass.securityComment || '');
    setStatus(pass.status);
  }, [pass]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        vehicleType,
        vehicleBrand: vehicleBrand.trim() || '',
        vehicleNumber,
        entryDate,
        address,
        fullName,
        // Не отправляем plotNumber - охрана не должна его редактировать
        // Не отправляем comment - охрана не может его менять
        securityComment: securityComment || null,
        status,
      };

      await api.put(`/passes/${pass.id}`, data);
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения заявки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal security-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Редактировать пропуск</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="status">Статус</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="pending">Ожидает</option>
              <option value="activated">Заехал</option>
              <option value="rejected">Отклонено</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fullName">ФИО</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

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
            <label htmlFor="vehicleBrand">Марка авто</label>
            <input
              type="text"
              id="vehicleBrand"
              list="carBrandsSecurity"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
              required
              placeholder="Начните вводить марку или выберите из списка"
            />
            <datalist id="carBrandsSecurity">
              {carBrands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
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
            <label htmlFor="comment">Комментарий пользователя</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий пользователя"
              readOnly
            />
          </div>

          <div className="form-group">
            <label htmlFor="securityComment">Комментарий охраны</label>
            <textarea
              id="securityComment"
              value={securityComment}
              onChange={(e) => setSecurityComment(e.target.value)}
              placeholder="Комментарий охраны"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SecurityPassModal;

