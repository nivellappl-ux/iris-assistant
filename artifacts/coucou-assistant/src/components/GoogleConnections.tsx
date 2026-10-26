import { useEffect, useState } from 'react';
import { Check, CircleUserRound, Link2, Unplug, X } from 'lucide-react';

type GoogleApp = 'gmail' | 'calendar';
type GoogleConnection = { accessToken: string; email: string; expiresAt: number };

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(options: {
            client_id: string;
            scope: string;
            callback(response: GoogleTokenResponse): void;
            error_callback?(error: { type?: string }): void;
          }): GoogleTokenClient;
          revoke(token: string, callback?: () => void): void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`);
    const script = existing ?? document.createElement('script');
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleScriptPromise = null;
      reject(new Error('Não foi possível preparar a ligação Google.'));
    };
    if (!existing) document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function GoogleAppIcon({ app }: { app: GoogleApp }) {
  const iconFile = app === 'gmail' ? 'gmail_48dp.png' : 'calendar_48dp.png';
  const title = app === 'gmail' ? 'Gmail' : 'Google Calendar';
  return <img src={`${import.meta.env.BASE_URL}google/${iconFile}`} alt="" aria-label={title} />;
}

const APP_DETAILS: Record<GoogleApp, { title: string; permission: string; scope: string; verifyUrl: string; emailFrom: (data: unknown) => string }> = {
  gmail: {
    title: 'Gmail',
    permission: 'Ler e enviar mensagens',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    verifyUrl: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    emailFrom: (data) => (data as { emailAddress?: string }).emailAddress ?? '',
  },
  calendar: {
    title: 'Google Calendar',
    permission: 'Consultar, criar e editar compromissos',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    verifyUrl: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
    emailFrom: () => '',
  },
};

export function GoogleConnections() {
  const [connections, setConnections] = useState<Partial<Record<GoogleApp, GoogleConnection>>>({});
  const [pending, setPending] = useState<GoogleApp | null>(null);
  const [error, setError] = useState('');
  const [identityReady, setIdentityReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    void loadGoogleIdentity()
      .then(() => setIdentityReady(true))
      .catch(() => setError('A ligação ainda não está configurada.'));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setConnections((current) => Object.fromEntries(
        Object.entries(current).filter(([, value]) => value && value.expiresAt > Date.now()),
      ) as Partial<Record<GoogleApp, GoogleConnection>>);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const connect = (app: GoogleApp) => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts.oauth2) {
      setError('A ligação ainda não está configurada.');
      return;
    }
    setError('');
    setPending(app);
    const details = APP_DETAILS[app];
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: `openid email ${details.scope}`,
      callback: (response) => {
        if (!response.access_token) {
          setPending(null);
          setError('Não foi possível autorizar a conta. Tenta novamente.');
          return;
        }
        void fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        })
          .then(async (identityResponse) => {
            if (!identityResponse.ok) throw new Error('identity');
            const identity = await identityResponse.json() as { email?: string };
            return identity.email ?? '';
          })
          .then(async (email) => {
            const verifyResponse = await fetch(details.verifyUrl, {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (!verifyResponse.ok) throw new Error('scope');
            if (!email) {
              const serviceData: unknown = await verifyResponse.json();
              const serviceEmail = details.emailFrom(serviceData);
              if (serviceEmail && serviceEmail.includes('@')) {
                setConnections((current) => ({
                  ...current,
                  [app]: { accessToken: response.access_token!, email: serviceEmail, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 },
                }));
                setPending(null);
                return;
              }
            }
            setConnections((current) => ({
              ...current,
              [app]: { accessToken: response.access_token!, email, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 },
            }));
            setPending(null);
          })
          .catch(() => {
            window.google?.accounts.oauth2.revoke(response.access_token!, () => undefined);
            setPending(null);
            setError('A conta não autorizou as permissões necessárias.');
          });
      },
      error_callback: () => {
        setPending(null);
        setError('A ligação foi cancelada. Podes tentar novamente.');
      },
    });
    client.requestAccessToken({ prompt: 'consent select_account' });
  };

  const disconnect = (app: GoogleApp) => {
    const connection = connections[app];
    if (connection && window.google?.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(connection.accessToken, () => undefined);
    }
    setConnections((current) => {
      const next = { ...current };
      delete next[app];
      return next;
    });
  };

  return (
    <div className="iris-google-launcher">
      <span className="iris-google-avatar" aria-hidden="true"><CircleUserRound /></span>
      <div className="iris-google-launcher-main">
        <button className="iris-google-launcher-button" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span>Conectar aplicativos</span>
          <span className="iris-google-launcher-icons" aria-hidden="true">
            <span className="iris-google-mini-gmail"><GoogleAppIcon app="gmail" /></span>
            <span className="iris-google-mini-calendar"><GoogleAppIcon app="calendar" /></span>
          </span>
        </button>
        {open && (
          <div className="iris-google-popover" aria-label="Conectar contas Google">
            <div className="iris-google-popover-head">
              <strong>Conectar aplicativos</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X /></button>
            </div>
            {!GOOGLE_CLIENT_ID && <p className="iris-google-note">A configuração de ligação ainda está pendente.</p>}
            {Object.entries(APP_DETAILS).map(([appName, details]) => {
              const app = appName as GoogleApp;
              const connection = connections[app];
              return (
                <div className="iris-google-app" key={app}>
                  <span className={`iris-google-app-icon is-${app}`}><GoogleAppIcon app={app} /></span>
                  <span className="iris-google-app-copy">
                    <strong>{details.title}</strong>
                    <small>{connection ? connection.email : details.permission}</small>
                  </span>
                  {connection ? (
                    <button className="iris-google-connected" type="button" onClick={() => disconnect(app)} aria-label={`Desligar ${details.title}`}>
                      <Check /><span>Ligado</span><Unplug />
                    </button>
                  ) : (
                    <button className="iris-secondary-button iris-google-connect" type="button" disabled={!identityReady || pending !== null} onClick={() => connect(app)}>
                      {pending === app ? 'A ligar…' : <><Link2 />Conectar</>}
                    </button>
                  )}
                </div>
              );
            })}
            <p className="iris-google-note">A autorização fica apenas nesta sessão. Ao fechar ou atualizar a IRIS, será necessário conectar novamente.</p>
            {error && <p className="iris-google-error" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
