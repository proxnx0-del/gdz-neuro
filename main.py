# ============================================================
# ГДЗ НЕЙРОСЕТЬ — ДИЗАЙН В СТИЛЕ GIGACHAT
# Без авторизации, чистый интерфейс
# ============================================================

import gradio as gr
from gigachat import GigaChat
import easyocr
from PIL import Image
import numpy as np

# ========== ТВОЙ AUTHORIZATION KEY ==========
AUTH_KEY = "MDFhMGYzYmYtOGNhMC03OTU3LTk1YmEtNzgyYTNhMDE2MzEzOmY2NGIxMDk1LTVhZTctNDVhZS1hOWNmLWM2ZTA5NmJlMDgzZA=="
# ============================================

giga = GigaChat(
    credentials=AUTH_KEY,
    base_url="https://gigachat.devices.sberbank.ru/api/v1",
    verify_ssl_certs=False,
    scope="GIGACHAT_API_PERS",
    model="GigaChat-2"
)

print("[*] Загрузка OCR...")
reader = easyocr.Reader(['ru', 'en'], gpu=False)
print("[+] OCR готов!")

# ============================================================
# ИСТОРИЯ
# ============================================================
my_history = []


def chat_fn(message, history):
    global my_history
    if not message.strip():
        return "Напиши что-нибудь!"

    system_prompt = (
        "Ты — умный помощник и решатель домашних заданий. "
        "Отвечай пошагово, объясняй. "
        "Используй LaTeX для формул: $2x + 5 = 15$."
    )
    full_prompt = system_prompt + "\n\n"
    for user_msg, bot_msg in my_history[-5:]:
        full_prompt += "Пользователь: " + str(user_msg) + "\n"
        full_prompt += "Ассистент: " + str(bot_msg) + "\n"
    full_prompt += "Пользователь: " + message + "\nАссистент:"

    try:
        response = giga.chat(full_prompt)
        bot_response = response.choices[0].message.content
    except Exception as e:
        bot_response = "Ошибка GigaChat: " + str(e)

    my_history.append((message, bot_response))
    return bot_response


def solve_photo(image):
    if image is None:
        return "Загрузи фото!", ""
    try:
        if isinstance(image, Image.Image):
            img_array = np.array(image)
        else:
            img_array = image
        results = reader.readtext(img_array, detail=0, paragraph=True)
        task_text = " ".join(results)
    except Exception as e:
        return "Ошибка OCR: " + str(e), ""
    if not task_text.strip():
        return "Не удалось распознать текст.", ""
    prompt = "Реши задачу пошагово:\n\n" + task_text + "\n\nРешение:"
    try:
        response = giga.chat(prompt)
        solution = response.choices[0].message.content
    except Exception as e:
        solution = "Ошибка GigaChat: " + str(e)
    return task_text, solution


