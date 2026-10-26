import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, MessageCircle, Mic, MicOff, MoreHorizontal, Radio, Send, Settings, Volume2, X } from 'lucide-react';
import { VOICE_STATE_LABELS, type IrisVoiceState } from '../core/voice';
import type { AppSection } from '../core/irisTypes';
import type { BotStateName } from '../core/layout';
import { BotEngine } from '../mochi/engine';
import { MochiCanvas } from './MochiCanvas';

type IslandView = 'home' | 'chat' | 'menu' | 'history';

interface IRISIslandProps {
  desktopMode: boolean;
  mochiState: BotStateName;
  voiceActive: boolean;
  voiceMuted: boolean;
  voiceState: IrisVoiceState;
  voiceNotice: string;
  wakeWordArmed: boolean;
  onNavigate: (section: AppSection) => void;
  onSendChat: (text: string) => void;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onToggleWakeWord: () => void;
  onNewConversation: () => void;
  onVoiceSettings: () => void;
  voiceTranscript: string;
  voiceCaption: string;
  captionsEnabled: boolean;
  onToggleCaptions: () => void;
  mascotAnimationEnabled: boolean;
}

const BOT_STATE_LABELS: Partial<Record<BotStateName, string>> = {
  idle: 'Por perto',
  listening: 'À escuta',
  working: 'A trabalhar',
  thinking: 'A pensar',
  speaking: 'A falar',
  searching: 'A procurar',
  approval: 'À espera de confirmação',
  question: 'A ouvir',
  error: 'Algo correu mal',
  finished: 'Feito',
  ratelimit: 'A fazer uma pausa',
  sleeping: 'À espera da palavra',
  dizzy: 'A recuperar',
};

const VOICE_BUBBLE_COPY: Record<IrisVoiceState, string> = {
  idle: 'Olá. Estou por aqui quando precisares.',
  listening: 'Estou à escuta. Podes falar.',
  thinking: 'Deixa-me pensar nisso.',
  speaking: 'Estou a falar contigo.',
  happy: 'Feito. Continuamos quando quiseres.',
  confused: 'Não percebi bem. Podes tentar outra vez?',
  error: 'A voz encontrou um problema. Podes tentar novamente.',
  sleeping: 'Diz “Acorda IRIS” para começar.',
};

const BOT_BUBBLE_COPY: Partial<Record<BotStateName, string>> = {
  finished: 'Está feito. Estou aqui se precisares.',
  approval: 'Preciso da tua confirmação antes de continuar.',
  question: 'Podes dar-me mais um pouco de contexto?',
  error: 'Algo não correu como esperado. Podes tentar novamente.',
  ratelimit: 'Vou fazer uma pausa breve antes de continuar.',
};

