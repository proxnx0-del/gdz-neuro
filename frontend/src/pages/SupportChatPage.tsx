import { useEffect, useState, useRef } from 'react';
import { supportAPI } from '../api';

interface SupportChatPageProps {
  onBack: () => void;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  operator_name: string | null;
  created_at: string;
  messages_count: number;
}

interface TicketMessage {
  id: string;
  sender: string;
  content: string;
  created_at: string;
}

interface SupportStatus {
  operators_total: number;
  operators_free: number;
  operators_busy: number;
  tickets_waiting: number;
  estimated_wait_minutes: number;
}

export default function SupportChatPage({ onBack }: SupportChatPageProps) {
  const [view, setView] = useState<'new' | 'tickets' | 'chat'>('new');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStatus();
    loadTickets();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentTicket) {
      const interval = setInterval(loadTicket, 3000);
      return () => clearInterval(interval);
    }
  }, [currentTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadStatus = async () => {
    try {
      const res = await supportAPI.status();
      setStatus(res.data);
    } catch (e) { console.error(e); }
  };

  const loadTickets = async () => {
    try {
      const res = await supportAPI.myTickets();
      setTickets(res.data);
    } catch (e) { console.error(e); }
  };

  const loadTicket = async () => {
    if (!currentTicket) return;
    try {
      const res = await supportAPI.getTicket(currentTicket.id);
      setMessages(res.data.messages);
      setCurrentTicket({
        ...currentTicket,
        status: res.data.status,
        operator_name: res.data.operator_name,
      });
    } catch (e) { console.error(e); }
  };

  const handleCreateTicket = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await supportAPI.createTicket(subject || 'Вопрос', content);
      setSubject('');
      setContent('');
      await loadTickets();
      const ticketRes = await supportAPI.getTicket(res.data.ticket_id);
      setCurrentTicket({
        id: ticketRes.data.id,
        subject: ticketRes.data.subject,
        status: ticketRes.data.status,
        operator_name: ticketRes.data.operator_name,
      });
      setMessages(ticketRes.data.messages);
      setView('chat');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleOpenTicket = async (ticket: Ticket) => {
    try {
      const res = await supportAPI.getTicket(ticket.id);
      setCurrentTicket({
        id: res.data.id,
        subject: res.data.subject,
        status: res.data.status,
        operator_name: res.data.operator_name,
      });
      setMessages(res.data.messages);
      setView('chat');
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentTicket) return;
    const msg = newMessage;
    setNewMessage('');
    try {
      await supportAPI.sendMessage(currentTicket.id, msg);
      await loadTicket();
    } catch (e) { console.error(e); }
  };

  if (view === 'chat' && currentTicket) {
    return (
      <div className="min-h-screen flex flex-col page-appear">
        <div className="bg-white border-b border-gc-border p-4 flex items-center gap-4">
          <button onClick={() => setView('tickets')} className="text-gc-text-light hover:text-gc-green btn-bounce">
            ← Назад
          </button>
          <div className="flex-1">
            <div className="font-bold text-gc-text">{currentTicket.subject}</div>
            <div className="text-xs text-gc-text-light">
              #{currentTicket.id.slice(0, 8)}
              {currentTicket.operator_name && ` • Оператор: ${currentTicket.operator_name}`}
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
          {currentTicket.status === 'waiting' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-yellow-700 text-sm">
              ⏳ Ваш тикет в очереди. Ожидание: ~{status?.estimated_wait_minutes || 5} мин.
            </div>
          )}
          {currentTicket.status === 'active' && currentTicket.operator_name && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-green-700 text-sm">
              ✅ Тикет взял оператор <b>{currentTicket.operator_name}</b>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                msg.sender === 'user' ? 'bg-gc-green text-white' : 'bg-white border border-gc-border text-gc-text'
              }`}>
                <div className="text-xs opacity-70 mb-1">
                  {msg.sender === 'user' ? 'Вы' : currentTicket.operator_name || 'Оператор'}
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
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Напиши сообщение..."
                className="flex-1 px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none text-gc-text"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="bg-gc-green hover:bg-gc-green-dark text-white font-semibold px-6 py-3 rounded-xl btn-bounce disabled:opacity-50"
              >
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'tickets') {
    return (
      <div className="min-h-screen p-6 page-appear">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setView('new')} className="mb-4 text-gc-text-light hover:text-gc-green btn-bounce">
            ← Назад
          </button>
          <h1 className="text-2xl font-bold text-gc-text mb-6">Мои обращения</h1>
          {tickets.length === 0 ? (
            <div className="text-center text-gc-text-light py-12">У тебя пока нет обращений</div>
          ) : (
            <div className="flex flex-col gap-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleOpenTicket(t)}
                  className="bg-white hover:bg-gc-green-light rounded-2xl border border-gc-border p-4 text-left btn-bounce transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-gc-text">{t.subject}</div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      t.status === 'active' ? 'bg-green-100 text-green-600' :
                      t.status === 'waiting' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {t.status === 'active' ? '🟢' : t.status === 'waiting' ? '🟡' : '⚫'}
                    </div>
                  </div>
                  <div className="text-xs text-gc-text-light">
                    #{t.id.slice(0, 8)} • {t.messages_count} сообщений
                    {t.operator_name && ` • Оператор: ${t.operator_name}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 page-appear">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="mb-4 text-gc-text-light hover:text-gc-green btn-bounce">
          ← Назад
        </button>
        <h1 className="text-3xl font-bold text-gc-text mb-2">Чат с оператором</h1>
        <p className="text-gc-text-light mb-6">Опиши проблему — мы ответим</p>

        {status && (
          <div className="bg-white rounded-2xl border border-gc-border p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gc-text">{status.operators_total}</div>
                <div className="text-xs text-gc-text-light">Операторов</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{status.operators_free}</div>
                <div className="text-xs text-gc-text-light">Свободно</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{status.tickets_waiting}</div>
                <div className="text-xs text-gc-text-light">В очереди</div>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              {status.operators_total === 0 ? (
                <span className="text-red-600">⚠️ Операторов нет в сети</span>
              ) : status.operators_free > 0 ? (
                <span className="text-green-600">✅ Оператор свободен</span>
              ) : (
                <span className="text-yellow-600">⏳ Все заняты. Ожидание ~{status.estimated_wait_minutes} мин</span>
              )}
            </div>
          </div>
        )}

        {tickets.length > 0 && (
          <button
            onClick={() => setView('tickets')}
            className="w-full bg-white hover:bg-gc-green-light rounded-2xl border border-gc-border p-4 mb-6 btn-bounce transition text-left"
          >
            <div className="font-semibold text-gc-text">📂 Мои обращения ({tickets.length})</div>
            <div className="text-xs text-gc-text-light mt-1">Посмотреть историю</div>
          </button>
        )}

        <div className="bg-white rounded-2xl border border-gc-border p-6">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Тема (например: Не работает загрузка фото)"
            className="w-full px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none text-gc-text mb-3"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Опиши проблему подробно..."
            rows={5}
            className="w-full px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none text-gc-text mb-4 resize-none"
          />
          <button
            onClick={handleCreateTicket}
            disabled={loading || !content.trim()}
            className="w-full bg-gc-green hover:bg-gc-green-dark text-white font-semibold py-3 rounded-xl btn-bounce disabled:opacity-50"
          >
            {loading ? 'Отправка...' : 'Отправить обращение'}
          </button>
        </div>
      </div>
    </div>
  );
}