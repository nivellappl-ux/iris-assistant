import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Archive, BookOpen, Check, ChevronDown, CircleHelp,
  Clock3, Command, FileText, Flag, Folder, FolderPlus, Inbox, LayoutDashboard,
  Lightbulb, ListTodo, MessageCircle, Pause, Play, Plus, RotateCcw, Search,
  Send, Settings, StickyNote, Target, Timer, X, Zap,
} from 'lucide-react';
import './redesign.css';

type Page = 'home' | 'inbox' | 'tasks' | 'projects' | 'focus' | 'chat' | 'settings';
type Task = { id: string; title: string; due: string; time: string; priority: 'Alta' | 'Normal' | 'Baixa'; done: boolean; project: string };
type InboxItem = { id: string; title: string; body: string; kind: 'Nota' | 'Ideia' | 'Referência' | 'Documento'; date: string };
type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string };

const initialTasks: Task[] = [
  { id: 't1', title: 'Enviar a proposta à Leonor', due: 'Hoje', time: '09:30', priority: 'Alta', done: false, project: 'Trabalho' },
  { id: 't2', title: 'Rever o relatório de março', due: 'Hoje', time: '11:00', priority: 'Normal', done: false, project: 'Trabalho' },
  { id: 't3', title: 'Preparar notas para a reunião', due: 'Hoje', time: '14:30', priority: 'Normal', done: false, project: 'Pessoal' },
  { id: 't4', title: 'Marcar consulta de rotina', due: 'Hoje', time: '—', priority: 'Baixa', done: false, project: 'Pessoal' },
  { id: 't5', title: 'Renovar o domínio do portefólio', due: 'Ontem', time: '—', priority: 'Alta', done: false, project: 'Pessoal' },
  { id: 't6', title: 'Organizar recibos de abril', due: 'Ontem', time: '—', priority: 'Normal', done: false, project: 'Pessoal' },
  { id: 't7', title: 'Confirmar sala para a sessão', due: 'Hoje', time: '08:45', priority: 'Baixa', done: true, project: 'Trabalho' },
];
const initialInbox: InboxItem[] = [
  { id: 'i1', title: 'Ideias para o fim de semana', body: 'Levar a câmara até à costa e experimentar o trilho novo.', kind: 'Ideia', date: 'Hoje, 08:12' },
  { id: 'i2', title: 'Livro — A vida secreta das árvores', body: 'Lembrar de procurar a edição ilustrada.', kind: 'Referência', date: 'Ontem' },
  { id: 'i3', title: 'Notas da conversa com a equipa', body: 'Simplificar a primeira entrada. Rever os nomes dos projetos.', kind: 'Nota', date: '12 mai' },
  { id: 'i4', title: 'Recibo cowork · abril.pdf', body: 'Documento guardado neste dispositivo.', kind: 'Documento', date: '10 mai' },
];
const iconForType = { Nota: StickyNote, Ideia: Lightbulb, Referência: BookOpen, Documento: FileText };
const pageInfo: Record<Page, { label: string; title: string; subtitle: string }> = {
  home: { label: 'Início', title: 'O teu dia, ao teu ritmo.', subtitle: 'Um lugar tranquilo para pôr as ideias em ordem.' },
  inbox: { label: 'Caixa de entrada', title: 'Tudo o que guardaste.', subtitle: 'Notas, ideias e referências — sem pressa de organizar.' },
  tasks: { label: 'Tarefas', title: 'A lista, sem ruído.', subtitle: 'O que importa agora, e o que pode esperar.' },
  projects: { label: 'Projetos', title: 'Os teus contextos.', subtitle: 'Agrupa tarefas e notas pelo que estás a viver.' },
  focus: { label: 'Foco', title: 'Um intervalo para ti.', subtitle: 'Quarenta e cinco minutos. Uma coisa de cada vez.' },
  chat: { label: 'Conversar', title: 'Fala com a IRIS.', subtitle: 'Comandos locais para manter o teu espaço em ordem.' },
  settings: { label: 'Definições', title: 'O teu espaço, à tua maneira.', subtitle: 'Privado por natureza. Ajusta só o que precisares.' },
};
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export function Redesign() {
  const [page, setPage] = useState<Page>('home');
  const [tasks, setTasks] = useState(initialTasks);
  const [inbox, setInbox] = useState(initialInbox);
  const [projects, setProjects] = useState(['Trabalho', 'Pessoal', 'Leituras']);
  const [selectedProject, setSelectedProject] = useState('Todos');
  const [taskDraft, setTaskDraft] = useState('');
  const [taskDue, setTaskDue] = useState('Hoje');
  const [taskTime, setTaskTime] = useState('—');
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('Normal');
  const [filter, setFilter] = useState<'Todas' | 'Por fazer' | 'Concluídas'>('Todas');
  const [inboxFilter, setInboxFilter] = useState<InboxItem['kind'] | 'Tudo'>('Tudo');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureType, setCaptureType] = useState<'Tarefa' | 'Nota'>('Tarefa');
  const [captureText, setCaptureText] = useState('');
  const [islandOpen, setIslandOpen] = useState(false);
  const [mochiState, setMochiState] = useState('Pronta para ajudar');
  const [focusSeconds, setFocusSeconds] = useState(45 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 1, role: 'assistant', text: 'Olá. Posso guardar uma tarefa, mostrar o que tens por fazer ou concluir algo por ti. Tudo acontece aqui, no teu dispositivo.' }]);
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState({ notifications: true, sound: false, startPage: true });
  const info = pageInfo[page];
  const openTasks = tasks.filter((task) => !task.done);
  const overdue = openTasks.filter((task) => task.due === 'Ontem');
  const todayTasks = openTasks.filter((task) => task.due === 'Hoje').sort((a, b) => a.time.localeCompare(b.time));
  const pendingCount = openTasks.length;
  const islandStatus = focusRunning ? 'A focar contigo' : overdue.length ? 'Tens tarefas por rever' : mochiState;
  const todayLabel = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => setFocusSeconds((remaining) => {
      if (remaining <= 1) {
        window.clearInterval(timer);
        setFocusRunning(false);
        setMochiState('Sessão concluída');
        setToast('Boa. A tua sessão de foco terminou.');
        return 0;
      }
      return remaining - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2300);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const addTask = (
    title: string,
    project = selectedProject === 'Todos' ? 'Pessoal' : selectedProject,
    due = 'Hoje',
    time = '—',
    priority: Task['priority'] = 'Normal',
  ) => {
    const clean = title.trim();
    if (!clean) return false;
    setTasks((current) => [{ id: `task-${Date.now()}`, title: clean, due, time, priority, done: false, project }, ...current]);
    setMochiState('Guardado com sucesso');
    setToast('Tarefa guardada.');
    return true;
  };
  const toggleTask = (id: string) => {
    const task = tasks.find((item) => item.id === id);
    setTasks((current) => current.map((item) => item.id === id ? { ...item, done: !item.done } : item));
    setMochiState(task && !task.done ? 'Muito bem, feito' : 'Pronta para ajudar');
  };
  const addProject = () => {
    const name = window.prompt('Nome do novo projeto');
    if (!name?.trim()) return;
    const clean = name.trim();
    if (projects.includes(clean)) {
      setSelectedProject(clean);
      return;
    }
    setProjects((current) => [...current, clean]);
    setSelectedProject(clean);
    setToast(`Projeto “${clean}” criado.`);
  };
  const captureSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!captureText.trim()) return;
    if (captureType === 'Tarefa') addTask(captureText);
    else {
      setInbox((current) => [{ id: `inbox-${Date.now()}`, title: captureText.trim(), body: 'Guardado agora, para voltares quando quiseres.', kind: 'Nota', date: 'Agora' }, ...current]);
      setMochiState('Guardado com sucesso');
      setToast('Nota guardada na caixa de entrada.');
    }
    setCaptureText('');
    setCaptureOpen(false);
  };
  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    const input = chatInput.trim();
    if (!input) return;
    const lower = input.toLocaleLowerCase('pt-PT');
    let reply = 'Ainda não tenho uma resposta para isso. Posso ajudar com tarefas locais: “adiciona tarefa preparar a reunião”, “mostra as tarefas” ou “conclui rever o relatório”.';
    const createMatch = input.match(/(?:adiciona|cria|regista|anota)(?:\s+uma)?\s+tarefa(?:\s+para)?\s+(.+)/i);
    if (createMatch?.[1]) {
      addTask(createMatch[1]);
      reply = `Fica guardado: “${createMatch[1].replace(/[.!?]+$/, '')}”.`;
    } else if (/\b(mostra|listar|lista|tenho|pendentes)\b/.test(lower) && /\b(tarefa|tarefas|lista)\b/.test(lower)) {
      reply = openTasks.length ? `Tens ${openTasks.length} tarefas por tratar:\n${openTasks.slice(0, 5).map((task) => `— ${task.title}`).join('\n')}` : 'Está tudo tratado. Não tens tarefas pendentes.';
    } else {
      const completeMatch = input.match(/(?:conclui|termina|fecha|feito)\s+(?:a\s+)?(?:tarefa\s+)?(.+)/i);
      if (completeMatch?.[1]) {
        const match = openTasks.find((task) => task.title.toLocaleLowerCase('pt-PT').includes(completeMatch[1].toLocaleLowerCase('pt-PT')));
        if (match) {
          toggleTask(match.id);
          reply = `Feito. Marquei “${match.title}” como concluída.`;
        } else reply = 'Não encontrei essa tarefa na tua lista.';
      }
    }
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: input }, { id: Date.now() + 1, role: 'assistant', text: reply }]);
    setChatInput('');
  };
  const visibleTasks = useMemo(() => tasks.filter((task) => (
    (filter === 'Todas' || (filter === 'Por fazer' ? !task.done : task.done))
    && (selectedProject === 'Todos' || task.project === selectedProject)
  )), [tasks, filter, selectedProject]);
  const nav = [
    ['home', 'Início', LayoutDashboard], ['inbox', 'Caixa de entrada', Inbox], ['tasks', 'Tarefas', ListTodo],
    ['projects', 'Projetos', Folder], ['focus', 'Foco', Target], ['chat', 'Conversar', MessageCircle], ['settings', 'Definições', Settings],
  ] as const;
  const taskRow = (task: Task, overdueRow = false) => (
    <div className={`iris-task-row${overdueRow ? ' iris-overdue' : ''}`} key={task.id}>
      <button type="button" className={`iris-check${task.done ? ' done' : ''}`} aria-label={task.done ? 'Reabrir tarefa' : 'Concluir tarefa'} onClick={() => toggleTask(task.id)}>{task.done && <Check />}</button>
      <div className="iris-task-copy">
        <div className={`iris-task-title${task.done ? ' done' : ''}`}>{task.title}</div>
        <div className="iris-task-meta"><span>{task.project}</span><span className="iris-priority"><Flag />{task.priority}</span></div>
      </div>
      <span className="iris-task-time">{task.time}</span>
    </div>
  );
  const renderHome = () => (
    <div className="iris-home-grid">
      <section className="iris-agenda">
        <div className="iris-agenda-section">
          <div className="iris-list-heading"><h2>Hoje</h2><span>{todayTasks.length} por fazer</span></div>
          {todayTasks.length ? todayTasks.map((task) => taskRow(task)) : <div className="iris-empty-inline">Um dia mais leve. Está tudo tratado.</div>}
        </div>
        <div className="iris-agenda-section">
          <div className="iris-list-heading"><h2>A seguir</h2><span>Próximas horas</span></div>
          {todayTasks.filter((task) => task.time !== '—').slice(0, 2).length
            ? todayTasks.filter((task) => task.time !== '—').slice(0, 2).map((task) => taskRow(task))
            : <div className="iris-empty-inline">Ainda não há nada agendado.</div>}
        </div>
        <div className="iris-agenda-section">
          <div className="iris-list-heading"><h2>Atrasadas</h2><span>{overdue.length} por resolver</span></div>
          {overdue.length ? overdue.map((task) => taskRow(task, true)) : <div className="iris-empty-inline">Sem tarefas em atraso.</div>}
        </div>
      </section>
      <aside className="iris-right-rail">
        <div className="iris-rail-section">
          <div className="iris-rail-title">Um pouco de foco <span>45 MIN</span></div>
          <div className="iris-focus-card">
            <div className="iris-focus-small"><Timer />Um bloco para ti</div>
            <div className="iris-focus-time">45:00</div>
            <div className="iris-focus-copy">Sem notificações. Sem pressa.</div>
            <button className="iris-focus-start" type="button" onClick={() => { setPage('focus'); setFocusRunning(true); }}><Play />Começar sessão</button>
          </div>
        </div>
        <div className="iris-rail-section">
          <div className="iris-rail-title">A IRIS está aqui</div>
          <div className="iris-mochi-note"><div className="iris-mochi" /><p><strong>Bom dia.</strong>Vamos com calma. Há {pendingCount} tarefas à tua espera.</p></div>
        </div>
        <div className="iris-rail-section">
          <div className="iris-rail-title">Pequenos passos <span>HOJE</span></div>
          <div className="iris-activity">
            <div className="iris-activity-item"><i className="iris-activity-dot" />A caixa de entrada está pronta para as tuas ideias.<small>AGORA</small></div>
            <div className="iris-activity-item"><i className="iris-activity-dot" />Última sessão de foco concluída.<small>ONTEM, 16:20</small></div>
          </div>
        </div>
      </aside>
    </div>
  );
  const renderTasks = () => (
    <section className="iris-section-panel">
      <div className="iris-toolbar">
        <div className="iris-filter-set">{(['Todas', 'Por fazer', 'Concluídas'] as const).map((item) => <button key={item} className={`iris-filter${filter === item ? ' active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <button className="iris-icon-button" type="button" aria-label="Pesquisar tarefas" onClick={() => setToast('A pesquisa local está pronta para demonstração.')}><Search /></button>
      </div>
      <form className="iris-add-form" onSubmit={(event) => { event.preventDefault(); if (addTask(taskDraft, selectedProject === 'Todos' ? 'Pessoal' : selectedProject, taskDue, taskTime, taskPriority)) setTaskDraft(''); }}>
        <input className="iris-input" value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} placeholder="Uma tarefa que queres tirar da cabeça…" aria-label="Nova tarefa" />
        <button className="iris-primary-button" type="submit"><Plus />Adicionar</button>
      </form>
      <div className="iris-task-extra">
        <select className="iris-select" aria-label="Data de vencimento" value={taskDue} onChange={(event) => setTaskDue(event.target.value)}><option value="Hoje">Hoje</option><option value="Amanhã">Amanhã</option><option value="Ontem">Ontem</option></select>
        <input className="iris-select" type="time" aria-label="Hora de vencimento" value={taskTime === '—' ? '' : taskTime} onChange={(event) => setTaskTime(event.target.value || '—')} />
        <select className="iris-select" aria-label="Prioridade" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task['priority'])}><option value="Normal">Prioridade normal</option><option value="Alta">Prioridade alta</option><option value="Baixa">Prioridade baixa</option></select>
        <select className="iris-select" aria-label="Projeto" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}><option>Todos</option>{projects.map((project) => <option key={project}>{project}</option>)}</select>
      </div>
      <div className="iris-filtered-list">{visibleTasks.length ? visibleTasks.map((task) => taskRow(task, task.due === 'Ontem')) : <div className="iris-empty-inline">Não há tarefas nesta vista.</div>}</div>
    </section>
  );
  const renderInbox = () => {
    const items = inbox.filter((item) => inboxFilter === 'Tudo' || item.kind === inboxFilter);
    return <section className="iris-section-panel">
      <div className="iris-inbox-tabs">{(['Tudo', 'Nota', 'Ideia', 'Referência', 'Documento'] as const).map((type) => <button key={type} className={`iris-inbox-tab${inboxFilter === type ? ' active' : ''}`} onClick={() => setInboxFilter(type)}>{type === 'Tudo' ? 'Tudo' : `${type}s`.replace('Documentos', 'Documentos').replace('Referências', 'Referências').replace('Notas', 'Notas').replace('Ideias', 'Ideias')}</button>)}</div>
      {items.map((item) => {
        const ItemIcon = iconForType[item.kind];
        return <article className="iris-inbox-item" key={item.id}><div className="iris-inbox-icon"><ItemIcon /></div><div><div className="iris-inbox-title">{item.title}</div><div className="iris-inbox-preview">{item.body}</div></div><span className="iris-inbox-date">{item.date}</span></article>;
      })}
      {!items.length && <div className="iris-empty-inline">Ainda não guardaste nada aqui.</div>}
    </section>;
  };
  const renderProjects = () => <section className="iris-section-panel">
    <div className="iris-toolbar"><div className="iris-filter-set"><button className={`iris-filter${selectedProject === 'Todos' ? ' active' : ''}`} onClick={() => setSelectedProject('Todos')}>Todos</button></div><button className="iris-primary-button" type="button" onClick={addProject}><FolderPlus />Novo projeto</button></div>
    <div className="iris-project-grid">{projects.map((project, index) => {
      const count = tasks.filter((task) => task.project === project && !task.done).length;
      const complete = tasks.filter((task) => task.project === project && task.done).length;
      const total = tasks.filter((task) => task.project === project).length;
      return <button type="button" key={project} className="iris-project-card" onClick={() => { setSelectedProject(project); setPage('tasks'); }}>
        <div className="iris-project-glyph"><Folder /></div><div><h3 className="iris-project-name">{project}</h3><div className="iris-project-info">{count} por fazer · {complete} concluídas</div><div className="iris-project-bar"><span style={{ width: `${total ? complete / total * 100 : index === 0 ? 42 : 18}%` }} /></div></div>
      </button>;
    })}</div>
  </section>;
  const renderFocus = () => <div className="iris-focus-page">
    <section className="iris-focus-center">
      <div className="iris-focus-orbit"><div><div className="iris-big-time">{formatTime(focusSeconds)}</div><div className="iris-focus-caption">{focusRunning ? 'A tua sessão está a decorrer' : focusSeconds === 0 ? 'Sessão concluída' : '45 minutos para uma coisa'}</div></div></div>
      <div className="iris-focus-controls">
        <button className="iris-round-control" type="button" aria-label="Reiniciar sessão" onClick={() => { setFocusRunning(false); setFocusSeconds(45 * 60); setMochiState('Pronta para ajudar'); }}><RotateCcw /></button>
        <button className="iris-round-control primary" type="button" aria-label={focusRunning ? 'Pausar sessão' : 'Iniciar sessão'} onClick={() => { if (!focusSeconds) setFocusSeconds(45 * 60); setFocusRunning((value) => !value); setMochiState(focusRunning ? 'Em pausa' : 'A focar contigo'); }}><>{focusRunning ? <Pause /> : <Play />}</></button>
        <button className="iris-round-control" type="button" aria-label="Reiniciar sessão" onClick={() => { setFocusRunning(false); setFocusSeconds(45 * 60); }}><Clock3 /></button>
      </div>
    </section>
    <aside>
      <div className="iris-eyebrow">Foco gentil</div><h2 className="iris-list-heading" style={{ margin: '0 0 16px' }}>O teu espaço, sem interrupções.</h2>
      <div className="iris-focus-context"><strong>Uma sessão de cada vez</strong><p>Escolhe uma tarefa, fecha o resto e deixa a IRIS acompanhar o tempo. A sessão é local e pode ser pausada quando quiseres.</p></div>
      <div className="iris-mochi-note"><div className="iris-mochi" /><p><strong>A IRIS fica por perto.</strong>Quando terminares, fazemos uma pausa.</p></div>
    </aside>
  </div>;
  const renderChat = () => <div className="iris-chat-layout">
    <section className="iris-chat-window">
      <div className="iris-chat-head"><div className="iris-mochi" /><div><strong>IRIS · assistente local</strong><span>Os teus dados ficam neste dispositivo</span></div></div>
      <div className="iris-chat-messages" aria-live="polite">{messages.map((message) => <div key={message.id} className={`iris-chat-message ${message.role}`}>{message.text}</div>)}</div>
      <form className="iris-chat-compose" onSubmit={sendChat}><input className="iris-input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Escreve um comando para a IRIS…" aria-label="Mensagem para a IRIS" /><button className="iris-send" type="submit" aria-label="Enviar mensagem"><Send /></button></form>
    </section>
    <aside className="iris-command-guide"><h3>Comandos que a IRIS entende</h3><p><b>Guardar</b>“Adiciona tarefa preparar a reunião”</p><p><b>Ver a lista</b>“Mostra as tarefas pendentes”</p><p><b>Concluir</b>“Conclui rever o relatório”</p><p>As respostas gerais de IA não estão ligadas nesta demonstração.</p></aside>
  </div>;
  const renderSettings = () => <div className="iris-settings-layout">
    <section>{([
      ['Privacidade local', 'As tuas notas e tarefas vivem apenas neste dispositivo.', 'startPage'],
      ['Lembretes tranquilos', 'Notificações discretas para tarefas com hora marcada.', 'notifications'],
      ['Sons da IRIS', 'Pequenos sinais sonoros para ações concluídas.', 'sound'],
    ] as const).map(([title, detail, key]) => <div className="iris-setting-row" key={key}><div><strong>{title}</strong><p>{detail}</p></div><button className={`iris-switch${settings[key] ? ' on' : ''}`} role="switch" aria-checked={settings[key]} aria-label={title} onClick={() => setSettings((current) => ({ ...current, [key]: !current[key] }))}><span /></button></div>)}
      <div className="iris-setting-row"><div><strong>Dados guardados</strong><p>Esta pré-visualização utiliza apenas estado temporário.</p></div><span style={{ color: '#8b8993', font: '9px var(--iris-mono)' }}>LOCAL</span></div>
    </section>
    <aside className="iris-settings-aside"><Command /><h3>IRIS, no teu ritmo.</h3><p>Assistente pessoal privado para tarefas, notas e foco. Sem conta, sem sincronização, sem respostas de IA externas nesta demonstração.</p></aside>
  </div>;

  return <div className="iris-redesign">
    <div className="iris-shell">
      <aside className="iris-sidebar">
        <div className="iris-brand"><div className="iris-brand-mark"><span className="iris-mochi" /></div><div><div className="iris-brand-name">IRIS</div><div className="iris-brand-caption">o teu espaço pessoal</div></div></div>
        <div className="iris-nav-caption">O teu espaço</div>
        <nav className="iris-nav" aria-label="Navegação principal">{nav.map(([id, label, Icon]) => <button key={id} className={`iris-nav-item${page === id ? ' active' : ''}`} onClick={() => setPage(id)}><Icon />{label}{id === 'tasks' && <span className="iris-nav-count">{pendingCount}</span>}</button>)}</nav>
        <div className="iris-context-block"><div className="iris-context-head"><span>Projetos</span><button className="iris-tiny-button" aria-label="Criar projeto" onClick={addProject}><Plus size={14} /></button></div>
          <div className="iris-project-nav">{projects.slice(0, 3).map((project) => <button key={project} className={`iris-project-item${selectedProject === project ? ' active' : ''}`} onClick={() => { setSelectedProject(project); setPage('tasks'); }}><i className="iris-project-dot" />{project}</button>)}</div>
        </div>
        <div className="iris-sidebar-bottom"><div className="iris-local-note"><strong><Zap />Privado por natureza</strong>Sem nuvem. Sem treino. A tua vida fica contigo.</div><div className="iris-profile"><div className="iris-profile-mark">IR</div><div><div className="iris-profile-name">Perfil local</div><div className="iris-profile-detail">Neste dispositivo</div></div></div></div>
      </aside>
      <main className="iris-main">
        <header className="iris-topbar"><div className="iris-crumb"><span>IRIS</span><span>/</span><b>{info.label}</b></div><div className="iris-top-actions"><button className="iris-top-capture" type="button" onClick={() => { setCaptureType('Tarefa'); setCaptureOpen(true); }}><Plus /><span>Captura rápida</span></button><button className="iris-icon-button" type="button" aria-label="Ajuda" onClick={() => setToast('A IRIS ajuda com tarefas locais e foco.')}><CircleHelp /></button></div></header>
        <div className="iris-content">
          <header className="iris-page-head"><div><div className="iris-eyebrow">Um lugar só teu</div><h1 className="iris-title">{info.title}</h1><p className="iris-subtitle">{page === 'home' ? `Hoje, ${todayLabel}. ${info.subtitle}` : info.subtitle}</p></div>{page === 'home' && <div className="iris-date">{todayLabel}</div>}</header>
          {page === 'home' && renderHome()}
          {page === 'inbox' && renderInbox()}
          {page === 'tasks' && renderTasks()}
          {page === 'projects' && renderProjects()}
          {page === 'focus' && renderFocus()}
          {page === 'chat' && renderChat()}
          {page === 'settings' && renderSettings()}
        </div>
      </main>
      <nav className="iris-mobile-nav" aria-label="Navegação móvel">{nav.map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon />{label}</button>)}</nav>
      <div className="iris-island" data-open={islandOpen}>
        <button className="iris-island-trigger" type="button" aria-expanded={islandOpen} onClick={() => { setIslandOpen((value) => !value); if (mochiState === 'Pronta para ajudar') setMochiState('À escuta'); else if (mochiState === 'À escuta') setMochiState('Pronta para ajudar'); }}>
          <span className="iris-island-mochi"><span className="iris-mochi" /></span><span className="iris-island-label"><b>IRIS</b><small>{islandStatus}{islandStatus === 'Pronta para ajudar' ? ` · ${pendingCount} tarefas por tratar` : ''}</small></span><i className="iris-island-state" /><ChevronDown className="iris-island-chevron" />
        </button>
        {islandOpen && <div className="iris-island-panel"><div className="iris-island-panel-head"><span>COMPANHEIRA LOCAL · {focusRunning ? 'EM FOCO' : overdue.length ? 'LEMBRETE' : 'À TUA DISPOSIÇÃO'}</span><button type="button" aria-label="Fechar ilha dinâmica" onClick={() => setIslandOpen(false)}><X /></button></div><div className="iris-island-message">{focusRunning ? 'Estou a focar contigo.' : overdue.length ? `Há ${overdue.length} ${overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} para rever.` : mochiState === 'Guardado com sucesso' || mochiState === 'Muito bem, feito' || mochiState === 'Sessão concluída' ? mochiState : 'Olá, estou por aqui.'}</div><p className="iris-island-copy">Um passo de cada vez. Os teus dados não saem daqui.</p><div className="iris-island-actions"><button type="button" onClick={() => { setIslandOpen(false); setPage('chat'); }}><MessageCircle />Conversar</button><button type="button" onClick={() => { setIslandOpen(false); setPage('tasks'); }}><ListTodo />Ver tarefas</button></div></div>}
      </div>
    </div>
    {captureOpen && <div className="iris-capture-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCaptureOpen(false); }}><form className="iris-capture-dialog" onSubmit={captureSubmit}><div className="iris-dialog-head"><h2>Guardar para mais tarde</h2><button type="button" className="iris-dialog-close" aria-label="Fechar captura" onClick={() => setCaptureOpen(false)}><X /></button></div><div className="iris-capture-tabs">{(['Tarefa', 'Nota'] as const).map((type) => <button type="button" key={type} className={captureType === type ? 'active' : ''} onClick={() => setCaptureType(type)}>{type === 'Tarefa' ? <ListTodo /> : <StickyNote />}{type}</button>)}</div><textarea className="iris-textarea" autoFocus value={captureText} onChange={(event) => setCaptureText(event.target.value)} placeholder={captureType === 'Tarefa' ? 'O que precisas de fazer?' : 'O que queres guardar?'} aria-label={captureType === 'Tarefa' ? 'Nova tarefa' : 'Nova nota'} /><div className="iris-capture-actions"><button type="button" className="iris-quiet-button" onClick={() => setCaptureOpen(false)}>Cancelar</button><button type="submit" className="iris-primary-button"><Archive />Guardar localmente</button></div></form></div>}
    {toast && <div className="iris-toast" role="status">{toast}</div>}
  </div>;
}

export default Redesign;