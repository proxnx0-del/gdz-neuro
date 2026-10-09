import { useState } from 'react';
import { useThemeStore } from '../store';

export default function MaintenancePage() {
  const { theme, toggleTheme } = useThemeStore();
  const [checking, setChecking] = useState(false);

  const handleRefresh = () => {
    setChecking(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 page-appear">
      <div className="w-full max-w-2xl">
        <div className={`rounded-3xl shadow-2xl p-10 text-center border-2 ${
          theme === 'dark'
            ? 'bg-[#0f1a12] border-red-900'
            : 'bg-white border-red-500'
        }`}>
          {/* Иконка */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-5xl shadow-lg avatar-glow-red">
              ⚠️
            </div>
          </div>

          {/* Метка */}
          <div className="flex justify-center mb-4">
            <span className="bg-red-100 text-red-600 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
              Технический перерыв
            </span>
          </div>

          {/* Заголовок */}
          <h1 className={`text-4xl font-bold mb-4 ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`}>
            Открытие задерживается
          </h1>

          {/* Текст */}
          <p className={`text-lg mb-8 leading-relaxed ${
            theme === 'dark' ? 'text-gray-300' : 'text-gc-text-light'
          }`}>
            Из-за <b>проваленного тестирования модели</b> запуск GDZ Neuro переносится
            на <b>неопределённый срок</b>.
          </p>

          {/* Что случилось */}
          <div className={`rounded-2xl p-6 mb-8 text-left ${
            theme === 'dark'
              ? 'bg-[#1a2e20] border border-red-900/50'
              : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`font-bold mb-3 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
              🔧 Что произошло?
            </h3>
            <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gc-text'}`}>
              <li>• Модель не прошла внутреннее тестирование качества ответов</li>
              <li>• Обнаружены ошибки в решении сложных задач</li>
              <li>• Точность OCR на плохих фото ниже допустимого уровня</li>
              <li>• Требуется доработка и повторное тестирование</li>
            </ul>
          </div>

          {/* Что делать */}
          <div className={`rounded-2xl p-6 mb-8 text-left ${
            theme === 'dark'
              ? 'bg-[#1a2e20] border border-yellow-900/50'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <h3 className={`font-bold mb-3 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
              ⏳ Что делать?
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gc-text'}`}>
              Подожди. Мы уведомим, когда бот будет готов. Если у тебя есть срочный
              вопрос — напиши в поддержку.
            </p>
          </div>

          {/* Кнопки */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="flex-1 bg-gc-green hover:bg-gc-green-dark text-white font-semibold py-3 rounded-xl btn-bounce disabled:opacity-50"
            >
              {checking ? '🔄 Проверяем...' : '🔄 Обновить'}
            </button>
            <a
              href="https://t.me/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 text-center font-semibold py-3 rounded-xl btn-bounce ${
                theme === 'dark'
                  ? 'bg-[#1a2e20] hover:bg-[#2a3e30] text-gray-300 border border-[#2d4a3a]'
                  : 'bg-gray-100 hover:bg-gray-200 text-gc-text'
              }`}
            >
              💬 Поддержка
            </a>
          </div>

          {/* Переключатель темы */}
          <button
            onClick={toggleTheme}
            className={`text-sm ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gc-text-light hover:text-gc-green'}`}
          >
            {theme === 'light' ? '🌙 Тёмная тема' : '☀️ Светлая тема'}
          </button>

          {/* Футер */}
          <div className={`mt-8 text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gc-text-light'}`}>
            GDZ Neuro © 2026 • Модель v0.9 beta
          </div>
        </div>
      </div>
    </div>
  );
}