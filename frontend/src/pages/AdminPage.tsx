import { useEffect, useState } from 'react';
import { adminAPI } from '../api';

interface AdminPageProps {
  onBack: () => void;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const [tab, setTab] = useState<'stats' | 'users' | 'chats' | 'tickets' | 'operators'>('stats');
  const [users, setUsers] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'stats') {
        const res = await adminAPI.getStats();
        setStats(res.data);
      } else if (tab === 'users') {
        const res = await adminAPI.getUsers();
        setUsers(res.data);
      } else if (tab === 'chats') {
        const res = await adminAPI.getChats();
        setChats(res.data);
      } else if (tab === 'tickets') {
        const res = await adminAPI.getTickets();
        setTickets(res.data);
      } else if (tab === 'operators') {
        const res = await adminAPI.getOperators();
        setOperators(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOperator = async (id: string) => {
    try {
      await adminAPI.toggleOperator(id);
      const res = await adminAPI.getUsers();
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBlockUser = async (id: string) => {
    try {
      await adminAPI.blockUser(id);
      const res = await adminAPI.getUsers();
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChat = async (id: string) => {
    if (!confirm('Удалить чат?')) return;
    try {
      await adminAPI.deleteChat(id);
      setChats(chats.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen p-6 page-appear">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="mb-4 text-gc-text-light hover:text-gc-green transition btn-bounce">
          ← Назад
        </button>

        <div className="bg-white rounded-2xl shadow-lg border-2 border-red-500 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center text-2xl avatar-glow-red">
              👑
            </div>
            <div>
              <h1 className="text-2xl font-bold text-red-600">Админ-панель</h1>
              <p className="text-sm text-gc-text-light">Управление пользователями, операторами и тикетами</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-b border-gc-border flex-wrap">
            {[
              { key: 'stats', label: '📊 Статистика' },
              { key: 'users', label: '👥 Пользователи' },
              { key: 'operators', label: '💼 Операторы' },
              { key: 'tickets', label: '🎫 Тикеты' },
              { key: 'chats', label: '💬 Чаты' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-4 py-2 font-medium transition ${
                  tab === t.key ? 'text-red-600 border-b-2 border-red-600' : 'text-gc-text-light hover:text-gc-text'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="loading-dots"><span></span><span></span><span></span></div>
            </div>
          ) : (
            <>
              {tab === 'stats' && stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gc-green-light rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gc-text">{stats.total_users}</div>
                    <div className="text-sm text-gc-text-light mt-1">Пользователей</div>
                  </div>
                  <div className="bg-gc-green-light rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gc-text">{stats.total_chats}</div>
                    <div className="text-sm text-gc-text-light mt-1">Чатов</div>
                  </div>
                  <div className="bg-gc-green-light rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gc-text">{stats.total_messages}</div>
                    <div className="text-sm text-gc-text-light mt-1">Сообщений</div>
                  </div>
                  <div className="bg-gc-green-light rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gc-text">{stats.total_tickets}</div>
                    <div className="text-sm text-gc-text-light mt-1">Тикетов</div>
                  </div>
                  <div className="bg-gc-green-light rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gc-text">{stats.operators_count}</div>
                    <div className="text-sm text-gc-text-light mt-1">Операторов</div>
                  </div>
                  <div className="bg-gc-green-light rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gc-text">{stats.active_users}</div>
                    <div className="text-sm text-gc-text-light mt-1">Активных</div>
                  </div>
                </div>
              )}

              {tab === 'users' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gc-border text-left">
                        <th className="py-2 px-3 text-sm text-gc-text-light">Email</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Имя</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Роль</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Статус</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-gc-border hover:bg-gc-green-light">
                          <td className="py-2 px-3 text-sm text-gc-text">
                            {u.email}
                            {u.is_creator && (
                              <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">👑</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm text-gc-text">{u.name}</td>
                          <td className="py-2 px-3 text-sm">
                            {u.is_creator ? (
                              <span className="text-red-600 font-bold">Основатель</span>
                            ) : u.is_operator ? (
                              <span className="text-blue-600 font-bold">Оператор</span>
                            ) : (
                              <span className="text-gc-text-light">Пользователь</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {u.is_active ? <span className="text-green-600">● Активен</span> : <span className="text-red-600">● Заблокирован</span>}
                          </td>
                          <td className="py-2 px-3 text-sm flex gap-2">
                            {!u.is_creator && (
                              <>
                                <button
                                  onClick={() => handleToggleOperator(u.id)}
                                  className={`px-3 py-1 rounded text-xs font-medium ${
                                    u.is_operator
                                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                  }`}
                                >
                                  {u.is_operator ? 'Снять оператора' : 'Назначить оператором'}
                                </button>
                                <button
                                  onClick={() => handleBlockUser(u.id)}
                                  className={`px-3 py-1 rounded text-xs font-medium ${
                                    u.is_active
                                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                                  }`}
                                >
                                  {u.is_active ? 'Блок' : 'Разблок'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'operators' && (
                <div className="flex flex-col gap-3">
                  {operators.length === 0 ? (
                    <div className="text-center text-gc-text-light py-8">
                      Нет операторов. Назначь пользователя оператором во вкладке «Пользователи».
                    </div>
                  ) : (
                    operators.map((op) => (
                      <div key={op.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-blue-200">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold text-lg">
                          {op.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gc-text">{op.name}</div>
                          <div className="text-xs text-gc-text-light">{op.email}</div>
                        </div>
                        <div className="text-center px-4">
                          <div className="text-2xl font-bold text-blue-600">{op.active_tickets}</div>
                          <div className="text-xs text-gc-text-light">Активных</div>
                        </div>
                        <div className="text-center px-4">
                          <div className="text-2xl font-bold text-green-600">{op.closed_tickets}</div>
                          <div className="text-xs text-gc-text-light">Закрыто</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'tickets' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gc-border text-left">
                        <th className="py-2 px-3 text-sm text-gc-text-light">Тема</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Пользователь</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Оператор</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Статус</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id} className="border-b border-gc-border hover:bg-gc-green-light">
                          <td className="py-2 px-3 text-sm text-gc-text">{t.subject}</td>
                          <td className="py-2 px-3 text-sm text-gc-text-light">{t.user_email}</td>
                          <td className="py-2 px-3 text-sm text-gc-text-light">{t.operator_name || '—'}</td>
                          <td className="py-2 px-3 text-sm">
                            {t.status === 'active' && <span className="text-green-600">🟢 Активен</span>}
                            {t.status === 'waiting' && <span className="text-yellow-600">🟡 Ожидание</span>}
                            {t.status === 'closed' && <span className="text-gray-500">⚫ Закрыт</span>}
                          </td>
                          <td className="py-2 px-3 text-sm text-gc-text-light">{formatDate(t.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'chats' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gc-border text-left">
                        <th className="py-2 px-3 text-sm text-gc-text-light">Название</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Владелец</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Сообщений</th>
                        <th className="py-2 px-3 text-sm text-gc-text-light">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chats.map((c) => (
                        <tr key={c.id} className="border-b border-gc-border hover:bg-gc-green-light">
                          <td className="py-2 px-3 text-sm text-gc-text">{c.title}</td>
                          <td className="py-2 px-3 text-sm text-gc-text-light">{c.user_email}</td>
                          <td className="py-2 px-3 text-sm text-gc-text">{c.messages_count}</td>
                          <td className="py-2 px-3 text-sm">
                            <button
                              onClick={() => handleDeleteChat(c.id)}
                              className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}