import { useState } from 'react';
import { authAPI } from '../api';
import { useAuthStore } from '../store';

interface LoginPageProps {
  onAnonymous?: () => void;
}

export default function LoginPage({ onAnonymous }: LoginPageProps = {}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleRequestCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Введи корректную почту');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authAPI.requestCode(email);
      setStep('code');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setError('Введи 6-значный код');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.verifyCode(email, code, name);
      setAuth(res.data.user, res.data.access_token);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-gc-text text-center mb-2">
          🤖 GDZ Neuro
        </h1>
        <p className="text-gc-text-light text-center mb-8">
          Войди, чтобы начать решать задачи
        </p>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gc-border">
          {step === 'email' ? (
            <>
              <h2 className="text-xl font-semibold text-gc-text mb-4">
                Введи почту
              </h2>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none mb-4 text-gc-text"
                onKeyDown={(e) => e.key === 'Enter' && handleRequestCode()}
              />
              <button
                onClick={handleRequestCode}
                disabled={loading}
                className="w-full bg-gc-green hover:bg-gc-green-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {loading ? 'Отправка...' : 'Отправить код'}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gc-text mb-4">
                Введи код из письма
              </h2>
              <p className="text-sm text-gc-text-light mb-4">
                Код отправлен на {email}
              </p>
              <input
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none mb-4 text-gc-text text-center text-2xl tracking-widest"
                maxLength={6}
              />
              <input
                type="text"
                placeholder="Твоё имя (необязательно)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none mb-4 text-gc-text"
              />
              <button
                onClick={handleVerifyCode}
                disabled={loading}
                className="w-full bg-gc-green hover:bg-gc-green-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 mb-2"
              >
                {loading ? 'Проверка...' : 'Войти'}
              </button>
              <button
                onClick={() => setStep('email')}
                className="w-full text-gc-text-light text-sm hover:text-gc-green transition"
              >
                ← Изменить почту
              </button>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {onAnonymous && (
          <div className="mt-6 text-center">
            <div className="text-xs text-gc-text-light mb-3">или</div>
            <button
              onClick={onAnonymous}
              className="w-full bg-white hover:bg-gc-green-light text-gc-text font-semibold py-3 rounded-xl border-2 border-gc-border btn-bounce transition"
            >
              🔓 Попробовать без регистрации
            </button>
            <p className="text-xs text-gc-text-light mt-2">
              Без сохранения истории. Просто попробовать.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}