# ============================================================
# GDZ NEURO — БЭКЕНД С ГЛУБОКИМ МЫШЛЕНИЕМ
# FastAPI + GigaChat + SQLite + JWT + OCR + WebSocket + Поддержка
# ============================================================

import os
import uuid
import random
import asyncio
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from jose import JWTError, jwt
from passlib.context import CryptContext
from gigachat import GigaChat
from dotenv import load_dotenv
import easyocr
import numpy as np
from PIL import Image
import io

# ============================================================
# НАСТРОЙКИ
# ============================================================
load_dotenv()

GIGACHAT_AUTH_KEY = os.getenv("GIGACHAT_AUTH_KEY")
GIGACHAT_BASE_URL = os.getenv("GIGACHAT_BASE_URL", "https://gigachat.devices.sberbank.ru/api/v1")
GIGACHAT_SCOPE = os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
GIGACHAT_MODEL = os.getenv("GIGACHAT_MODEL", "GigaChat-2")

JWT_SECRET = os.getenv("JWT_SECRET", "change_me_please")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.mail.ru")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://proxnx0:Sdhy886di@cnpg-gdz-neuro-rw:5432/GDZNeuro")
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.0.15:5173",
]

CREATOR_EMAIL = "proxox@gmail.com"

# ============================================================
# СИСТЕМНЫЕ ПРОМПТЫ
# ============================================================
SYSTEM_PROMPT = """Ты — GDZ Neuro, экспертный AI-помощник для решения учебных задач.

## СТРУКТУРА ОТВЕТА
**📋 Что дано** → **🎯 Что найти** → **💡 Решение** → **✅ Проверка** → **📌 Ответ**

## ПРАВИЛА
- Объясняй КАЖДЫЙ шаг
- НЕ ПРОПУСКАЙ промежуточные вычисления
- Формулы через LaTeX: $x^2 + 5x = 0$
- Если не уверен — скажи об этом
- Дружелюбный, на «ты»
"""

SYSTEM_PROMPT_MATH = """Ты — GDZ Neuro, эксперт по математике, физике и химии.

## ПРАВИЛА
1. Всегда показывай формулы
2. Пиши единицы измерения
3. Проверяй размерность
4. Проверяй ответ подстановкой

## ФОРМАТ
LaTeX: $E = mc^2$ или $$S = \\pi r^2$$

## СТРУКТУРА
**📋 Дано** → **🎯 Найти** → **💡 Решение** → **✅ Проверка** → **📌 Ответ**
"""

SYSTEM_PROMPT_HUMAN = """Ты — GDZ Neuro, эксперт по гуманитарным предметам.

## ПРАВИЛА
1. Развёрнутые ответы — 3-4 абзаца
2. Примеры из литературы, истории
3. Структура: введение, основная часть, вывод
4. Литературный язык
"""

SYSTEM_PROMPT_PHOTO = """Ты — GDZ Neuro, эксперт по решению задач с изображений.

## АЛГОРИТМ
1. Проверь распознавание текста
2. Определи тип задачи
3. Разбери условие
4. Реши пошагово
5. Проверь ответ
6. Дай итог

## ВАЖНО
Если на фото не задача — скажи об этом.
Если текст нечитаем — попроси переснять.
"""


def get_system_prompt(task_type: str = "general") -> str:
    if task_type == "math":
        return SYSTEM_PROMPT_MATH
    elif task_type == "human":
        return SYSTEM_PROMPT_HUMAN
    elif task_type == "photo":
        return SYSTEM_PROMPT_PHOTO
    return SYSTEM_PROMPT


def detect_task_type(text: str) -> str:
    text_lower = text.lower()
    math_keywords = ['реши', 'уравнение', 'вычисли', 'найди', 'доказать',
                     'x =', 'y =', 'sin', 'cos', 'tg', 'log', 'интеграл',
                     'производная', 'площадь', 'периметр', 'объём', 'скорость',
                     'сила', 'масса', 'энергия', 'моль', 'реакция', 'задача',
                     'сколько', 'чему равно', 'вычислить']
    human_keywords = ['сочинение', 'эссе', 'анализ', 'характеристика',
                      'почему', 'объясни', 'расскажи', 'пересказ', 'перевод',
                      'правило', 'падеж', 'спряжение', 'история', 'биография',
                      'напиши', 'описание', 'сравнение', 'аргумент']
    for kw in math_keywords:
        if kw in text_lower:
            return "math"
    for kw in human_keywords:
        if kw in text_lower:
            return "human"
    return "general"


