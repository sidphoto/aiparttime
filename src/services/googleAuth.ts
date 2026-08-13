export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
  accessToken?: string;
}

const STORAGE_KEY_USER = 'app_google_user';
const STORAGE_KEY_CLIENT_ID = 'app_google_client_id';

// Default Client ID or fallback
export const DEFAULT_GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1092849503923-g5v8h94mklpq123456789abcdef.apps.googleusercontent.com';

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

  public static getClientId(): string {
    return localStorage.getItem(STORAGE_KEY_CLIENT_ID) || DEFAULT_GOOGLE_CLIENT_ID;
  }

  public static setClientId(clientId: string): void {
    if (clientId.trim()) {
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
    }
  }

  public static logout(): void {
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  /**
   * Load Google Identity Services SDK script dynamically
   */
  public static loadGsiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.accounts) {
        resolve();
        return;
      }
      const existingScript = document.getElementById('gsi-client-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.id = 'gsi-client-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  /**
   * Trigger real Google SSO popup login
   */
  public static async loginWithRealGoogleSso(customClientId?: string): Promise<GoogleUser> {
    await this.loadGsiScript();

    const clientId = customClientId || this.getClientId();

    return new Promise((resolve, reject) => {
      try {
        const google = (window as any).google;
        if (!google || !google.accounts || !google.accounts.oauth2) {
          reject(new Error('Google SSO SDK 載入失敗，請檢查網路連線。'));
          return;
        }

        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid profile email https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
          callback: async (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error || 'Google SSO 授權取消或失敗'));
              return;
            }
            if (response.access_token) {
              try {
                // Fetch real user profile from Google UserInfo API
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: {
                    Authorization: `Bearer ${response.access_token}`,
                  },
                });
                if (!userRes.ok) {
                  throw new Error(`無法取得 Google UserInfo (${userRes.status})`);
                }
                const profile = await userRes.json();
                const realUser: GoogleUser = {
                  id: profile.sub || `google-${Date.now()}`,
                  name: profile.name || profile.email?.split('@')[0] || 'Google 使用者',
                  email: profile.email || '',
                  picture: profile.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.name || 'user')}`,
                  accessToken: response.access_token,
                };

                GoogleAuthManager.setUser(realUser);
                resolve(realUser);
              } catch (err: any) {
                reject(new Error(`取得 Google 個人檔案失敗: ${err.message}`));
              }
            }
          },
          onerror: (err: any) => {
            reject(new Error(err?.message || 'Google SSO 登入發生錯誤'));
          },
        });

        // Prompt Google Account Selection SSO popup
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        reject(err);
      }
    });
  }
}