# ============================================================
# CSS — ДИЗАЙН GIGACHAT
# ============================================================
custom_css = """
.gradio-container {
    background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%) !important;
    font-family: 'Inter', 'Segoe UI', sans-serif !important;
    min-height: 100vh !important;
}

/* ЗАГОЛОВОК */
h1 {
    color: #1b5e20 !important;
    font-weight: 700 !important;
    text-align: center !important;
    font-size: 2em !important;
    margin-bottom: 5px !important;
}
.subtitle {
    text-align: center !important;
    color: #558b2f !important;
    font-size: 15px !important;
    margin-bottom: 25px !important;
}

/* ВКЛАДКИ */
.tab-nav {
    background: rgba(255, 255, 255, 0.8) !important;
    border-radius: 15px !important;
    padding: 5px !important;
    border: 1px solid #c8e6c9 !important;
    margin-bottom: 20px !important;
}
.tab-nav button {
    color: #2e7d32 !important;
    font-weight: 600 !important;
    border-radius: 10px !important;
    padding: 10px 20px !important;
    border: none !important;
    background: transparent !important;
    transition: all 0.2s ease !important;
}
.tab-nav button.selected {
    background: #21a038 !important;
    color: white !important;
}

/* ЧАТ */
.chatbot {
    background: #ffffff !important;
    border: 1px solid #c8e6c9 !important;
    border-radius: 20px !important;
    box-shadow: 0 4px 20px rgba(33, 160, 56, 0.1) !important;
    overflow: hidden !important;
}
.chatbot .message {
    border-radius: 15px !important;
    padding: 12px 18px !important;
    margin: 8px 12px !important;
    max-width: 80% !important;
    font-size: 15px !important;
    line-height: 1.5 !important;
}
.chatbot .user {
    background: #21a038 !important;
    color: white !important;
    margin-left: auto !important;
}
.chatbot .bot {
    background: #f1f8e9 !important;
    color: #1b5e20 !important;
    border: 1px solid #c8e6c9 !important;
}

/* ПОЛЯ ВВОДА */
textarea, input[type="text"] {
    background: #ffffff !important;
    border: 2px solid #c8e6c9 !important;
    border-radius: 15px !important;
    padding: 14px 18px !important;
    font-size: 15px !important;
    color: #1b5e20 !important;
    box-shadow: 0 2px 8px rgba(33, 160, 56, 0.05) !important;
    transition: all 0.2s ease !important;
}
textarea:focus, input[type="text"]:focus {
    border-color: #21a038 !important;
    box-shadow: 0 0 0 3px rgba(33, 160, 56, 0.15) !important;
}
textarea::placeholder, input::placeholder {
    color: #a5d6a7 !important;
}

/* КНОПКИ */
.gr-button {
    background: #21a038 !important;
    color: white !important;
    border: none !important;
    border-radius: 15px !important;
    padding: 12px 28px !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    box-shadow: 0 4px 12px rgba(33, 160, 56, 0.3) !important;
    transition: all 0.2s ease !important;
    cursor: pointer !important;
}
.gr-button:hover {
    background: #1a8030 !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(33, 160, 56, 0.4) !important;
}
.gr-button:active {
    transform: translateY(0) !important;
}

/* ФОТО-ВКЛАДКА */
.image-container {
    border-radius: 15px !important;
    border: 2px dashed #c8e6c9 !important;
    background: #ffffff !important;
    padding: 20px !important;
}

/* ОПИСАНИЕ */
.description {
    color: #558b2f !important;
    font-size: 14px !important;
    text-align: center !important;
}

/* СКРЫТЬ ФУТЕР */
footer { display: none !important; }

/* СКРОЛЛБАР */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #f1f8e9; }
::-webkit-scrollbar-thumb { background: #a5d6a7; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #21a038; }
"""

# ============================================================
# ИНТЕРФЕЙС
# ============================================================
with gr.Blocks(title="ГДЗ Нейросеть") as iface:
    gr.Markdown("# 🤖 ГДЗ Нейросеть")
    gr.Markdown("<p class='subtitle'>Общайся с нейросетью как в ChatGPT или кидай фото задач</p>")

    with gr.Tabs():
        with gr.Tab("💬 Чат"):
            gr.ChatInterface(
                fn=chat_fn,
                title="",
                description="Задай любой вопрос или попроси решить задачу"
            )

        with gr.Tab("📷 Фото задачи"):
            with gr.Row():
                with gr.Column():
                    image_input = gr.Image(label="Загрузи фото", type="pil")
                    photo_btn = gr.Button("Распознать и решить", variant="primary")
                with gr.Column():
                    ocr_output = gr.Textbox(label="Распознанный текст", lines=5)
                    photo_output = gr.Textbox(label="Решение", lines=15)

            photo_btn.click(solve_photo, image_input, [ocr_output, photo_output])

# ============================================================
# ЗАПУСК
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("   ГДЗ НЕЙРОСЕТЬ ЗАПУЩЕНА")
    print("=" * 60)
    iface.launch(css=custom_css)