# ============================================================
# БАЗА ДАННЫХ
# ============================================================
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    is_creator = Column(Boolean, default=False)
    is_operator = Column(Boolean, default=False)
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")

class AuthCode(Base):
    __tablename__ = "auth_codes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, index=True, nullable=False)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)

class Chat(Base):
    __tablename__ = "chats"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), default="Новый чат")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chats.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    chat = relationship("Chat", back_populates="messages")

class MessageReaction(Base):
    __tablename__ = "message_reactions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    reaction = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    operator_id = Column(String, ForeignKey("users.id"), nullable=True)
    subject = Column(String(200), default="Вопрос")
    status = Column(String(20), default="waiting")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")
    user = relationship("User", foreign_keys=[user_id])
    operator = relationship("User", foreign_keys=[operator_id])

class TicketMessage(Base):
    __tablename__ = "ticket_messages"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String, ForeignKey("support_tickets.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    ticket = relationship("SupportTicket", back_populates="messages")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================
# GIGACHAT
# ============================================================
giga = GigaChat(
    credentials=GIGACHAT_AUTH_KEY,
    base_url=GIGACHAT_BASE_URL,
    verify_ssl_certs=False,
    scope=GIGACHAT_SCOPE,
    model=GIGACHAT_MODEL
)

# ============================================================
# OCR
# ============================================================
print("[*] Загрузка OCR...")
reader = easyocr.Reader(['ru', 'en'], gpu=False)
print("[+] OCR готов!")

# ============================================================
# БЕЗОПАСНОСТЬ
# ============================================================
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================================
# СХЕМЫ
# ============================================================
class RequestCodeSchema(BaseModel):
    email: EmailStr

class VerifyCodeSchema(BaseModel):
    email: EmailStr
    code: str
    name: Optional[str] = None

class MessageSchema(BaseModel):
    content: str

class ChatSchema(BaseModel):
    title: Optional[str] = "Новый чат"

class TicketCreateSchema(BaseModel):
    subject: str = "Вопрос"
    content: str

class TicketMessageSchema(BaseModel):
    content: str

class ReactionSchema(BaseModel):
    reaction: str

# ============================================================
# FASTAPI
# ============================================================
app = FastAPI(title="GDZ Neuro API", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ============================================================
# ОТПРАВКА ПИСЕМ
# ============================================================
def send_code_email(to_email: str, code: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[CODE] {to_email}: {code}")
        return True
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email
        msg["Subject"] = "Код входа в GDZ Neuro"
        body = f"""
        <html><body style="font-family: Arial; background: #f1f8e9; padding: 30px;">
        <div style="max-width: 500px; margin: auto; background: white; border-radius: 15px; padding: 30px;">
        <h1 style="color: #1b5e20; text-align: center;">GDZ Neuro</h1>
        <p style="color: #2e7d32;">Твой код для входа:</p>
        <div style="background: #21a038; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px;">{code}</div>
        <p style="color: #558b2f; font-size: 14px;">Код действителен 10 минут.</p>
        </div></body></html>
        """
        msg.attach(MIMEText(body, "html"))
        if SMTP_PORT == 587:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"[!] Ошибка отправки: {e}")
        return False

# ============================================================
# API: АУТЕНТИФИКАЦИЯ
# ============================================================
@app.post("/api/auth/request-code")
def request_code(data: RequestCodeSchema, db: Session = Depends(get_db)):
    code = str(random.randint(100000, 999999))
    expires = datetime.utcnow() + timedelta(minutes=10)
    auth_code = AuthCode(email=data.email, code=code, expires_at=expires)
    db.add(auth_code)
    db.commit()
    send_code_email(data.email, code)
    return {"message": "Код отправлен", "code": code}

@app.post("/api/auth/verify-code")
def verify_code(data: VerifyCodeSchema, db: Session = Depends(get_db)):
    auth_code = db.query(AuthCode).filter(
        AuthCode.email == data.email,
        AuthCode.code == data.code,
        AuthCode.used == False
    ).first()
    if not auth_code:
        raise HTTPException(status_code=400, detail="Неверный код")
    if datetime.utcnow() > auth_code.expires_at:
        raise HTTPException(status_code=400, detail="Код истёк")
    auth_code.used = True

    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        is_creator = (data.email == CREATOR_EMAIL)
        user = User(
            email=data.email,
            name=data.name or data.email.split("@")[0],
            is_creator=is_creator,
            is_operator=False
        )
        db.add(user)

    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_creator": user.is_creator,
            "is_operator": user.is_operator
        }
    }

