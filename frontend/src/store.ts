import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  is_creator?: boolean;
  is_operator?: boolean;
}

interface SavedAccount {
  user: User;
  token: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  savedAccounts: SavedAccount[];
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  switchAccount: (email: string) => void;
  removeAccount: (email: string) => void;
}

// sessionStorage — изолирован для каждой вкладки
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: sessionStorage.getItem('token'),
  savedAccounts: JSON.parse(sessionStorage.getItem('saved_accounts') || '[]'),
  setAuth: (user, token) => {
    sessionStorage.setItem('token', token);
    const saved: SavedAccount[] = JSON.parse(sessionStorage.getItem('saved_accounts') || '[]');
    const filtered = saved.filter((a) => a.user.email !== user.email);
    filtered.unshift({ user, token });
    sessionStorage.setItem('saved_accounts', JSON.stringify(filtered));
    set({ user, token, savedAccounts: filtered });
  },
  logout: () => {
    sessionStorage.removeItem('token');
    set({ user: null, token: null });
  },
  switchAccount: (email) => {
    const saved: SavedAccount[] = JSON.parse(sessionStorage.getItem('saved_accounts') || '[]');
    const account = saved.find((a) => a.user.email === email);
    if (account) {
      sessionStorage.setItem('token', account.token);
      set({ user: account.user, token: account.token });
    }
  },
  removeAccount: (email) => {
    const saved: SavedAccount[] = JSON.parse(sessionStorage.getItem('saved_accounts') || '[]');
    const filtered = saved.filter((a) => a.user.email !== email);
    sessionStorage.setItem('saved_accounts', JSON.stringify(filtered));
    set({ savedAccounts: filtered });
  },
}));

interface ThemeStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return { theme: newTheme };
    });
  },
}));