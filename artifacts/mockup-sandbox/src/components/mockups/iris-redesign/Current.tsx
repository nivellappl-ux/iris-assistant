import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  Activity, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleHelp, Command,
  ListTodo, MessageCircle, MicOff, MoreHorizontal, Settings, X,
} from 'lucide-react';
import './_group.css';

type Task = { id: string; title: string; done: boolean; createdAt: number };
type Message = { id: string; role: 'assistant' | 'user'; text: string; time: number };

const initialTasks: Task[] = [
  { id: 'seed-1', title: 'Rever o relatório de março', done: false, createdAt: Date.now() - 3600000 },
  { id: 'seed-2', title: 'Preparar notas para a reunião', done: false, createdAt: Date.now() - 7200000 },
  { id: 'seed-3', title: 'Enviar a proposta à Leonor', done: true, createdAt: Date.now() - 86400000 },
];

function shortTime(time: number) {
  return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' }).format(new Date(time));
}

function MochiCanvas({ size = 140 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    context.scale(dpr, dpr);
    const x = size / 2;
    const y = size / 2 + size * .02;
    const r = size * .3;
    const body = context.createRadialGradient(x + r * .3, y - r * .45, 2, x, y, r * 1.7);
    body.addColorStop(0, '#f6f6f7');
    body.addColorStop(1, '#bfc2c9');
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(x, y, r * 1.14, r * .92, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1a1412';
    context.beginPath();
    context.ellipse(x - r * .37, y - r * .12, r * .1, r * .14, 0, 0, Math.PI * 2);
    context.ellipse(x + r * .37, y - r * .12, r * .1, r * .14, 0, 0, Math.PI * 2);
    context.fill();
  }, [size]);
  return <div className="mochi-wrap" style={{ width: size, height: size }} title="IRIS"><canvas ref={canvasRef} className="mochi-canvas" style={{ width: size, height: size }} aria-label="IRIS, a personagem da app" /></div>;
}

