import { useEffect, useState, useRef } from 'react';
import { operatorAPI } from '../api';

interface OperatorPageProps {
  onBack: () => void;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  user_email: string;
  user_name: string;
  created_at: string;
  messages_count: number;
}

interface TicketMessage {
  id: string;
  sender: string;
  content: string;
  created_at: string;
}

export default function OperatorPage({ onBack }: OperatorPageProps) {
  const [tab, setTab] = useState<'my' | 'waiting'>('my');
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [waitingTickets, setWaitingTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [tab]);

  useEffect(() => {
    if (currentTicket) {
      const interval = setInterval(loadTicket, 3000);
      return () => clearInterval(interval);
    }
  }, [currentTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadData = async () => {
    try {
      if (tab === 'my') {
        const res = await operatorAPI.myTickets();
        setMyTickets(res.data);
      } else {
        const res = await operatorAPI.waitingTickets();
        setWaitingTickets(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTicket = async () => {
    if (!currentTicket) return;
    try {
      const res = await operatorAPI.getTicket(currentTicket.id);
      setMessages(res.data.messages);
      setCurrentTicket({ ...currentTicket, status: res.data.status });
    } catch (e) {
      console.error(e);
    }
  };

  const openTicket = async (ticket: Ticket) => {
    try {
      const res = await operatorAPI.getTicket(ticket.id);
      setCurrentTicket({
        id: res.data.id,
        subject: res.data.subject,
        status: res.data.status,
        user_email: res.data.user_email,
      });
      setMessages(res.data.messages);
    } catch (e) {
      console.error(e);
    }
  };

  const takeTicket = async (id: string) => {
    try {
      await operatorAPI.takeTicket(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !currentTicket) return;
    setLoading(true);
    try {
      await operatorAPI.sendMessage(currentTicket.id, reply);
      setReply('');
      await loadTicket();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const closeTicket = async () => {
    if (!currentTicket) return;
    try {
      await operatorAPI.closeTicket(currentTicket.id);
      setCurrentTicket(null);
      setMessages([]);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (currentTicket) {
    return (
      <div className="min-h-screen flex flex-col page-appear">
        <div className="bg-white border-b border-gc-border p-4 flex items-center gap-4">
          <button onClick={() => setCurrentTicket(null)} className="text-gc-text-light hover:text-gc-green btn-bounce">
            ← Назад
          </button>
          <div className="flex-1">
            <div className="font-bold text-gc-text">{currentTicket.subject}</div>
            <div className="text-xs text-gc-text-light">
              #{currentTicket.id.slice(0, 8)} • {currentTicket.user_email}
            </div>
          </div>
          <div className={`text-xs px-3 py-1 rounded-full font-bold ${
            currentTicket.status === 'active' ? 'bg-green-100 text-green-600' :
            currentTicket.status === 'waiting' ? 'bg-yellow-100 text-yellow-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {currentTicket.status === 'active' ? '🟢 Активен' :
             currentTicket.status === 'waiting' ? '🟡 Ожидание' : '⚫ Закрыт'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
          {messages.map((msg) => (
            <div key={msg.id} className={`mb-3 flex ${msg.sender === 'operator' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                msg.sender === 'operator'
                  ? 'bg-gc-green text-white'
                  : 'bg-white border border-gc-border text-gc-text'
              }`}>
                <div className="text-xs opacity-70 mb-1">
                  {msg.sender === 'operator' ? 'Вы' : 'Пользователь'}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {currentTicket.status !== 'closed' && (
          <div className="bg-white border-t border-gc-border p-4 max-w-3xl mx-auto w-full">
            <div className="flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder="Ответить пользователю..."
                className="flex-1 px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none text-gc-text"
              />
              <button
                onClick={sendReply}
                disabled={loading || !reply.trim()}
                className="bg-gc-green hover:bg-gc-green-dark text-white font-semibold px-6 py-3 rounded-xl btn-bounce disabled:opacity-50"
              >
                ➤
              </button>
              <button
                onClick={closeTicket}
                className="bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-4 py-3 rounded-xl"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 page-appear">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="mb-4 text-gc-text-light hover:text-gc-green btn-bounce">
          ← Назад
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-2xl">
            💼
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-600">Панель оператора</h1>
            <p className="text-sm text-gc-text-light">Отвечай на обращения пользователей</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gc-border">
          <button
            onClick={() => setTab('my')}
            className={`px-4 py-2 font-medium transition ${
              tab === 'my' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gc-text-light hover:text-gc-text'
            }`}
          >
            📋 Мои тикеты ({myTickets.length})
          </button>
          <button
            onClick={() => setTab('waiting')}
            className={`px-4 py-2 font-medium transition ${
              tab === 'waiting' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gc-text-light hover:text-gc-text'
            }`}
          >
            ⏳ Ожидают ({waitingTickets.length})
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {tab === 'my' && myTickets.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-gc-border p-4 hover:border-blue-400 transition cursor-pointer"
              onClick={() => openTicket(t)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-gc-text">{t.subject}</div>
                <div className={`text-xs px-2 py-1 rounded-full ${
                  t.status === 'active' ? 'bg-green-100 text-green-600' :
                  t.status === 'waiting' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {t.status === 'active' ? '🟢 Активен' :
                   t.status === 'waiting' ? '🟡 Ожидание' : '⚫ Закрыт'}
                </div>
              </div>
              <div className="text-xs text-gc-text-light">
                От: {t.user_name} ({t.user_email}) • {t.messages_count} сообщений
              </div>
            </div>
          ))}

          {tab === 'waiting' && waitingTickets.length === 0 && (
            <div className="text-center text-gc-text-light py-12">
              Нет ожидающих тикетов
            </div>
          )}

          {tab === 'waiting' && waitingTickets.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-yellow-300 p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-gc-text">{t.subject}</div>
                <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-600">
                  🟡 Ожидание
                </div>
              </div>
              <div className="text-xs text-gc-text-light mb-3">
                От: {t.user_name} ({t.user_email}) • {t.messages_count} сообщений
              </div>
              <button
                onClick={() => takeTicket(t.id)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
              >
                Взять тикет
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}