import { useEffect, useMemo, useRef, useState } from 'react';
import { request } from './api.js';

const emptyForm = { name: '', email: '', isActive: true };
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

function Icon({ name, ...props }) {
  const paths = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    arrow: <path d="m9 5 7 7-7 7"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const pending = useRef(false);

  async function load() {
    setLoading(true); setLoadError('');
    try { setUsers(await request()); }
    catch (e) { setLoadError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (modal && !dialog.current.open) dialog.current.showModal();
    if (!modal && dialog.current.open) dialog.current.close();
    if (modal) dialog.current.querySelector(modal.mode === 'delete' ? '.modal-actions button' : 'input')?.focus();
  }, [modal]);

  const filtered = useMemo(() => users.filter(user =>
    (filter === 'all' || user.isActive === (filter === 'active')) &&
    `${user.name} ${user.email}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))
  ), [users, query, filter]);
  const activeCount = users.filter(user => user.isActive).length;

  function open(mode, user = null) {
    setForm(user ? { name: user.name, email: user.email, isActive: user.isActive } : { ...emptyForm });
    setError(''); setModal({ mode, user });
  }
  function close() { if (!pending.current) { setModal(null); setError(''); } }

  async function save(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const editing = modal.mode === 'edit';
      const saved = await request(editing ? `/${modal.user.id}` : '', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(form),
      });
      setUsers(current => (editing ? current.map(user => user.id === saved.id ? saved : user) : [...current, saved])
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setModal(null); setNotice(editing ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
    } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  }

  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await request(`/${modal.user.id}`, { method: 'DELETE' });
      setUsers(current => current.filter(user => user.id !== modal.user.id));
      setModal(null); setNotice('Usuário excluído com sucesso.');
    } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  }

  const titles = { create: 'Novo usuário', edit: 'Editar usuário', view: 'Detalhes do usuário', delete: 'Excluir usuário?' };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="ProMarket início"><span className="brand-mark">p<span>.</span></span><span>ProMarket<small>GESTÃO DE PESSOAS</small></span></a>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Navegação principal"><a href="/" className="nav-item" aria-current="page"><Icon name="users"/> Usuários <span>{users.length}</span></a></nav>
      <div className="sidebar-note"><span className="small-dot"/> Cadastro de usuários<small>Organização começa com pessoas.</small></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Workspace <Icon name="arrow" width="14"/> <strong>Usuários</strong></span><span className="workspace-label">ProMarket</span></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow">PESSOAS & EQUIPE</div><h1>Usuários</h1><p>Gerencie as pessoas que fazem parte da sua organização.</p></div><button className="primary" onClick={() => open('create')}><Icon name="plus"/> Novo usuário</button></div>
        <section className="metrics" aria-label="Resumo de usuários">
          <article><div><span>Total de usuários</span><strong>{loading || loadError ? '—' : users.length}</strong></div><span className="metric-icon"><Icon name="users"/></span><small>Pessoas cadastradas</small></article>
          <article><div><span>Usuários ativos</span><strong>{loading || loadError ? '—' : activeCount}</strong></div><span className="status-dot active"/><small>Com status ativo no cadastro</small></article>
          <article><div><span>Usuários inativos</span><strong>{loading || loadError ? '—' : users.length - activeCount}</strong></div><span className="status-dot inactive"/><small>Com status inativo no cadastro</small></article>
        </section>
        {notice && <div className="notice" role="status">{notice}<button aria-label="Fechar mensagem" onClick={() => setNotice('')}><Icon name="close"/></button></div>}
        <section className="directory" aria-label="Lista de usuários">
          <div className="directory-heading"><h2>Diretório de usuários <span>{filtered.length}</span></h2><span>Todos em um só lugar</span></div>
          <div className="toolbar"><label className="search"><Icon name="search"/><input aria-label="Buscar usuários" placeholder="Buscar por nome ou e-mail..." value={query} onChange={e => setQuery(e.target.value)}/></label><label className="filter">Status <select aria-label="Filtrar por status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label></div>
          {loading ? <div className="empty" role="status">Carregando usuários…</div> : loadError ? <div className="empty"><p role="alert">{loadError}</p><button onClick={load}>Tentar novamente</button></div> : filtered.length === 0 ? <div className="empty"><span className="empty-icon"><Icon name="users" width="30" height="30"/></span><h3>{users.length ? 'Nenhum resultado encontrado' : 'Seu diretório começa aqui'}</h3><p>{users.length ? 'Experimente outro nome, e-mail ou status.' : 'Cadastre o primeiro usuário para começar a organizar sua equipe.'}</p>{users.length === 0 && <button onClick={() => open('create')}>Cadastrar primeiro usuário <Icon name="plus"/></button>}</div> : <div className="table-scroll"><table><thead><tr><th>Usuário</th><th>E-mail</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filtered.map(user => <tr key={user.id}><td><button className="person" onClick={() => open('view', user)}><span className="avatar">{initials(user.name)}</span><span>{user.name}<small>#{String(user.id).padStart(4, '0')}</small></span></button></td><td className="email">{user.email}</td><td><span className={`badge ${user.isActive ? 'active' : 'inactive'}`}><i/>{user.isActive ? 'Ativo' : 'Inativo'}</span></td><td><div className="row-actions"><button onClick={() => open('view', user)} aria-label={`Ver ${user.name}`}>Ver</button><button onClick={() => open('edit', user)} aria-label={`Editar ${user.name}`}>Editar</button><button className="danger-text" onClick={() => open('delete', user)} aria-label={`Excluir ${user.name}`}>Excluir</button></div></td></tr>)}</tbody></table></div>}
          <footer className="table-footer">{!loading && !loadError ? `${filtered.length} de ${users.length} usuários` : 'Diretório de usuários'}<span>ProMarket · Pessoas conectadas</span></footer>
        </section>
      </main>
    </div>
    <dialog ref={dialog} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
      {modal && <div className="modal-content"><div className="modal-heading"><h2 id="modal-title">{titles[modal.mode]}</h2><button aria-label="Fechar janela" disabled={busy} onClick={close}><Icon name="close"/></button></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {['create', 'edit'].includes(modal.mode) ? <form onSubmit={save}><p className="modal-description">Preencha os dados abaixo para manter o cadastro atualizado.</p><fieldset disabled={busy}><label>Nome completo<input autoFocus required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Ana Souza"/></label><label>E-mail<input type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nome@empresa.com.br"/></label><label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}/> Usuário ativo</label></fieldset><div className="modal-actions"><button type="button" disabled={busy} onClick={close}>Cancelar</button><button className="primary" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar usuário'}</button></div></form>
          : modal.mode === 'delete' ? <><p className="modal-description">O cadastro de <strong>{modal.user.name}</strong> será excluído permanentemente. Esta ação não pode ser desfeita.</p><div className="modal-actions"><button disabled={busy} onClick={close} autoFocus>Cancelar</button><button className="danger" disabled={busy} onClick={remove}>{busy ? 'Excluindo…' : 'Confirmar exclusão'}</button></div></>
            : <><div className="detail-person"><span className="avatar large">{initials(modal.user.name)}</span><strong>{modal.user.name}</strong></div><dl><dt>E-mail</dt><dd>{modal.user.email}</dd><dt>Status</dt><dd>{modal.user.isActive ? 'Ativo' : 'Inativo'}</dd><dt>Cadastrado em</dt><dd>{dateFormat.format(new Date(modal.user.createdAt))}</dd><dt>Identificador</dt><dd>#{modal.user.id}</dd></dl><div className="modal-actions"><button onClick={close}>Fechar</button><button className="primary" onClick={() => open('edit', modal.user)}>Editar usuário</button></div></>}
      </div>}
    </dialog>
  </div>;
}
