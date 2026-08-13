export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

const STORAGE_KEY_USER = 'app_google_user';

export class GoogleAuthManager {
  public static getUser(): GoogleUser | null {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static setUser(user: GoogleUser | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }

  public static logout(): void {
    localStorage.removeItem(STORAGE_KEY_USER);
  }
}