@app.get("/api/auth/me")
def get_me(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "is_creator": user.is_creator,
        "is_operator": user.is_operator
    }

@app.get("/api/auth/stats")
def get_stats(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    chats_count = db.query(Chat).filter(Chat.user_id == user_id).count()
    messages_count = db.query(Message).join(Chat).filter(Chat.user_id == user_id).count()
    user = db.query(User).filter(User.id == user_id).first()
    return {
        "chats_count": chats_count,
        "messages_count": messages_count,
        "created_at": user.created_at if user else None,
        "last_login": user.last_login if user else None,
        "is_creator": user.is_creator if user else False,
        "is_operator": user.is_operator if user else False,
    }

# ============================================================
# API: РЕАКЦИИ
# ============================================================
@app.post("/api/messages/{message_id}/reaction")
def set_reaction(message_id: str, data: ReactionSchema, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    if data.reaction not in ["like", "dislike"]:
        raise HTTPException(status_code=400, detail="Неверная реакция")

    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")

    chat = db.query(Chat).filter(Chat.id == message.chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=403, detail="Нет доступа")

    existing = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == user_id
    ).first()

    if existing:
        if existing.reaction == data.reaction:
            db.delete(existing)
            db.commit()
            return {"reaction": None}
        else:
            existing.reaction = data.reaction
            db.commit()
            return {"reaction": data.reaction}
    else:
        reaction = MessageReaction(
            message_id=message_id,
            user_id=user_id,
            reaction=data.reaction
        )
        db.add(reaction)
        db.commit()
        return {"reaction": data.reaction}

@app.get("/api/messages/{message_id}/reaction")
def get_reaction(message_id: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    reaction = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == user_id
    ).first()
    return {"reaction": reaction.reaction if reaction else None}

# ============================================================
# API: ЧАТЫ
# ============================================================
@app.get("/api/chats")
def get_chats(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    chats = db.query(Chat).filter(Chat.user_id == user_id).order_by(Chat.updated_at.desc()).all()
    return [{"id": c.id, "title": c.title, "created_at": c.created_at} for c in chats]

@app.post("/api/chats")
def create_chat(data: ChatSchema, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    chat = Chat(user_id=user_id, title=data.title)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return {"id": chat.id, "title": chat.title}

@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at).all()
    return {
        "id": chat.id,
        "title": chat.title,
        "messages": [{"id": m.id, "role": m.role, "content": m.content} for m in messages]
    }

@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    db.delete(chat)
    db.commit()
    return {"message": "Чат удалён"}

# ============================================================
# API: СООБЩЕНИЯ (HTTP)
# ============================================================
@app.post("/api/chats/{chat_id}/messages")
def send_message(chat_id: str, data: MessageSchema, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    user_msg = Message(chat_id=chat_id, role="user", content=data.content)
    db.add(user_msg)
    db.commit()

    task_type = detect_task_type(data.content)
    system_prompt = get_system_prompt(task_type)

    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at).all()
    full_prompt = system_prompt + "\n\n"
    for m in messages[-10:]:
        role = "Пользователь" if m.role == "user" else "Ассистент"
        full_prompt += f"{role}: {m.content}\n"
    full_prompt += "\nАссистент:"

    try:
        response = giga.chat(full_prompt)
        bot_response = response.choices[0].message.content
    except Exception as e:
        bot_response = f"Ошибка GigaChat: {str(e)}"

    bot_msg = Message(chat_id=chat_id, role="assistant", content=bot_response)
    db.add(bot_msg)
    if chat.title == "Новый чат" and data.content:
        chat.title = data.content[:50]
    db.commit()
    return {
        "user_message": {"id": user_msg.id, "role": "user", "content": user_msg.content},
        "bot_message": {"id": bot_msg.id, "role": "assistant", "content": bot_msg.content}
    }

# ============================================================
# WEBSOCKET: СТРИМИНГ С ГЛУБОКИМ МЫШЛЕНИЕМ
# ============================================================
@app.websocket("/ws/chat/{chat_id}")
async def websocket_chat(websocket: WebSocket, chat_id: str):
    await websocket.accept()
    db = SessionLocal()
    try:
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            await websocket.send_json({"type": "error", "content": "Чат не найден"})
            await websocket.close()
            return

        while True:
            data = await websocket.receive_json()
            content = data.get("content", "")
            deep_thinking = data.get("deep_thinking", False)
            if not content:
                continue

            user_msg = Message(chat_id=chat_id, role="user", content=content)
            db.add(user_msg)
            db.commit()
            db.refresh(user_msg)

            await websocket.send_json({
                "type": "user_saved",
                "id": user_msg.id,
                "content": user_msg.content
            })

            task_type = detect_task_type(content)
            system_prompt = get_system_prompt(task_type)

            messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at).all()
            full_prompt = system_prompt + "\n\n"
            for m in messages[-10:]:
                role = "Пользователь" if m.role == "user" else "Ассистент"
                full_prompt += f"{role}: {m.content}\n"
            full_prompt += "\nАссистент:"

            if deep_thinking:
                await websocket.send_json({"type": "thinking_start"})
                try:
                    # ПРОХОД 1
                    await websocket.send_json({"type": "thinking_step", "step": "🧠 Анализирую задачу..."})
                    pass1_prompt = f"""Реши эту задачу быстро и точно.

{full_prompt}

Дай краткое решение с ответом."""
                    pass1_response = giga.chat(pass1_prompt)
                    pass1_result = pass1_response.choices[0].message.content

                    # ПРОХОД 2
                    await websocket.send_json({"type": "thinking_step", "step": "🔍 Проверяю решение..."})
                    pass2_prompt = f"""Проверь это решение на ошибки. Найди слабые места, неточности, пропущенные шаги.

ЗАДАЧА:
{content}

РЕШЕНИЕ:
{pass1_result}

Если решение верное — ответь "ВЕРНО". Если есть ошибки — напиши, что именно не так и как исправить."""
                    pass2_response = giga.chat(pass2_prompt)
                    pass2_result = pass2_response.choices[0].message.content

                    # ПРОХОД 3
                    await websocket.send_json({"type": "thinking_step", "step": "📚 Углубляю объяснение..."})
                    pass3_prompt = f"""На основе задачи и проверки дай МАКСИМАЛЬНО ДЕТАЛЬНОЕ решение с объяснением КАЖДОГО шага.

ЗАДАЧА:
{content}

ПЕРВОЕ РЕШЕНИЕ:
{pass1_result}

ПРОВЕРКА:
{pass2_result}

Дай финальное подробное решение:
- Что дано
- Что найти
- Решение пошагово с объяснением
- Проверка
- Ответ"""
                    pass3_response = giga.chat(pass3_prompt)
                    bot_response = pass3_response.choices[0].message.content

                    if "ВЕРНО" not in pass2_result.upper()[:20]:
                        bot_response += f"\n\n---\n\n**🔍 Проверка (глубокое мышление):**\n{pass2_result}"

                    await websocket.send_json({"type": "thinking_end"})

                except Exception as e:
                    await websocket.send_json({"type": "error", "content": f"Ошибка глубокого мышления: {str(e)}"})
                    continue
            else:
                try:
                    response = giga.chat(full_prompt)
                    bot_response = response.choices[0].message.content
                except Exception as e:
                    await websocket.send_json({"type": "error", "content": f"Ошибка GigaChat: {str(e)}"})
                    continue

            chunk_size = 25
            for i in range(0, len(bot_response), chunk_size):
                chunk = bot_response[i:i+chunk_size]
                await websocket.send_json({"type": "chunk", "content": chunk})
                await asyncio.sleep(0.04)

            bot_msg = Message(chat_id=chat_id, role="assistant", content=bot_response)
            db.add(bot_msg)
            if chat.title == "Новый чат" and content:
                chat.title = content[:50]
            db.commit()
            db.refresh(bot_msg)

            await websocket.send_json({
                "type": "done",
                "id": bot_msg.id,
                "content": bot_response
            })

    except WebSocketDisconnect:
        print(f"[WS] Клиент отключился от чата {chat_id}")
    except Exception as e:
        print(f"[WS] Ошибка: {e}")
    finally:
        db.close()

# ============================================================
# WEBSOCKET: АНОНИМНЫЙ РЕЖИМ С ГЛУБОКИМ МЫШЛЕНИЕМ
# ============================================================
@app.websocket("/ws/anonymous")
async def websocket_anonymous(websocket: WebSocket):
    await websocket.accept()
    try:
        temp_history = []

        while True:
            data = await websocket.receive_json()
            content = data.get("content", "")
            deep_thinking = data.get("deep_thinking", False)
            if not content:
                continue

            task_type = detect_task_type(content)
            system_prompt = get_system_prompt(task_type)

            full_prompt = system_prompt + "\n\n"
            for m in temp_history[-10:]:
                role = "Пользователь" if m["role"] == "user" else "Ассистент"
                full_prompt += f"{role}: {m['content']}\n"
            full_prompt += f"Пользователь: {content}\n\nАссистент:"

            if deep_thinking:
                await websocket.send_json({"type": "thinking_start"})
                try:
                    await websocket.send_json({"type": "thinking_step", "step": "🧠 Анализирую задачу..."})
                    pass1_prompt = f"""Реши эту задачу быстро и точно.

{full_prompt}

Дай краткое решение с ответом."""
                    pass1_response = giga.chat(pass1_prompt)
                    pass1_result = pass1_response.choices[0].message.content

                    await websocket.send_json({"type": "thinking_step", "step": "🔍 Проверяю решение..."})
                    pass2_prompt = f"""Проверь это решение на ошибки.

ЗАДАЧА:
{content}

РЕШЕНИЕ:
{pass1_result}

Если решение верное — ответь "ВЕРНО". Если есть ошибки — напиши, что именно не так."""
                    pass2_response = giga.chat(pass2_prompt)
                    pass2_result = pass2_response.choices[0].message.content

                    await websocket.send_json({"type": "thinking_step", "step": "📚 Углубляю объяснение..."})
                    pass3_prompt = f"""Дай МАКСИМАЛЬНО ДЕТАЛЬНОЕ решение с объяснением.

ЗАДАЧА:
{content}

ПЕРВОЕ РЕШЕНИЕ:
{pass1_result}

ПРОВЕРКА:
{pass2_result}

Дай финальное подробное решение."""
                    pass3_response = giga.chat(pass3_prompt)
                    bot_response = pass3_response.choices[0].message.content

                    if "ВЕРНО" not in pass2_result.upper()[:20]:
                        bot_response += f"\n\n---\n\n**🔍 Проверка:**\n{pass2_result}"

                    await websocket.send_json({"type": "thinking_end"})

                except Exception as e:
                    await websocket.send_json({"type": "error", "content": f"Ошибка: {str(e)}"})
                    continue
            else:
                try:
                    response = giga.chat(full_prompt)
                    bot_response = response.choices[0].message.content
                except Exception as e:
                    await websocket.send_json({"type": "error", "content": f"Ошибка GigaChat: {str(e)}"})
                    continue

            temp_history.append({"role": "user", "content": content})
            temp_history.append({"role": "assistant", "content": bot_response})

            chunk_size = 25
            for i in range(0, len(bot_response), chunk_size):
                chunk = bot_response[i:i+chunk_size]
                await websocket.send_json({"type": "chunk", "content": chunk})
                await asyncio.sleep(0.04)

            await websocket.send_json({
                "type": "done",
                "id": "anon-" + str(uuid.uuid4()),
                "content": bot_response
            })

    except WebSocketDisconnect:
        print("[WS] Анонимный клиент отключился")
    except Exception as e:
        print(f"[WS] Ошибка анонимного режима: {e}")

# ============================================================
# API: ФОТО (ЗАРЕГИСТРИРОВАННЫЕ)
# ============================================================
@app.post("/api/photo/solve")
async def solve_photo(
    file: UploadFile = File(...),
    description: str = "",
    chat_id: str = "",
    user_id: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    if image.mode != 'RGB':
        image = image.convert('RGB')

    img_array = np.array(image)

    try:
        raw_results = reader.readtext(img_array, detail=1, paragraph=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка OCR: {str(e)}")

    if not raw_results:
        try:
            raw_results = reader.readtext(img_array, detail=1, paragraph=True)
        except Exception:
            pass

    if not raw_results:
        raise HTTPException(status_code=400, detail="Не удалось распознать текст")

    detected_blocks = []
    for item in raw_results:
        try:
            bbox, text, confidence = item
            xs = [p[0] for p in bbox]
            ys = [p[1] for p in bbox]
            detected_blocks.append({
                "text": text,
                "confidence": float(confidence),
                "x": float(sum(xs) / len(xs)),
                "y": float(sum(ys) / len(ys)),
            })
        except Exception:
            continue

    detected_blocks.sort(key=lambda b: (round(b['y'] / 20), b['x']))
    task_text = "\n".join([b["text"] for b in detected_blocks])
    avg_confidence = sum(b["confidence"] for b in detected_blocks) / len(detected_blocks) if detected_blocks else 0

    if not task_text.strip() and not description.strip():
        raise HTTPException(status_code=400, detail="Не удалось распознать текст")

    prompt = SYSTEM_PROMPT_PHOTO + "\n\n"

    if task_text.strip():
        prompt += f"**РАСПОЗНАННЫЙ ТЕКСТ С ФОТО:**\n{task_text}\n\n"
        prompt += f"**Уверенность OCR:** {avg_confidence*100:.0f}%\n\n"

    if description.strip():
        prompt += f"**ДОПОЛНИТЕЛЬНО ОТ ПОЛЬЗОВАТЕЛЯ:**\n{description}\n\n"

    prompt += "**ПОДРОБНОЕ РЕШЕНИЕ:**\n"

    try:
        response = giga.chat(prompt)
        solution = response.choices[0].message.content
    except Exception as e:
        solution = f"Ошибка GigaChat: {str(e)}"

    if chat_id:
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
        if chat:
            user_content = description if description else f"[Фото]: {task_text[:200]}"
            user_msg = Message(chat_id=chat_id, role="user", content=user_content)
            db.add(user_msg)
            bot_msg = Message(chat_id=chat_id, role="assistant", content=solution)
            db.add(bot_msg)
            if chat.title == "Новый чат":
                chat.title = user_content[:50]
            db.commit()

    return {
        "recognized_text": task_text,
        "solution": solution,
        "blocks_count": len(detected_blocks),
        "avg_confidence": avg_confidence
    }

# ============================================================
# API: ФОТО (АНОНИМНОЕ)
# ============================================================
@app.post("/api/photo/anonymous")
async def solve_photo_anonymous(
    file: UploadFile = File(...),
    description: str = "",
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    if image.mode != 'RGB':
        image = image.convert('RGB')

    img_array = np.array(image)

    try:
        raw_results = reader.readtext(img_array, detail=1, paragraph=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка OCR: {str(e)}")

    if not raw_results:
        try:
            raw_results = reader.readtext(img_array, detail=1, paragraph=True)
        except Exception:
            pass

    if not raw_results:
        raise HTTPException(status_code=400, detail="Не удалось распознать текст")

    detected_blocks = []
    for item in raw_results:
        try:
            bbox, text, confidence = item
            xs = [p[0] for p in bbox]
            ys = [p[1] for p in bbox]
            detected_blocks.append({
                "text": text,
                "confidence": float(confidence),
                "x": float(sum(xs) / len(xs)),
                "y": float(sum(ys) / len(ys)),
            })
        except Exception:
            continue

    detected_blocks.sort(key=lambda b: (round(b['y'] / 20), b['x']))
    task_text = "\n".join([b["text"] for b in detected_blocks])
    avg_confidence = sum(b["confidence"] for b in detected_blocks) / len(detected_blocks) if detected_blocks else 0

    if not task_text.strip() and not description.strip():
        raise HTTPException(status_code=400, detail="Не удалось распознать текст")

    prompt = SYSTEM_PROMPT_PHOTO + "\n\n"

    if task_text.strip():
        prompt += f"**РАСПОЗНАННЫЙ ТЕКСТ С ФОТО:**\n{task_text}\n\n"
        prompt += f"**Уверенность OCR:** {avg_confidence*100:.0f}%\n\n"

    if description.strip():
        prompt += f"**ДОПОЛНИТЕЛЬНО ОТ ПОЛЬЗОВАТЕЛЯ:**\n{description}\n\n"

    prompt += "**ПОДРОБНОЕ РЕШЕНИЕ:**\n"

    try:
        response = giga.chat(prompt)
        solution = response.choices[0].message.content
    except Exception as e:
        solution = f"Ошибка GigaChat: {str(e)}"

    return {
        "recognized_text": task_text,
        "solution": solution,
        "blocks_count": len(detected_blocks),
        "avg_confidence": avg_confidence
    }

# ============================================================
# API: ПОДДЕРЖКА
# ============================================================
@app.get("/api/support/status")
def support_status(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    operators = db.query(User).filter(User.is_operator == True, User.is_active == True).all()
    total = len(operators)
    busy = 0
    for op in operators:
        active = db.query(SupportTicket).filter(
            SupportTicket.operator_id == op.id,
            SupportTicket.status == "active"
        ).count()
        if active > 0:
            busy += 1
    free = total - busy
    waiting = db.query(SupportTicket).filter(SupportTicket.status == "waiting").count()
    wait_minutes = max(1, waiting * 3) if free == 0 else max(0, waiting * 1)

    return {
        "operators_total": total,
        "operators_free": free,
        "operators_busy": busy,
        "tickets_waiting": waiting,
        "estimated_wait_minutes": wait_minutes
    }

@app.post("/api/support/tickets")
def create_ticket(data: TicketCreateSchema, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    ticket = SupportTicket(user_id=user_id, subject=data.subject, status="waiting")
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    msg = TicketMessage(ticket_id=ticket.id, sender_id=user_id, sender_role="user", content=data.content)
    db.add(msg)
    db.commit()

    operators = db.query(User).filter(User.is_operator == True, User.is_active == True).all()
    assigned = None
    for op in operators:
        active = db.query(SupportTicket).filter(
            SupportTicket.operator_id == op.id,
            SupportTicket.status == "active"
        ).count()
        if active == 0:
            ticket.operator_id = op.id
            ticket.status = "active"
            db.commit()
            assigned = op
            break

    return {
        "ticket_id": ticket.id,
        "status": ticket.status,
        "operator_name": assigned.name if assigned else None,
        "message": "Тикет создан. Оператор назначен." if assigned else "Тикет создан. Ожидайте оператора."
    }

@app.get("/api/support/tickets/my")
def get_my_tickets(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    tickets = db.query(SupportTicket).filter(SupportTicket.user_id == user_id).order_by(SupportTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "status": t.status,
            "operator_name": t.operator.name if t.operator else None,
            "created_at": t.created_at,
            "messages_count": len(t.messages),
        }
        for t in tickets
    ]

@app.get("/api/support/tickets/{ticket_id}")
def get_ticket(ticket_id: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id, SupportTicket.user_id == user_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "status": ticket.status,
        "operator_name": ticket.operator.name if ticket.operator else None,
        "created_at": ticket.created_at,
        "messages": [
            {"id": m.id, "sender": m.sender_role, "content": m.content, "created_at": m.created_at}
            for m in ticket.messages
        ]
    }

@app.post("/api/support/tickets/{ticket_id}/messages")
def send_ticket_message(ticket_id: str, data: TicketMessageSchema, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id, SupportTicket.user_id == user_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    msg = TicketMessage(ticket_id=ticket_id, sender_id=user_id, sender_role="user", content=data.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "sender": msg.sender_role, "content": msg.content, "created_at": msg.created_at}

def verify_operator(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not (user.is_operator or user.is_creator):
        raise HTTPException(status_code=403, detail="Доступ только для операторов")
    return user_id

@app.get("/api/operator/tickets")
def operator_get_tickets(operator_id: str = Depends(verify_operator), db: Session = Depends(get_db)):
    tickets = db.query(SupportTicket).filter(
        SupportTicket.operator_id == operator_id
    ).order_by(SupportTicket.updated_at.desc()).all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "status": t.status,
            "user_email": t.user.email if t.user else "—",
            "user_name": t.user.name if t.user else "—",
            "created_at": t.created_at,
            "messages_count": len(t.messages),
        }
        for t in tickets
    ]

@app.get("/api/operator/tickets/waiting")
def operator_get_waiting(operator_id: str = Depends(verify_operator), db: Session = Depends(get_db)):
    tickets = db.query(SupportTicket).filter(SupportTicket.status == "waiting").order_by(SupportTicket.created_at).all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "user_email": t.user.email if t.user else "—",
            "user_name": t.user.name if t.user else "—",
            "created_at": t.created_at,
            "messages_count": len(t.messages),
        }
        for t in tickets
    ]

@app.post("/api/operator/tickets/{ticket_id}/take")
def operator_take_ticket(ticket_id: str, operator_id: str = Depends(verify_operator), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    if ticket.status != "waiting":
        raise HTTPException(status_code=400, detail="Тикет уже занят")
    ticket.operator_id = operator_id
    ticket.status = "active"
    db.commit()
    return {"status": ticket.status}

@app.get("/api/operator/tickets/{ticket_id}")
def operator_get_ticket(ticket_id: str, operator_id: str = Depends(verify_operator), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "status": ticket.status,
        "user_email": ticket.user.email if ticket.user else "—",
        "operator_name": ticket.operator.name if ticket.operator else None,
        "messages": [
            {"id": m.id, "sender": m.sender_role, "content": m.content, "created_at": m.created_at}
            for m in ticket.messages
        ]
    }

@app.post("/api/operator/tickets/{ticket_id}/messages")
def operator_send_message(ticket_id: str, data: TicketMessageSchema, operator_id: str = Depends(verify_operator), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    msg = TicketMessage(ticket_id=ticket_id, sender_id=operator_id, sender_role="operator", content=data.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "sender": msg.sender_role, "content": msg.content, "created_at": msg.created_at}

@app.patch("/api/operator/tickets/{ticket_id}/close")
def operator_close_ticket(ticket_id: str, operator_id: str = Depends(verify_operator), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    ticket.status = "closed"
    db.commit()
    return {"status": ticket.status}

def verify_creator(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_creator:
        raise HTTPException(status_code=403, detail="Доступ только для создателя")
    return user_id

@app.get("/api/admin/users")
def admin_get_users(creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "is_creator": u.is_creator,
            "is_operator": u.is_operator,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "last_login": u.last_login,
            "chats_count": len(u.chats),
        }
        for u in users
    ]

@app.patch("/api/admin/users/{user_id}/operator")
def admin_toggle_operator(user_id: str, creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.is_creator:
        raise HTTPException(status_code=403, detail="Нельзя менять роль создателя")
    user.is_operator = not user.is_operator
    db.commit()
    return {"is_operator": user.is_operator}

@app.patch("/api/admin/users/{user_id}/block")
def admin_block_user(user_id: str, creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.is_creator:
        raise HTTPException(status_code=403, detail="Нельзя блокировать создателя")
    user.is_active = not user.is_active
    db.commit()
    return {"is_active": user.is_active}

@app.get("/api/admin/chats")
def admin_get_chats(creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    chats = db.query(Chat).order_by(Chat.updated_at.desc()).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "user_email": c.user.email if c.user else "—",
            "created_at": c.created_at,
            "messages_count": len(c.messages),
        }
        for c in chats
    ]

@app.delete("/api/admin/chats/{chat_id}")
def admin_delete_chat(chat_id: str, creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    db.delete(chat)
    db.commit()
    return {"message": "Чат удалён"}

@app.get("/api/admin/stats")
def admin_get_stats(creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    likes = db.query(MessageReaction).filter(MessageReaction.reaction == "like").count()
    dislikes = db.query(MessageReaction).filter(MessageReaction.reaction == "dislike").count()
    return {
        "total_users": db.query(User).count(),
        "total_chats": db.query(Chat).count(),
        "total_messages": db.query(Message).count(),
        "total_tickets": db.query(SupportTicket).count(),
        "active_users": db.query(User).filter(User.is_active == True).count(),
        "operators_count": db.query(User).filter(User.is_operator == True).count(),
        "likes": likes,
        "dislikes": dislikes,
    }

@app.get("/api/admin/tickets")
def admin_get_tickets(creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    tickets = db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "status": t.status,
            "user_email": t.user.email if t.user else "—",
            "operator_name": t.operator.name if t.operator else None,
            "created_at": t.created_at,
            "messages_count": len(t.messages),
        }
        for t in tickets
    ]

@app.get("/api/admin/operators")
def admin_get_operators(creator_id: str = Depends(verify_creator), db: Session = Depends(get_db)):
    ops = db.query(User).filter(User.is_operator == True).all()
    result = []
    for op in ops:
        active = db.query(SupportTicket).filter(
            SupportTicket.operator_id == op.id,
            SupportTicket.status == "active"
        ).count()
        closed = db.query(SupportTicket).filter(
            SupportTicket.operator_id == op.id,
            SupportTicket.status == "closed"
        ).count()
        result.append({
            "id": op.id,
            "name": op.name,
            "email": op.email,
            "is_active": op.is_active,
            "active_tickets": active,
            "closed_tickets": closed,
        })
    return result

@app.get("/")
def root():
    return {"message": "GDZ Neuro API v2.5", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)