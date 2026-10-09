import { useState } from 'react';

interface SupportPageProps {
  onBack: () => void;
  onChat: () => void;
}

interface FAQItem {
  question: string;
  answer: string;
}

export default function SupportPage({ onBack, onChat }: SupportPageProps) {
  const [view, setView] = useState<'main' | 'faq'>('main');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqItems: FAQItem[] = [
    {
      question: 'Что умеет GDZ Neuro?',
      answer: 'GDZ Neuro — это умный помощник для учёбы. Решаю задачи по математике, физике, химии, программированию. Объясняю сложные темы простым языком. Помогаю с текстами: эссе, сочинения, переводы. Могу распознать задачу с фото и решить её пошагово.',
    },
    {
      question: 'Как работает GDZ Neuro?',
      answer: 'GDZ Neuro — это генеративная нейросеть на базе GigaChat. Она не выдаёт заготовленные ответы, а генерирует решение под твой конкретный запрос. Чем точнее и подробнее ты опишешь задачу — тем точнее будет ответ.',
    },
    {
      question: 'Как загрузить фото задачи?',
      answer: 'Нажми на иконку 📷 рядом с полем ввода. Выбери фото задачи — я распознаю текст с картинки (OCR) и сразу решу её пошагово. Работает с рукописным текстом, печатным и даже с плохими фото.',
    },
    {
      question: 'Помнит ли GDZ Neuro предыдущие сообщения?',
      answer: 'Да, я помню контекст в рамках одного чата — последние 10 сообщений. Ты можешь вести диалог, уточнять, просить объяснить подробнее. Но если начать новый чат — контекст сбросится.',
    },
    {
      question: 'Что делать, если ответ неправильный?',
      answer: 'Нейросеть может ошибаться. Если ответ кажется неверным — попроси проверить решение по шагам или уточни условие. Всегда перепроверяй важные ответы самостоятельно.',
    },
    {
      question: 'Бесплатно ли это?',
      answer: 'Да, GDZ Neuro полностью бесплатен. Никаких подписок, скрытых платежей и ограничений.',
    },
  ];

  if (view === 'faq') {
    return (
      <div className="min-h-screen p-6 page-appear">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setView('main')}
            className="mb-6 text-gc-text-light hover:text-gc-green transition btn-bounce"
          >
            ← Назад
          </button>

          <h1 className="text-3xl font-bold text-gc-text mb-8">Частые вопросы</h1>

          <div className="flex flex-col gap-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gc-border overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gc-green-light transition"
                >
                  <span className="text-lg font-semibold text-gc-text pr-4">
                    {item.question}
                  </span>
                  <span
                    className={`text-gc-text-light text-xl transition-transform ${
                      openIndex === i ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {openIndex === i && (
                  <div className="px-5 pb-5 text-gc-text-light leading-relaxed page-appear">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const topics = [
    {
      icon: '💬',
      title: 'Чат с оператором',
      description: 'Написать в поддержку — ответят в чате',
      action: onChat,
    },
    {
      icon: '❓',
      title: 'Помощь',
      description: 'Ответы на частые вопросы',
      action: () => setView('faq'),
    },
    {
      icon: '⭐',
      title: 'Как вам GDZ Neuro?',
      description: 'Поделиться мнением или опытом использования',
      action: () => alert('Спасибо за отзыв! Мы рады, что тебе нравится.'),
    },
  ];

  return (
    <div className="min-h-screen p-6 page-appear">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-gc-text-light hover:text-gc-green transition btn-bounce"
        >
          ← Назад
        </button>

        <h1 className="text-3xl font-bold text-gc-text mb-8">Поддержка</h1>

        <div className="flex flex-col gap-4">
          {topics.map((topic, i) => (
            <button
              key={i}
              onClick={topic.action}
              className="bg-white hover:bg-gc-green-light rounded-2xl border border-gc-border p-5 flex items-center gap-4 text-left btn-bounce transition"
            >
              <div className="text-3xl">{topic.icon}</div>
              <div className="flex-1">
                <div className="text-lg font-semibold text-gc-text">{topic.title}</div>
                <div className="text-sm text-gc-text-light mt-1">{topic.description}</div>
              </div>
              <div className="text-gc-text-light text-xl">→</div>
            </button>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gc-text-light">
          <p>GDZ Neuro © 2026</p>
          <p className="mt-2">Сделано с ❤️ для школьников и студентов</p>
        </div>
      </div>
    </div>
  );
}