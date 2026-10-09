import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { chatAPI, photoAPI, reactionAPI } from '../api';
import { useAuthStore } from '../store';
import ProfilePage from './ProfilePage';
import AdminPage from './AdminPage';
import SupportPage from './SupportPage';
import SupportChatPage from './SupportChatPage';
import OperatorPage from './OperatorPage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

interface Chat {
  id: string;
  title: string;
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [showOperator, setShowOperator] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deepThinking, setDeepThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string>('');
  const flushIntervalRef = useRef<any>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const pendingDeepThinkingRef = useRef<boolean>(false);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (!currentChat) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '127.0.0.1:8000'
  : `${window.location.hostname}:8000`;
    const ws = new WebSocket(`ws://${wsHost}/ws/chat/${currentChat}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Открыт чат', currentChat);

      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = setInterval(() => {
        if (bufferRef.current) {
          const chunk = bufferRef.current;
          bufferRef.current = '';
          setStreamingText((prev) => prev + chunk);
        }
      }, 60);

      if (pendingMessageRef.current) {
        const msg = pendingMessageRef.current;
        const deep = pendingDeepThinkingRef.current;
        pendingMessageRef.current = null;
        pendingDeepThinkingRef.current = false;
        setLoading(true);
        ws.send(JSON.stringify({ content: msg, deep_thinking: deep }));
        setTimeout(() => setLoading(false), 60000);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'thinking_start') {
        setThinkingStep('🧠 Начинаю глубокое мышление...');
      } else if (data.type === 'thinking_step') {
        setThinkingStep(data.step);
      } else if (data.type === 'thinking_end') {
        setThinkingStep(null);
      } else if (data.type === 'user_saved') {
        setMessages((prev) => [
          ...prev,
          { id: data.id, role: 'user', content: data.content },
        ]);
      } else if (data.type === 'chunk') {
        bufferRef.current += data.content;
      } else if (data.type === 'done') {
        if (bufferRef.current) {
          const chunk = bufferRef.current;
          bufferRef.current = '';
          setStreamingText((prev) => prev + chunk);
        }
        if (flushIntervalRef.current) {
          clearInterval(flushIntervalRef.current);
          flushIntervalRef.current = null;
        }
        setStreamingText('');
        setThinkingStep(null);
        setMessages((prev) => [
          ...prev,
          { id: data.id, role: 'assistant', content: data.content },
        ]);
        setLoading(false);
        loadChats();
      } else if (data.type === 'error') {
        alert(data.content);
        setStreamingText('');
        setThinkingStep(null);
        setLoading(false);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Ошибка:', e);
      setLoading(false);
      setThinkingStep(null);
    };

    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      ws.close();
    };
  }, [currentChat]);

  const loadChats = async () => {
    try {
      const res = await chatAPI.getChats();
      setChats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await chatAPI.createChat();
      setChats([res.data, ...chats]);
      setCurrentChat(res.data.id);
      setMessages([]);
      setStreamingText('');
      bufferRef.current = '';
      setReactions({});
      setSidebarOpen(false);
      return res.data.id;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const loadChat = async (id: string) => {
    try {
      const res = await chatAPI.getChat(id);
      setCurrentChat(id);
      setMessages(res.data.messages);
      setStreamingText('');
      bufferRef.current = '';
      setSidebarOpen(false);

      const reactionsMap: Record<string, string | null> = {};
      for (const msg of res.data.messages) {
        if (msg.role === 'assistant') {
          try {
            const r = await reactionAPI.get(msg.id);
            if (r.data.reaction) {
              reactionsMap[msg.id] = r.data.reaction;
            }
          } catch (e) {}
        }
      }
      setReactions(reactionsMap);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatAPI.deleteChat(id);
      setChats(chats.filter((c) => c.id !== id));
      if (currentChat === id) {
        setCurrentChat(null);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendFromMainScreen = async () => {
    if (!input.trim() && !attachedImage) return;

    const userMessage = input.trim();
    const image = attachedImage;
    const file = attachedFile;

    setInput('');
    setAttachedImage(null);
    setAttachedFile(null);

    const chatId = await createNewChat();
    if (!chatId) return;

    if (image) {
      setMessages((prev) => [
        ...prev,
        { id: 'photo-user-' + Date.now(), role: 'user', content: userMessage, image },
      ]);
    }

    setLoading(true);

    if (file) {
      try {
        const res = await photoAPI.solve(file, userMessage, chatId);
        setMessages((prev) => [
          ...prev,
          { id: 'photo-bot-' + Date.now(), role: 'assistant', content: res.data.solution },
        ]);
        loadChats();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    pendingMessageRef.current = userMessage;
    pendingDeepThinkingRef.current = deepThinking;
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || !currentChat) return;

    const userMessage = input;
    const image = attachedImage;
    const file = attachedFile;

    setInput('');
    setAttachedImage(null);
    setAttachedFile(null);

    if (image) {
      setMessages((prev) => [
        ...prev,
        { id: 'photo-user-' + Date.now(), role: 'user', content: userMessage, image },
      ]);
    }

    setLoading(true);

    if (file) {
      try {
        const res = await photoAPI.solve(file, userMessage, currentChat);
        setMessages((prev) => [
          ...prev,
          { id: 'photo-bot-' + Date.now(), role: 'assistant', content: res.data.solution },
        ]);
        loadChats();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Соединение потеряно. Подожди секунду.');
      setLoading(false);
      return;
    }

    wsRef.current.send(JSON.stringify({ content: userMessage, deep_thinking: deepThinking }));
    setTimeout(() => setLoading(false), 60000);
  };

  const handleAttachPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Image = event.target?.result as string;
      setAttachedImage(base64Image);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReaction = async (messageId: string, reaction: 'like' | 'dislike') => {
    try {
      const res = await reactionAPI.set(messageId, reaction);
      setReactions((prev) => ({ ...prev, [messageId]: res.data.reaction }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRepeat = (content: string) => {
    if (!currentChat || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [
      ...prev,
      { id: 'repeat-' + Date.now(), role: 'user', content },
    ]);
    setLoading(true);
    wsRef.current.send(JSON.stringify({ content, deep_thinking: deepThinking }));
  };

  const handleShare = async (content: string) => {
    try {
      const text = `Ответ от GDZ Neuro:\n\n${content}`;
      if (navigator.share) {
        await navigator.share({ title: 'GDZ Neuro', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Скопировано в буфер обмена');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (showAdmin) {
    return <AdminPage onBack={() => setShowAdmin(false)} />;
  }

  if (showSupportChat) {
    return <SupportChatPage onBack={() => setShowSupportChat(false)} />;
  }

  if (showOperator) {
    return <OperatorPage onBack={() => setShowOperator(false)} />;
  }

  if (showSupport) {
    return <SupportPage
      onBack={() => setShowSupport(false)}
      onChat={() => { setShowSupport(false); setShowSupportChat(true); }}
    />;
  }

  if (showProfile) {
    return (
      <ProfilePage
        onBack={() => setShowProfile(false)}
        onAdmin={() => { setShowProfile(false); setShowAdmin(true); }}
      />
    );
  }

  const isCreator = user?.is_creator;
  const isOperator = user?.is_operator;

  return (
    <div className="min-h-screen flex relative">
      {/* Затемнение фона на мобильном */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Сайдбар */}
      <div className={`w-72 bg-white border-r border-gc-border flex flex-col fixed md:relative z-30 h-full transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-3">
          <button
            onClick={createNewChat}
            className="w-full bg-gc-green hover:bg-gc-green-dark text-white font-semibold py-3 rounded-xl btn-bounce mb-3"
          >
            + Новый чат
          </button>

          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gc-green-light transition text-left text-gc-text mb-1"
            onClick={() => alert('Раздел "Проекты" в разработке')}
          >
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium">Проекты</span>
          </button>

          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gc-green-light transition text-left text-gc-text mb-1"
            onClick={() => alert('Раздел "Видео" в разработке')}
          >
            <span className="text-lg">🎬</span>
            <span className="text-sm font-medium">Видео</span>
          </button>

          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gc-green-light transition text-left text-gc-text mb-1"
            onClick={() => alert('Раздел "Подкасты" в разработке')}
          >
            <span className="text-lg">🎧</span>
            <span className="text-sm font-medium">Подкасты</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 border-t border-gc-border">
          <div className="px-3 py-2 text-xs text-gc-text-light font-semibold uppercase">
            Мои чаты
          </div>
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group chat-item-appear flex items-center justify-between px-3 py-2 rounded-lg mb-1 cursor-pointer transition ${
                currentChat === chat.id
                  ? 'bg-gc-green-light text-gc-text font-semibold'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => loadChat(chat.id)}
            >
              <span className="truncate flex-1">{chat.title}</span>
              <button
                onClick={(e) => deleteChat(chat.id, e)}
                className="opacity-60 md:opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-2"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gc-border">
          {(isOperator || isCreator) && (
            <button
              onClick={() => { setShowOperator(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 transition text-left text-blue-600 mb-1"
            >
              <span className="text-lg">💼</span>
              <span className="text-sm font-medium">Панель оператора</span>
            </button>
          )}

          <button
            onClick={() => { setShowSupport(true); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gc-green-light transition text-left text-gc-text mb-1"
          >
            <span className="text-lg">🆘</span>
            <span className="text-sm font-medium">Поддержка</span>
          </button>

          <button
            onClick={() => { setShowProfile(true); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left ${
              isCreator ? 'bg-red-50 hover:bg-red-100 border border-red-200' : 'hover:bg-gc-green-light'
            }`}
          >
            <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold ${
              isCreator ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-gc-green to-gc-green-dark'
            }`}>
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${isCreator ? 'text-red-600' : 'text-gc-text'}`}>
                {user?.name || 'Пользователь'}
              </div>
              <div className="text-xs text-gc-text-light truncate">
                {user?.email}
              </div>
            </div>
            {isCreator && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">👑</span>
            )}
          </button>
        </div>
      </div>

      {/* Основная область */}
      <div className="flex-1 flex flex-col w-full md:w-auto">
        {/* Верхняя панель с кнопкой меню на мобильном */}
        <div className="md:hidden bg-white border-b border-gc-border p-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="bg-gc-green-light hover:bg-gc-border text-gc-text px-3 py-2 rounded-xl btn-bounce text-xl"
            title="Меню"
          >
            ☰
          </button>
          <div className="flex-1 truncate">
            <div className="text-sm font-bold text-gc-text truncate">
              {currentChat ? chats.find(c => c.id === currentChat)?.title || 'Чат' : 'GDZ Neuro'}
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="bg-gc-green hover:bg-gc-green-dark text-white px-3 py-2 rounded-xl btn-bounce text-sm font-semibold"
          >
            + Чат
          </button>
        </div>

        {currentChat ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 md:p-6">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`mb-4 flex flex-col message-appear ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] md:max-w-[85%] px-3 md:px-4 py-2 md:py-3 rounded-2xl break-words overflow-hidden ${
                      msg.role === 'user'
                        ? isCreator
                          ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
                          : 'bg-gc-green text-white'
                        : 'bg-white border border-gc-border text-gc-text'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div>
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt="Загруженное фото"
                            className="max-w-full max-h-60 rounded-lg mb-2 border border-white/20"
                          />
                        )}
                        {msg.content && (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {msg.role === 'assistant' && msg.id && !msg.id.startsWith('photo-') && !msg.id.startsWith('error-') && (
                    <div className="flex gap-1 mt-2 ml-1 flex-wrap">
                      <button
                        onClick={() => handleReaction(msg.id, 'like')}
                        className={`px-2 py-1 rounded-lg text-sm transition ${
                          reactions[msg.id] === 'like'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
                        }`}
                        title="Понравилось"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleReaction(msg.id, 'dislike')}
                        className={`px-2 py-1 rounded-lg text-sm transition ${
                          reactions[msg.id] === 'dislike'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title="Не понравилось"
                      >
                        👎
                      </button>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="px-2 py-1 rounded-lg text-sm bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="Копировать"
                      >
                        {copiedId === msg.id ? '✅' : '📋'}
                      </button>
                      <button
                        onClick={() => handleRepeat(msg.content)}
                        className="px-2 py-1 rounded-lg text-sm bg-gray-100 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600 transition"
                        title="Повторить запрос"
                      >
                        🔄
                      </button>
                      <button
                        onClick={() => handleShare(msg.content)}
                        className="px-2 py-1 rounded-lg text-sm bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600 transition"
                        title="Поделиться"
                      >
                        📤
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {thinkingStep && (
                <div className="mb-4 flex justify-start message-appear">
                  <div className="max-w-[90%] md:max-w-[85%] px-4 py-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center gap-3">
                    <span className="inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>{thinkingStep}</span>
                  </div>
                </div>
              )}

              {streamingText && (
                <div className="mb-4 flex justify-start message-appear">
                  <div className="max-w-[90%] md:max-w-[85%] px-4 py-3 rounded-2xl bg-white border border-gc-border text-gc-text break-words overflow-hidden">
                    <div className="prose prose-sm max-w-none break-words">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {streamingText}
                      </ReactMarkdown>
                    </div>
                    <span className="streaming-cursor"></span>
                  </div>
                </div>
              )}

              {loading && !streamingText && !thinkingStep && (
                <div className="flex justify-start mb-4 message-appear">
                  <div className="bg-white border border-gc-border px-4 py-3 rounded-2xl">
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 md:p-4 bg-white border-t border-gc-border">
              {attachedImage && (
                <div className="mb-3 flex items-start gap-2">
                  <div className="relative">
                    <img
                      src={attachedImage}
                      alt="Прикреплённое фото"
                      className="max-h-24 rounded-lg border-2 border-gc-green"
                    />
                    <button
                      onClick={() => { setAttachedImage(null); setAttachedFile(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAttachPhoto}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="bg-gc-green-light hover:bg-gc-border text-gc-text px-3 md:px-4 py-3 rounded-xl btn-bounce disabled:opacity-50 text-xl"
                  title="Прикрепить фото"
                >
                  📷
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={attachedImage ? "Добавь описание..." : "Напиши сообщение..."}
                  className="flex-1 px-3 md:px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none text-gc-text text-base"
                  disabled={loading}
                />
                <button
                  onClick={() => setDeepThinking(!deepThinking)}
                  className={`px-3 md:px-4 py-3 rounded-xl btn-bounce text-xl transition ${
                    deepThinking
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                  title={deepThinking ? '🧠 Глубокое мышление ВКЛ' : '🧠 Глубокое мышление ВЫКЛ'}
                >
                  🧠
                </button>
                <button
                  onClick={sendMessage}
                  disabled={loading || (!input.trim() && !attachedImage)}
                  className={`text-white font-semibold px-4 md:px-6 py-3 rounded-xl btn-bounce disabled:opacity-50 ${
                    isCreator ? 'bg-red-600 hover:bg-red-700' : 'bg-gc-green hover:bg-gc-green-dark'
                  }`}
                >
                  ➤
                </button>
              </div>

              {deepThinking && (
                <div className="mt-2 text-xs text-purple-600 flex items-center gap-2">
                  <span>🧠</span>
                  <span>Глубокое мышление включено — ответ будет точнее, но дольше</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 page-appear">
            <div className="w-full max-w-3xl">
              <h1 className="text-2xl md:text-4xl font-bold text-gc-text text-center mb-4">
                {isCreator ? `👑 Георгий, чем помочь?` : `${user?.name || 'Привет'}, чем помочь?`}
              </h1>
              <p className="text-sm md:text-base text-gc-text-light text-center mb-6 md:mb-8">
                Задай вопрос, реши задачу или прикрепи фото
              </p>

              {attachedImage && (
                <div className="mb-4 flex justify-center">
                  <div className="relative">
                    <img
                      src={attachedImage}
                      alt="Прикреплённое фото"
                      className="max-h-40 rounded-xl border-2 border-gc-green"
                    />
                    <button
                      onClick={() => { setAttachedImage(null); setAttachedFile(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-lg border border-gc-border p-2 mb-4">
                <div className="flex gap-2 items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAttachPhoto}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gc-green-light hover:bg-gc-border text-gc-text px-3 md:px-4 py-3 rounded-xl btn-bounce text-xl"
                    title="Прикрепить фото"
                  >
                    📷
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendFromMainScreen()}
                    placeholder={attachedImage ? "Добавь описание..." : "Спросите GDZ Neuro..."}
                    className="flex-1 px-3 md:px-4 py-3 bg-transparent focus:outline-none text-gc-text text-base md:text-lg"
                  />
                  <button
                    onClick={() => setDeepThinking(!deepThinking)}
                    className={`px-3 md:px-4 py-3 rounded-xl btn-bounce text-xl transition ${
                      deepThinking
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                    }`}
                    title={deepThinking ? '🧠 Глубокое мышление ВКЛ' : '🧠 Глубокое мышление ВЫКЛ'}
                  >
                    🧠
                  </button>
                  <button
                    onClick={sendFromMainScreen}
                    disabled={!input.trim() && !attachedImage}
                    className={`text-white font-semibold px-4 md:px-6 py-3 rounded-xl btn-bounce disabled:opacity-50 ${
                      isCreator ? 'bg-red-600 hover:bg-red-700' : 'bg-gc-green hover:bg-gc-green-dark'
                    }`}
                  >
                    ➤
                  </button>
                </div>
              </div>

              {deepThinking && (
                <div className="mb-4 text-center text-xs text-purple-600">
                  🧠 Режим глубокого мышления включён
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                <button
                  onClick={() => { setInput('Что ты умеешь?'); }}
                  className="bg-white hover:bg-gc-green-light text-gc-text px-3 md:px-4 py-2 rounded-full border border-gc-border btn-bounce text-xs md:text-sm"
                >
                  💡 Что ты умеешь?
                </button>
                <button
                  onClick={() => { setInput('Реши уравнение 2x + 5 = 15'); }}
                  className="bg-white hover:bg-gc-green-light text-gc-text px-3 md:px-4 py-2 rounded-full border border-gc-border btn-bounce text-xs md:text-sm"
                >
                  🧮 Решить задачу
                </button>
                <button
                  onClick={() => { setInput('Напиши эссе на тему "Моя Родина"'); }}
                  className="bg-white hover:bg-gc-green-light text-gc-text px-3 md:px-4 py-2 rounded-full border border-gc-border btn-bounce text-xs md:text-sm"
                >
                  ✍️ Написать текст
                </button>
                <button
                  onClick={() => { setInput('Объясни фотосинтез простыми словами'); }}
                  className="bg-white hover:bg-gc-green-light text-gc-text px-3 md:px-4 py-2 rounded-full border border-gc-border btn-bounce text-xs md:text-sm"
                >
                  📚 Объяснить тему
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}