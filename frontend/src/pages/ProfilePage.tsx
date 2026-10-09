import { useEffect, useState } from 'react';
import { authAPI } from '../api';
import { useAuthStore, useThemeStore } from '../store';

interface ProfilePageProps {
  onBack: () => void;
  onAdmin?: () => void;
}

interface Stats {
  chats_count: number;
  messages_count: number;
  created_at: string | null;
  last_login: string | null;
  is_creator: boolean;
}

export default function ProfilePage({ onBack, onAdmin }: ProfilePageProps) {
  const { user, logout, savedAccounts, switchAccount, removeAccount } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccounts, setShowAccounts] = useState(false);

  useEffect(() => {
    authAPI.stats()
      .then((res) => setStats(res.data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const initial = (user?.name || user?.email || '?')[0].toUpperCase();
  const isCreator = user?.is_creator || stats?.is_creator;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 page-appear">
      <div className="w-full max-w-2xl">
        <button
          onClick={onBack}
          className="mb-4 text-gc-text-light hover:text-gc-green transition flex items-center gap-2 btn-bounce"
        >
          ← Назад в чат
        </button>

        <div className={`bg-white rounded-2xl shadow-lg p-8 ${isCreator ? 'border-2 border-red-500' : 'border border-gc-border'}`}>
          {isCreator && (
            <div className="flex justify-center mb-4">
              <span className="bg-gradient-to-r from-red-500 to-red-700 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                👑 СОЗДАТЕЛЬ
              </span>
            </div>
          )}

          <div className="flex flex-col items-center mb-8">
            <div className={`w-24 h-24 rounded-full text-white flex items-center justify-center text-4xl font-bold mb-4 shadow-lg ${isCreator ? 'bg-gradient-to-br from-red-500 to-red-700 avatar-glow-red' : 'bg-gradient-to-br from-gc-green to-gc-green-dark avatar-glow'}`}>
              {initial}
            </div>
            <h1 className={`text-2xl font-bold ${isCreator ? 'text-red-600' : 'text-gc-text'}`}>
              {user?.name || 'Пользователь'}
            </h1>
            <p className="text-gc-text-light">📧 {user?.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gc-green-light rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gc-text">
                {loading ? '...' : stats?.chats_count ?? 0}
              </div>
              <div className="text-sm text-gc-text-light mt-1">Чатов</div>
            </div>
            <div className="bg-gc-green-light rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gc-text">
                {loading ? '...' : stats?.messages_count ?? 0}
              </div>
              <div className="text-sm text-gc-text-light mt-1">Сообщений</div>
            </div>
          </div>

          <div className="border-t border-gc-border pt-6 mb-6">
            <div className="flex justify-between py-2">
              <span className="text-gc-text-light">Дата регистрации</span>
              <span className="text-gc-text font-medium">
                {loading ? '...' : formatDate(stats?.created_at ?? null)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gc-text-light">Последний вход</span>
              <span className="text-gc-text font-medium">
                {loading ? '...' : formatDate(stats?.last_login ?? null)}
              </span>
            </div>
          </div>

          {/* Переключатель аккаунтов */}
          <div className="border-t border-gc-border pt-6 mb-6">
            <button
              onClick={() => setShowAccounts(!showAccounts)}
              className="w-full flex items-center justify-between py-2 text-gc-text hover:text-gc-green transition"
            >
              <span className="font-medium">🔁 Переключить аккаунт</span>
              <span className={`transition-transform ${showAccounts ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showAccounts && (
              <div className="mt-3 flex flex-col gap-2 page-appear">
                {savedAccounts.map((account) => (
                  <div
                    key={account.user.email}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                      account.user.email === user?.email
                        ? 'bg-gc-green-light border-gc-green'
                        : 'bg-white border-gc-border hover:bg-gc-green-light cursor-pointer'
                    }`}
                    onClick={() => {
                      if (account.user.email !== user?.email) {
                        switchAccount(account.user.email);
                      }
                    }}
                  >
                    <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold ${
                      account.user.is_creator
                        ? 'bg-gradient-to-br from-red-500 to-red-700'
                        : 'bg-gradient-to-br from-gc-green to-gc-green-dark'
                    }`}>
                      {(account.user.name || account.user.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gc-text truncate">
                        {account.user.name || 'Пользователь'}
                        {account.user.is_creator && (
                          <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">👑</span>
                        )}
                      </div>
                      <div className="text-xs text-gc-text-light truncate">
                        {account.user.email}
                      </div>
                    </div>
                    {account.user.email === user?.email ? (
                      <span className="text-xs text-gc-green font-bold">Текущий</span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAccount(account.user.email);
                        }}
                        className="text-red-400 hover:text-red-600 text-sm"
                        title="Удалить аккаунт"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={logout}
                  className="w-full bg-gc-green-light hover:bg-gc-border text-gc-text font-semibold py-3 rounded-xl btn-bounce mt-2"
                >
                  ➕ Добавить аккаунт
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {isCreator && onAdmin && (
              <button
                onClick={onAdmin}
                className="w-full bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold py-3 rounded-xl btn-bounce shadow-lg"
              >
                👑 Админ-панель
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={toggleTheme}
                className="flex-1 bg-gc-green-light hover:bg-gc-border text-gc-text font-semibold py-3 rounded-xl btn-bounce"
              >
                {theme === 'light' ? '🌙 Тёмная тема' : '☀️ Светлая тема'}
              </button>
              <button
                onClick={logout}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl border border-red-200 btn-bounce"
              >
                🚪 Выйти
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}