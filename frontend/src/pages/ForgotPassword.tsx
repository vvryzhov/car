import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Если есть токен, показываем форму смены пароля
  if (token) {
    return <ResetPasswordForm token={token} />;
  }

  // Иначе показываем форму запроса восстановления
  return <RequestPasswordReset />;
};

const RequestPasswordReset = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/users/reset-password-request', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки запроса');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Письмо отправлено</h1>
          <p>На ваш email отправлено письмо с инструкциями по восстановлению пароля.</p>
          <p>Проверьте почту и перейдите по ссылке в письме.</p>
          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/login')}
            >
              Вернуться к входу
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Восстановление пароля</h1>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Введите ваш email. Мы отправим вам письмо с инструкциями по восстановлению пароля.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Введите email"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить письмо'}
          </button>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ background: 'none', border: 'none', color: '#007bff', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}
            >
              Вернуться к входу
            </button>
          </div>
          <div style={{ marginTop: '20px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Powered by jirajedi</p>
          </div>
        </form>
      </div>
    </div>
  );
};

const ResetPasswordForm = ({ token }: { token: string }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    // Проверка: пароль должен содержать буквы и числа
    const hasLetter = /[a-zA-Zа-яА-Я]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      setError('Пароль должен содержать буквы и числа');
      return;
    }

    setLoading(true);

    try {
      await api.post('/users/reset-password', {
        token,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка восстановления пароля');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Пароль изменен</h1>
          <p>Пароль успешно изменен. Вы будете перенаправлены на страницу входа...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Смена пароля</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="newPassword">Новый пароль</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Минимум 6 символов"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Подтвердите новый пароль</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Повторите пароль"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Изменение...' : 'Изменить пароль'}
          </button>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ background: 'none', border: 'none', color: '#007bff', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}
            >
              Вернуться к входу
            </button>
          </div>
          <div style={{ marginTop: '20px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Powered by jirajedi</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