function DynamicIsland({ tasks, onToggleTask, onAddTask, onOpen }: {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onAddTask: (title: string) => boolean;
  onOpen: (section: 'tasks' | 'chat') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const openCount = tasks.filter((task) => !task.done).length;
  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (onAddTask(taskInput)) setTaskInput('');
  };
  return (
    <div className="dynamic-island" data-expanded={expanded} data-testid="dynamic-island">
      <button className="dynamic-island-trigger" type="button" aria-expanded={expanded} aria-controls="dynamic-island-panel" aria-label={expanded ? 'Fechar a ilha dinâmica da IRIS' : 'Abrir a ilha dinâmica da IRIS'} onClick={() => setExpanded((current) => !current)}>
        <span className="dynamic-island-avatar" aria-hidden="true"><MochiCanvas size={44} /></span>
        <span className="dynamic-island-label"><strong>IRIS</strong><span>{openCount ? `${openCount} tarefas pendentes` : 'Pronta para ajudar'}</span></span>
        <span className={`dynamic-island-count${openCount ? ' has-pending' : ''}`} aria-label={`${openCount} tarefas pendentes`}>{openCount}</span>
        <ChevronDown className={`dynamic-island-chevron${expanded ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      {expanded && <div className="dynamic-island-panel" id="dynamic-island-panel" data-testid="dynamic-island-panel">
        <div className="dynamic-island-panel-head">
          <span className="dynamic-island-mode"><span className="dynamic-island-live" />MODO ILHA · PRÉ-VISUALIZAÇÃO</span>
          <div className="dynamic-island-panel-tools">
            <button className="dynamic-island-voice-toggle" type="button" aria-label="Ativar comando de voz" title="Comando de voz desativado nesta pré-visualização"><MicOff /><span>Voz</span></button>
            <button className="dynamic-island-close" type="button" onClick={() => setExpanded(false)} aria-label="Fechar painel"><X /></button>
          </div>
        </div>
        <strong className="dynamic-island-panel-title">{openCount ? `Tens ${openCount} tarefas pendentes.` : 'A IRIS está por aqui.'}</strong>
        <p className="dynamic-island-panel-copy">{openCount ? 'Organiza as tarefas ou conversa com a IRIS para decidir o próximo passo.' : 'Guarda uma tarefa ou conversa com a IRIS quando precisares.'}</p>
        <div className="dynamic-island-actions">
          <button type="button" onClick={() => onOpen('chat')}><MessageCircle />Conversar</button>
          <button type="button" onClick={() => onOpen('tasks')}><ListTodo />Tarefas</button>
        </div>
        <p className="dynamic-island-boundary">A escuta só fica ativa quando a ligas. A pré-visualização não aparece sobre outras aplicações.</p>
      </div>}
    </div>
  );
}

export function Current() {
  const [tasks, setTasks] = useState(initialTasks);
  const openCount = tasks.filter((task) => !task.done).length;
  const doneCount = tasks.length - openCount;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const messages: Message[] = useMemo(() => [{ id: 'welcome', role: 'assistant', text: 'Olá. Estou por aqui para guardar tarefas e ajudar a manter o dia em ordem.', time: Date.now() }], []);
  const activityItems = [
    ...tasks.slice(0, 2).map((task) => ({ id: task.id, text: task.done ? `Concluíste “${task.title}”` : `Guardaste “${task.title}”`, time: task.createdAt, done: task.done })),
    ...messages.slice(-1).map((message) => ({ id: message.id, text: message.role === 'user' ? 'Iniciaste uma conversa com a IRIS' : 'A IRIS respondeu na conversa', time: message.time, done: false })),
  ].sort((a, b) => b.time - a.time).slice(0, 3);
  const today = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const addTask = (rawTitle: string) => {
    const title = rawTitle.trim().replace(/[.!?]+$/, '');
    if (!title) return false;
    setTasks((current) => [{ id: crypto.randomUUID(), title, done: false, createdAt: Date.now() }, ...current]);
    return true;
  };
  const toggleTask = (id: string) => setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));

  return (
    <div className="iris-current">
      <div className="app-shell">
        <DynamicIsland tasks={tasks} onToggleTask={toggleTask} onAddTask={addTask} onOpen={() => undefined} />
        <aside className="sidebar">
          <div className="brand"><div className="brand-mark"><Command size={18} strokeWidth={2} /></div><div><div className="brand-name">IRIS</div><div className="brand-caption">assistente pessoal</div></div></div>
          <div className="nav-label">O teu espaço</div>
          <nav className="nav-list" aria-label="Navegação principal">
            {([
              ['overview', 'Visão geral', Activity], ['tasks', 'Tarefas', ListTodo], ['chat', 'Conversar', MessageCircle], ['settings', 'Definições', Settings], ['help', 'Ajuda', CircleHelp],
            ] as const).map(([id, label, Icon]) => <button className={`nav-item${id === 'overview' ? ' active' : ''}`} key={id}><Icon />{label}{id === 'tasks' && <span className="nav-count">{openCount}</span>}</button>)}
          </nav>
          <div className="sidebar-foot">
            <div className="preview-note"><div className="preview-title"><span className="preview-dot" />Modo de pré-visualização</div><div className="preview-text">A app desktop está configurada como janela flutuante; esta página funciona apenas no navegador.</div></div>
            <div className="profile"><div className="avatar">IR</div><div><div className="profile-name">Perfil local</div><div className="profile-caption">Neste dispositivo</div></div></div>
          </div>
        </aside>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb"><span>IRIS</span><span>/</span><strong>Visão geral</strong></div>
            <div className="top-actions"><button className="icon-button mobile-menu" aria-label="Alternar vista"><MoreHorizontal /></button><button className="icon-button" aria-label="Abrir ajuda"><CircleHelp /></button><button className="icon-button" aria-label="Abrir definições"><Settings /></button></div>
          </header>
          <div className="main-content">
            <div className="page-head"><div><div className="eyebrow">O teu canto tranquilo</div><h1 className="page-title">O teu dia, ao teu ritmo.</h1><p className="page-subtitle">Um passo de cada vez. A IRIS está contigo.</p></div><div className="date-pill">{today}</div></div>
            <div className="dashboard-grid">
              <section className="island-card" aria-label="Pré-visualização da IRIS">
                <div className="island-top"><div className="island-tag"><span className="live-mark" />PRÉ-VISUALIZAÇÃO · PAINEL</div><button className="island-toggle">Abrir conversa <ArrowUpRight size={12} /></button></div>
                <div className="island-content"><MochiCanvas /><div className="island-copy"><div className="island-kicker">A tua companheira de foco</div><div className="island-greeting">A IRIS está aqui.</div><div className="island-desc">Guarda uma ideia, organiza o dia ou pede à IRIS para concluir uma tarefa.</div></div></div>
                <div className="island-bottom"><div className="island-state"><span className="state-pip" />Pronta para ajudar</div><div className="island-hint">clica na IRIS para cumprimentar</div></div>
              </section>
              <div className="side-stack">
                <section className="summary-card">
                  <div className="summary-head"><div className="summary-title">O teu ritmo</div><div className="tiny-label">HOJE</div></div>
                  <div className="progress-ring-row"><div className="progress-ring" style={{ '--progress': `${progress}%` } as CSSProperties}><div className="progress-value">{progress}%</div></div><div className="progress-copy"><strong>{doneCount} de {tasks.length} concluídas</strong>Vai ao teu ritmo. Cada passo conta.</div></div>
                  <div className="mini-stat-row"><div className="mini-stat"><strong>{openCount}</strong>por tratar</div><div className="mini-stat"><strong>{doneCount}</strong>feitas</div></div>
                </section>
                <section className="summary-card"><div className="summary-head"><div className="summary-title">Atividade recente</div><div className="tiny-label">LOCAL</div></div><div className="activity-card">{activityItems.map((item) => <div className="activity-item" key={item.id}><div className="activity-icon">{item.done ? <CheckCheck /> : <Activity />}</div><div className="activity-text">{item.text}<span className="activity-time">{shortTime(item.time)}</span></div></div>)}</div></section>
              </div>
            </div>
            <div className="section-row"><h2 className="section-title">A seguir</h2><button className="text-action">Ver todas as tarefas</button></div>
            <div className="task-list">{tasks.filter((task) => !task.done).slice(0, 3).map((task) => <div className="task-row" key={task.id}><button className="task-check" onClick={() => toggleTask(task.id)} aria-label="Concluir tarefa"><Check /></button><div className="task-main"><div className="task-title">{task.title}</div><div className="task-meta">Adicionada às · {shortTime(task.createdAt)}</div></div></div>)}{openCount === 0 && <div className="empty-tasks"><strong>Lista em paz.</strong>Não há nada pendente por agora.</div>}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Current;