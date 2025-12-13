import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Footer from '../components/Footer';
import './Feedback.css';

const Feedback = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!message.trim()) {
      setError('Пожалуйста, введите сообщение');
      return;
    }

    if (message.trim().length < 10) {
      setError('Сообщение должно содержать минимум 10 символов');
      return;
    }

    setLoading(true);

    try {
      await api.post('/users/feedback', { message: message.trim() });
      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки сообщения');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Обратная связь</h1>
          <div className="header-actions">
            <span className="user-info">{user.fullName}</span>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginRight: '10px' }}>
              Назад
            </button>
            <button className="btn btn-secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <div className="feedback-content">
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Если у вас возникли вопросы или предложения, пожалуйста, заполните форму ниже.
              Мы обязательно рассмотрим ваше обращение.
            </p>
            <p style={{ marginBottom: '20px', color: '#666', fontStyle: 'italic' }}>
              При желании вы также можете написать на почту{' '}
              <a href="mailto:mail@аносинопарк.рф" style={{ color: '#007bff' }}>
                mail@аносинопарк.рф
              </a>
            </p>

            {success && (
              <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                Ваше сообщение успешно отправлено. Мы свяжемся с вами в ближайшее время.
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="message" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Ваше сообщение <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  required
                  minLength={10}
                  placeholder="Введите ваше сообщение (минимум 10 символов)"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                  {message.length} символов (минимум 10)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || message.trim().length < 10}
                  style={{ minWidth: '150px' }}
                >
                  {loading ? 'Отправка...' : 'Отправить'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMessage('');
                    setError('');
                    setSuccess(false);
                  }}
                >
                  Очистить
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Feedback;






