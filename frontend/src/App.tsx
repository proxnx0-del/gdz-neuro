import { useEffect, useState } from 'react';
import { useAuthStore, useThemeStore } from './store';
import { authAPI } from './api';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AnonymousPage from './pages/AnonymousPage';

function App() {
  const { user, token, setAuth, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (token) {
      authAPI.me()
        .then((res) => {
          setAuth(res.data, token);
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gc-text text-xl">Загрузка...</div>
      </div>
    );
  }

  if (user) {
    return <ChatPage />;
  }

  if (anonymous) {
    return <AnonymousPage onLogin={() => setAnonymous(false)} />;
  }

  return <LoginPage onAnonymous={() => setAnonymous(true)} />;
}

export default App;