export function IRISIsland({
  desktopMode,
  mochiState,
  voiceActive,
  voiceMuted,
  voiceState,
  voiceNotice,
  wakeWordArmed,
  onNavigate,
  onSendChat,
  onToggleVoice,
  onToggleMute,
  onToggleWakeWord,
  onNewConversation,
  onVoiceSettings,
  voiceTranscript,
  voiceCaption,
  captionsEnabled,
  onToggleCaptions,
  mascotAnimationEnabled,
}: IRISIslandProps) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [view, setView] = useState<IslandView>('home');
  const [chatText, setChatText] = useState('');
  const [engine] = useState(() => new BotEngine());
  const islandRef = useRef<HTMLDivElement>(null);
  const voiceWasActiveRef = useRef(voiceActive);

  const closePanel = () => {
    setExpanded(false);
    setPinned(false);
    setView('home');
  };

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        setPinned(false);
        setView('home');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  useEffect(() => {
    if (voiceActive) {
      setView('home');
      setPinned(true);
      setExpanded(true);
    } else if (voiceWasActiveRef.current) {
      closePanel();
    }
    voiceWasActiveRef.current = voiceActive;
  }, [voiceActive]);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!islandRef.current?.contains(event.target as Node)) closePanel();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  useEffect(() => {
    if (!desktopMode) return;
    const height = !expanded ? 68 : view === 'chat' ? 320 : view === 'menu' || view === 'history' ? 330 : 300;
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow, LogicalSize }) => getCurrentWindow().setSize(new LogicalSize(390, height)))
      .catch((error: unknown) => console.error('Não foi possível ajustar a janela da IRIS.', error));
  }, [desktopMode, expanded, view]);

  const submitChat = (event: FormEvent) => {
    event.preventDefault();
    const message = chatText.trim();
    if (!message) return;
    onSendChat(message);
    setChatText('');
  };

  const showMenu = () => {
    setView(view === 'menu' ? 'home' : 'menu');
    setPinned(true);
    setExpanded(true);
  };

  const listeningInBackground = wakeWordArmed && voiceState === 'idle';
  const stateKey: IrisVoiceState | BotStateName = listeningInBackground ? 'sleeping' : voiceState === 'idle' ? mochiState : voiceState;
  const statusLabel = listeningInBackground
    ? VOICE_STATE_LABELS.sleeping
    : voiceState !== 'idle'
      ? VOICE_STATE_LABELS[voiceState]
      : BOT_STATE_LABELS[mochiState] ?? 'Por perto';
  const bubbleCopy = listeningInBackground
    ? VOICE_BUBBLE_COPY.sleeping
    : voiceState !== 'idle'
      ? VOICE_BUBBLE_COPY[voiceState]
      : BOT_BUBBLE_COPY[mochiState] ?? VOICE_BUBBLE_COPY.idle;
  const hasLiveVoiceState = stateKey === 'listening' || stateKey === 'thinking' || stateKey === 'speaking';
  const isNotice = Boolean(voiceNotice) && !hasLiveVoiceState && stateKey !== 'happy' && stateKey !== 'finished' && stateKey !== 'error';

  return (
    <div
      ref={islandRef}
      className={`iris-island${desktopMode ? ' is-native' : ''}${expanded ? ' is-expanded' : ''}`}
      data-testid="dynamic-island"
      data-state={stateKey}
      onMouseEnter={() => {
        if (!pinned) setExpanded(true);
      }}
      onMouseLeave={() => {
        if (!pinned) setExpanded(false);
      }}
    >
      <button
        className="iris-island-trigger"
        type="button"
        aria-expanded={expanded}
        aria-controls="iris-island-panel"
        aria-label={expanded ? 'Fechar o painel da IRIS' : 'Abrir o painel da IRIS'}
        onClick={showMenu}
        data-testid="button-toggle-dynamic-island"
      >
        <span className="iris-island-mochi" aria-hidden="true">
          <MochiCanvas state={mochiState} size={48} engine={engine} animated={mascotAnimationEnabled} />
        </span>
        <span className="iris-island-name">
          <strong>IRIS</strong>
          <span data-testid="status-dynamic-island">{statusLabel}</span>
        </span>
        <span className={`iris-island-presence is-${stateKey}`} aria-hidden="true">
          <i /><i /><i />
        </span>
        <ChevronDown className={`iris-island-chevron${expanded ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <button className="iris-island-menu-trigger" type="button" onClick={showMenu} aria-label="Abrir menu da IRIS" aria-expanded={expanded && view === 'menu'}>
        <MoreHorizontal />
      </button>

      {expanded && (
        <section className="iris-island-panel" id="iris-island-panel" aria-label="Conversa e estado da IRIS">
          <div className="iris-island-panel-head">
            <span className="iris-island-mode">
              <span className={`iris-status-dot is-${stateKey}`} />
              {isNotice ? 'AVISO DA IRIS' : statusLabel.toLocaleUpperCase('pt-PT')}
            </span>
            <div className="iris-island-tools">
              <button
                className={`iris-island-voice${voiceState !== 'idle' ? ` is-${voiceState}` : ''}`}
                type="button"
                onClick={onToggleVoice}
                aria-pressed={voiceActive}
                aria-label={voiceActive ? 'Desativar comando de voz' : 'Ativar comando de voz'}
                data-testid="button-toggle-island-voice"
              >
                {voiceActive ? <Mic /> : <MicOff />}
                <span>{voiceActive ? 'Voz ativa' : 'Ativar voz'}</span>
              </button>
              <button
                className={`iris-island-wake${wakeWordArmed ? ' is-armed' : ''}`}
                type="button"
                onClick={onToggleWakeWord}
                aria-pressed={wakeWordArmed}
                aria-label={wakeWordArmed ? 'Desativar Acorda IRIS' : 'Ativar Acorda IRIS'}
                title={wakeWordArmed ? 'À espera de “Acorda IRIS” ou “Wake up Iris”' : 'Ativar palavra de despertar'}
                data-testid="button-toggle-wake-word"
              >
                <Radio />
                <span>{wakeWordArmed ? 'Acorda' : 'Wake'}</span>
              </button>
              <button className="iris-island-close" type="button" onClick={closePanel} aria-label="Fechar painel" data-testid="button-close-island">
                <X />
              </button>
            </div>
          </div>

          {view === 'menu' ? (
            <nav className="iris-island-menu" aria-label="Menu da IRIS">
              <button type="button" onClick={() => { onNewConversation(); closePanel(); }}><MessageCircle />Nova conversa</button>
              <button type="button" onClick={() => { setView('history'); onNavigate('chat'); }}><Volume2 />Histórico</button>
              <button type="button" onClick={() => { onNavigate('home'); closePanel(); }}>Hoje</button>
              <button type="button" onClick={() => { onNavigate('settings'); closePanel(); }}>Definições</button>
              <button type="button" onClick={() => { onNavigate('help'); closePanel(); }}>Ajuda</button>
            </nav>
          ) : view === 'history' ? (
            <div className="iris-island-view">
              <div className="iris-island-view-title"><strong>Histórico</strong><button type="button" onClick={() => setView('menu')}>Voltar</button></div>
              <button className="iris-history-item" type="button" onClick={() => { setView('home'); onNavigate('chat'); }}>
                <span>Conversa guardada</span><small>Neste dispositivo</small>
              </button>
            </div>
          ) : view === 'chat' ? (
            <div className="iris-island-view iris-island-chat">
              <div className="iris-island-view-title">
                <strong>Conversar com a IRIS</strong>
                <button type="button" onClick={() => setView('home')}>Voltar</button>
              </div>
              <p className="iris-island-copy">Fala com a IRIS para fazer perguntas e pedir ajuda.</p>
              <form className="iris-island-form" onSubmit={submitChat}>
                <input
                  autoFocus
                  value={chatText}
                  onChange={(event) => setChatText(event.target.value)}
                  placeholder="Escreve à IRIS…"
                  aria-label="Mensagem para a IRIS"
                  data-testid="input-island-chat"
                />
                <button type="submit" aria-label="Enviar mensagem" data-testid="button-send-island-chat"><Send /></button>
              </form>
            </div>
          ) : (
            <div className="iris-island-view">
              {voiceActive && (
                <div className="iris-island-voice-panel">
                  <div className="iris-voice-level" aria-label="Indicador de nível indisponível nesta sessão"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
                  <button type="button" aria-label="Definições de voz" onClick={onVoiceSettings}><Settings /></button>
                  <button type="button" role="switch" aria-checked={captionsEnabled} aria-label="Legendas em direto" onClick={onToggleCaptions}>CC</button>
                  <button type="button" aria-label={voiceMuted ? 'Ativar microfone' : 'Silenciar microfone'} aria-pressed={!voiceMuted} onClick={onToggleMute}>{voiceMuted ? <MicOff /> : <Mic />}</button>
                  <button className="iris-voice-end" type="button" aria-label="Terminar sessão de voz" onClick={onToggleVoice}><X /></button>
                </div>
              )}
              <div
                className={`iris-island-speech${isNotice ? ' is-notice' : ''}`}
                data-kind={isNotice ? 'notice' : stateKey}
                role="status"
                aria-live="polite"
                data-testid="speech-bubble-island"
              >
                <span className="iris-island-speech-mark" aria-hidden="true"><MessageCircle /></span>
                <span className="iris-island-speech-copy">
                  <span className="iris-island-speech-label">{isNotice ? 'AVISO DA IRIS' : statusLabel}</span>
                  <span className="iris-island-speech-text">{voiceTranscript || voiceNotice || bubbleCopy}</span>
                </span>
              </div>
              {voiceActive && captionsEnabled && (voiceTranscript || voiceCaption) && (
                <p className="iris-live-caption" aria-live="polite">
                  {[voiceTranscript, voiceCaption].filter(Boolean).join('\n')}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
