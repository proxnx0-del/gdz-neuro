import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

interface AnonymousPageProps {
  onLogin: () => void;
}

export default function AnonymousPage({ onLogin }: AnonymousPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string>('');
  const flushIntervalRef = useRef<any>(null);

  useEffect(() => {
    const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '127.0.0.1:8000'
  : `${window.location.hostname}:8000`;
    const ws = new WebSocket(`ws://${wsHost}/ws/anonymous`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Анонимный режим открыт');
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = setInterval(() => {
        if (bufferRef.current) {
          const chunk = bufferRef.current;
          bufferRef.current = '';
          setStreamingText((prev) => prev + chunk);
        }
      }, 60);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'chunk') {
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
        setMessages((prev) => [
          ...prev,
          { id: data.id, role: 'assistant', content: data.content },
        ]);
        setLoading(false);
      } else if (data.type === 'error') {
        alert(data.content);
        setStreamingText('');
        setLoading(false);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Ошибка:', e);
      setLoading(false);
    };

    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      ws.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || !wsRef.current) return;

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
    } else {
      setMessages((prev) => [
        ...prev,
        { id: 'user-' + Date.now(), role: 'user', content: userMessage },
      ]);
    }

    setLoading(true);

    if (file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', userMessage);

        const res = await fetch('http://127.0.0.1:8000/api/photo/anonymous', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: 'photo-bot-' + Date.now(), role: 'assistant', content: data.solution },
        ]);
      } catch (e) {
        console.error(e);
        setMessages((prev) => [
          ...prev,
          { id: 'error-' + Date.now(), role: 'assistant', content: 'Ошибка при обработке фото' },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Соединение потеряно. Обнови страницу.');
      setLoading(false);
      return;
    }

    wsRef.current.send(JSON.stringify({ content: userMessage }));
    setTimeout(() => setLoading(false), 30000);
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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [
      ...prev,
      { id: 'repeat-' + Date.now(), role: 'user', content },
    ]);
    setLoading(true);
    wsRef.current.send(JSON.stringify({ content }));
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

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-white border-b border-gc-border p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gc-green to-gc-green-dark text-white flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <div className="font-bold text-gc-text">GDZ Neuro</div>
            <div className="text-xs text-yellow-600">🔓 Анонимный режим</div>
          </div>
        </div>
        <button
          onClick={onLogin}
          className="bg-gc-green hover:bg-gc-green-dark text-white font-semibold px-4 py-2 rounded-xl btn-bounce text-sm"
        >
          Войти
        </button>
      </div>

      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-xs text-yellow-700">
        ⚠️ Анонимный режим: история <b>не сохраняется</b>. Обновишь страницу — всё пропадёт.
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center mt-12 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gc-text mb-4">
              Чем помочь сегодня?
            </h1>
            <p className="text-gc-text-light mb-8">
              Задай вопрос, реши задачу или прикрепи фото
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 flex flex-col message-appear ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl break-words overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-gc-green text-white'
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

            {msg.role === 'assistant' && (
              <div className="flex gap-1 mt-2 ml-1">
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
                  title="Повторить"
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

        {streamingText && (
          <div className="mb-4 flex justify-start message-appear">
            <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-white border border-gc-border text-gc-text break-words overflow-hidden">
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

        {loading && !streamingText && (
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

        {messages.length === 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <button
              onClick={() => setInput('Что ты умеешь?')}
              className="bg-white hover:bg-gc-green-light text-gc-text px-4 py-2 rounded-full border border-gc-border btn-bounce text-sm"
            >
              💡 Что ты умеешь?
            </button>
            <button
              onClick={() => setInput('Реши уравнение 2x + 5 = 15')}
              className="bg-white hover:bg-gc-green-light text-gc-text px-4 py-2 rounded-full border border-gc-border btn-bounce text-sm"
            >
              🧮 Решить задачу
            </button>
            <button
              onClick={() => setInput('Объясни фотосинтез простыми словами')}
              className="bg-white hover:bg-gc-green-light text-gc-text px-4 py-2 rounded-full border border-gc-border btn-bounce text-sm"
            >
              📚 Объяснить тему
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gc-border p-4 sticky bottom-0">
        <div className="max-w-3xl mx-auto">
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
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600"
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
              className="bg-gc-green-light hover:bg-gc-border text-gc-text px-4 py-3 rounded-xl btn-bounce disabled:opacity-50 text-xl"
              title="Прикрепить фото"
            >
              📷
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={attachedImage ? "Добавь описание к фото..." : "Спросите GDZ Neuro..."}
              className="flex-1 px-4 py-3 border-2 border-gc-border rounded-xl focus:border-gc-green focus:outline-none text-gc-text"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedImage)}
              className="bg-gc-green hover:bg-gc-green-dark text-white font-semibold px-6 py-3 rounded-xl btn-bounce disabled:opacity-50"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}