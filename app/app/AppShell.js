'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ============ HELPERS ============
const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const daysSince = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
const code = (seq) => '#' + String(seq).padStart(5, '0');
const initials = (name) => name.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();

const EMPTY_MODEL = {
  name: '', status: 'available', category: '', priority: 'normal', seller_id: '', buyer_id: '',
  age: '', origin: '', phone: '', pct: '', time_per_day: '', english: '', content: '',
  contract: 'No', agency: 'No', start_when: '', social: 'No', tiktok: 'No', blocked: '',
  verified: 'No', fee: '', notes: '', photos: [],
  price_listing: '', price_final: '', commission: '',
};

function buildListing(m) {
  return `Model ${m.seq ? code(m.seq) : '(nuevo)'}

${(m.name || '').toUpperCase()}

🌴 Age: ${m.age || '—'}
🌴 Origin: ${m.origin || '—'}
🌴 Smartphone: ${m.phone || '—'}
🌴 % or salary: ${m.pct || '—'}
🌴 Time per day: ${m.time_per_day || '—'}
🌴 English skills (1–10): ${m.english || '—'}
🌴 Content: ${m.content || '—'}
🌴 Contract signed: ${m.contract || '—'}
🌴 Working with an agency currently: ${m.agency || '—'}
🌴 When can she start: ${m.start_when || '—'}
🌴 Social media set up: ${m.social || '—'}
🌴 Comfortable with TikTok: ${m.tiktok || '—'}
🌴 Any countries blocked?: ${m.blocked || '—'}
🌴 OF and Skrill verified: ${m.verified || '—'}

💵 Agency Fee: ${m.fee || '—'}`.trim();
}

// ============ ICONS ============
const Icon = ({ d, ...p }) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p} dangerouslySetInnerHTML={{ __html: d }} />);
const ICONS = {
  dash: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  models: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  sellers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  buyers: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  leads: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
};
const TG_PATH = 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.868 13.99l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.28.569z';

export default function AppShell({ userEmail }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [view, setView] = useState('cards');

  const [models, setModels] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searches, setSearches] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [settings, setSettings] = useState({ telegram_token: '', telegram_chat_id: '' });

  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  // filters
  const [fSearch, setFSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fCat, setFCat] = useState('');
  const [fPrio, setFPrio] = useState('');

  // modals
  const [modelModal, setModelModal] = useState(null); // {data, editingId, photoFiles}
  const [detailId, setDetailId] = useState(null);
  const [detailTab, setDetailTab] = useState('info');
  const [contactModal, setContactModal] = useState(null);
  const [searchModal, setSearchModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);
  const [tgModal, setTgModal] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);

  function showToast(title, msg, type = '') {
    setToast({ title, msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }

  // ============ LOAD DATA ============
  const loadAll = useCallback(async () => {
    const [mRes, cRes, catRes, sRes, aRes, setRes] = await Promise.all([
      supabase.from('models').select('*').order('seq', { ascending: true }),
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('searches').select('*').order('created_at', { ascending: false }),
      supabase.from('alerts').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').maybeSingle(),
    ]);
    setModels(mRes.data || []);
    setContacts(cRes.data || []);
    setCategories(catRes.data || []);
    setSearches(sRes.data || []);
    setAlerts(aRes.data || []);
    if (setRes.data) setSettings(setRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function logActivity(modelId, text, type = '') {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({ user_id: user.id, model_id: modelId, text, type });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ============ CATEGORIES ============
  async function addCategory() {
    const name = newCat.trim();
    if (!name) { showToast('Vacío', 'Escribí un nombre.', 'error'); return; }
    if (categories.some((c) => c.name === name)) { showToast('Existe', 'Esa categoría ya existe.', 'error'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('categories').insert({ user_id: user.id, name }).select().single();
    if (error) { showToast('Error', error.message, 'error'); return; }
    setCategories((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCat('');
    showToast('Agregada', `"${name}" creada.`, 'success');
  }
  async function delCategory(id, name) {
    if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
    await supabase.from('categories').delete().eq('id', id);
    setCategories((p) => p.filter((c) => c.id !== id));
  }

  // ============ MODELS ============
  function openNewModel() {
    setModelModal({ data: { ...EMPTY_MODEL }, editingId: null, newFiles: [] });
  }
  function openEditModel(m) {
    setDetailId(null);
    setModelModal({
      data: {
        name: m.name || '', status: m.status, category: m.category || '', priority: m.priority,
        seller_id: m.seller_id || '', buyer_id: m.buyer_id || '', age: m.age || '', origin: m.origin || '',
        phone: m.phone || '', pct: m.pct || '', time_per_day: m.time_per_day || '', english: m.english || '',
        content: m.content || '', contract: m.contract || 'No', agency: m.agency || 'No',
        start_when: m.start_when || '', social: m.social || 'No', tiktok: m.tiktok || 'No',
        blocked: m.blocked || '', verified: m.verified || 'No', fee: m.fee || '', notes: m.notes || '',
        photos: m.photos || [],
        price_listing: m.price_listing ?? '', price_final: m.price_final ?? '', commission: m.commission ?? '',
      },
      editingId: m.id, seq: m.seq, newFiles: [],
    });
  }

  async function uploadPhotos(files) {
    const { data: { user } } = await supabase.auth.getUser();
    const urls = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('model-photos').upload(path, file, { upsert: false });
      if (error) { showToast('Error foto', error.message, 'error'); continue; }
      const { data } = supabase.storage.from('model-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function saveModel() {
    const md = modelModal;
    if (!md.data.name.trim()) { alert('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let photos = [...(md.data.photos || [])];
      if (md.newFiles?.length) {
        const uploaded = await uploadPhotos(md.newFiles);
        photos = [...photos, ...uploaded].slice(0, 10);
      }
      const pl = md.data.price_listing === '' ? null : Number(md.data.price_listing);
      const pf = md.data.price_final === '' ? null : Number(md.data.price_final);
      const comm = md.data.commission === '' ? null : Number(md.data.commission);
      const mcut = pf && comm ? (pf * comm) / 100 : null;
      const payload = {
        user_id: user.id,
        name: md.data.name.trim(), status: md.data.status, category: md.data.category || null,
        priority: md.data.priority, seller_id: md.data.seller_id || null, buyer_id: md.data.buyer_id || null,
        age: md.data.age, origin: md.data.origin, phone: md.data.phone, pct: md.data.pct,
        time_per_day: md.data.time_per_day, english: md.data.english, content: md.data.content,
        contract: md.data.contract, agency: md.data.agency, start_when: md.data.start_when,
        social: md.data.social, tiktok: md.data.tiktok, blocked: md.data.blocked,
        verified: md.data.verified, fee: md.data.fee, notes: md.data.notes, photos,
        price_listing: pl, price_final: pf, commission: comm, market_cut: mcut,
      };
      if (md.editingId) {
        const old = models.find((x) => x.id === md.editingId);
        const { data, error } = await supabase.from('models').update(payload).eq('id', md.editingId).select().single();
        if (error) throw error;
        if (old && old.status !== data.status) await logActivity(data.id, `Status: ${old.status} → ${data.status}`, data.status === 'sold' ? 'sold' : 'green');
        setModels((p) => p.map((x) => (x.id === data.id ? data : x)));
        showToast('Actualizado', `${data.name} actualizada.`, 'success');
      } else {
        const { data, error } = await supabase.from('models').insert(payload).select().single();
        if (error) throw error;
        await logActivity(data.id, 'Perfil creado', '');
        setModels((p) => [...p, data]);
        showToast('Creado', `Perfil agregado: ${data.name}`, 'success');
      }
      setModelModal(null);
    } catch (e) {
      showToast('Error', e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteModel(id) {
    const m = models.find((x) => x.id === id);
    if (!confirm(`¿Eliminar el perfil ${code(m.seq)} — ${m.name}? No se puede deshacer.`)) return;
    await supabase.from('models').delete().eq('id', id);
    setModels((p) => p.filter((x) => x.id !== id));
    setDetailId(null);
    showToast('Eliminado', `${m.name} fue removida.`, 'error');
  }

  // ============ CONTACTS ============
  function openNewContact(type) {
    setContactModal({ type, data: { name: '', telegram: '', notes: '', looking_for: '', categories: '' }, editingId: null });
  }
  function openEditContact(c) {
    setContactModal({ type: c.type, editingId: c.id, data: { name: c.name, telegram: c.telegram || '', notes: c.notes || '', looking_for: c.looking_for || '', categories: c.categories || '' } });
  }
  async function saveContact() {
    const cm = contactModal;
    if (!cm.data.name.trim()) { alert('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { user_id: user.id, type: cm.type, name: cm.data.name.trim(), telegram: cm.data.telegram.trim(), notes: cm.data.notes.trim(), looking_for: cm.data.looking_for.trim(), categories: cm.data.categories.trim() };
      if (cm.editingId) {
        const { data, error } = await supabase.from('contacts').update(payload).eq('id', cm.editingId).select().single();
        if (error) throw error;
        setContacts((p) => p.map((x) => (x.id === data.id ? data : x)));
      } else {
        const { data, error } = await supabase.from('contacts').insert(payload).select().single();
        if (error) throw error;
        setContacts((p) => [data, ...p]);
      }
      showToast('Guardado', `${cm.data.name} guardado.`, 'success');
      setContactModal(null);
    } catch (e) { showToast('Error', e.message, 'error'); } finally { setSaving(false); }
  }
  async function deleteContact(id, name) {
    if (!confirm(`¿Eliminar a ${name}?`)) return;
    await supabase.from('contacts').delete().eq('id', id);
    setContacts((p) => p.filter((c) => c.id !== id));
  }

  // ============ SEARCHES ============
  function openNewSearch() { setSearchModal({ data: { title: '', buyer_id: '', requirements: '', status: 'active' }, editingId: null }); }
  async function saveSearch() {
    const sm = searchModal;
    if (!sm.data.title.trim()) { alert('El título es obligatorio.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { user_id: user.id, title: sm.data.title.trim(), buyer_id: sm.data.buyer_id || null, requirements: sm.data.requirements.trim(), status: sm.data.status };
      const { data, error } = await supabase.from('searches').insert(payload).select().single();
      if (error) throw error;
      setSearches((p) => [data, ...p]);
      showToast('Guardado', 'Búsqueda guardada.', 'success');
      setSearchModal(null);
    } catch (e) { showToast('Error', e.message, 'error'); } finally { setSaving(false); }
  }
  async function resolveSearch(id) {
    const { data } = await supabase.from('searches').update({ status: 'resolved' }).eq('id', id).select().single();
    setSearches((p) => p.map((s) => (s.id === id ? data : s)));
  }
  async function deleteSearch(id) {
    await supabase.from('searches').delete().eq('id', id);
    setSearches((p) => p.filter((s) => s.id !== id));
  }

  // ============ ALERTS ============
  function openNewAlert() { setAlertModal({ title: '', model_id: '', notes: '', due_date: '', priority: 'normal' }); }
  async function saveAlert() {
    if (!alertModal.title.trim()) { alert('El título es obligatorio.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { user_id: user.id, title: alertModal.title.trim(), model_id: alertModal.model_id || null, notes: alertModal.notes.trim(), due_date: alertModal.due_date || null, priority: alertModal.priority, done: false };
      const { data, error } = await supabase.from('alerts').insert(payload).select().single();
      if (error) throw error;
      setAlerts((p) => [data, ...p]);
      showToast('Guardado', 'Alerta creada.', 'success');
      setAlertModal(null);
    } catch (e) { showToast('Error', e.message, 'error'); } finally { setSaving(false); }
  }
  async function dismissAlert(id) {
    const { data } = await supabase.from('alerts').update({ done: true }).eq('id', id).select().single();
    setAlerts((p) => p.map((a) => (a.id === id ? data : a)));
  }
  async function deleteAlert(id) {
    await supabase.from('alerts').delete().eq('id', id);
    setAlerts((p) => p.filter((a) => a.id !== id));
  }

  // ============ TELEGRAM ============
  async function openTg(m) {
    setTgModal({ model: m, token: settings.telegram_token || '', chatId: settings.telegram_chat_id || '', sending: false });
  }
  async function saveTgConfig(token, chatId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('settings').upsert({ user_id: user.id, telegram_token: token, telegram_chat_id: chatId, updated_at: new Date().toISOString() }).select().single();
    if (data) setSettings(data);
    showToast('Guardado', 'Configuración de Telegram guardada.', 'success');
  }
  async function sendToTelegram(token, chatId) {
    if (!token || !chatId) { showToast('Faltan datos', 'Completá token y chat ID.', 'error'); return; }
    await saveTgConfig(token, chatId);
    const m = tgModal.model;
    setTgModal((t) => ({ ...t, sending: true }));
    const txt = buildListing(m);
    const base = `https://api.telegram.org/bot${token}`;
    const photos = m.photos || [];
    try {
      let res, j;
      if (photos.length === 0) {
        res = await fetch(`${base}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: txt }) });
      } else if (photos.length === 1) {
        res = await fetch(`${base}/sendPhoto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, photo: photos[0], caption: txt }) });
      } else {
        const media = photos.slice(0, 10).map((url, i) => ({ type: 'photo', media: url, ...(i === 0 ? { caption: txt } : {}) }));
        res = await fetch(`${base}/sendMediaGroup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, media }) });
      }
      j = await res.json();
      if (!j.ok) throw new Error(j.description || 'Falló el envío');
      await logActivity(m.id, `Publicado en Telegram (${photos.length} foto${photos.length !== 1 ? 's' : ''})`, 'orange');
      showToast('Publicado', `Listing enviado a Telegram para ${m.name}`, 'success');
      setTgModal(null);
    } catch (e) {
      showToast('Error', e.message, 'error');
      setTgModal((t) => ({ ...t, sending: false }));
    }
  }

  // ============ DERIVED ============
  const sellers = contacts.filter((c) => c.type === 'seller');
  const buyers = contacts.filter((c) => c.type === 'buyer');
  const soldModels = models.filter((m) => m.status === 'sold');
  const totalBilled = soldModels.reduce((s, m) => s + (Number(m.price_final) || 0), 0);
  const totalCommission = soldModels.reduce((s, m) => s + (Number(m.market_cut) || 0), 0);
  const autoAlerts = models.filter((m) => m.status === 'available' && daysSince(m.created_at) >= 30);
  const activeAlerts = alerts.filter((a) => !a.done);
  const alertCount = autoAlerts.length + activeAlerts.length;

  const filteredModels = models.filter((m) => {
    const s = fSearch.toLowerCase();
    return (!s || m.name.toLowerCase().includes(s) || code(m.seq).toLowerCase().includes(s) || (m.category || '').toLowerCase().includes(s))
      && (!fStatus || m.status === fStatus) && (!fCat || m.category === fCat) && (!fPrio || m.priority === fPrio);
  });

  const detailModel = detailId ? models.find((m) => m.id === detailId) : null;
  const sc = { available: 'green', sold: 'red', reserved: 'orange' };

  if (loading) {
    return <div className="full-loader"><div className="spinner" /></div>;
  }

  const NAV = [
    { sec: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dash' }] },
    { sec: 'Models', items: [
      { id: 'marketplace', label: 'Marketplace', icon: 'models', badge: models.length },
      { id: 'alerts', label: 'Alerts', icon: 'bell', badge: alertCount, badgeColor: 'red' },
      { id: 'categories', label: 'Categories', icon: 'tag' },
    ] },
    { sec: 'CRM', items: [
      { id: 'sellers', label: 'Sellers', icon: 'sellers', badge: sellers.length },
      { id: 'buyers', label: 'Buyers', icon: 'buyers', badge: buyers.length },
      { id: 'leads', label: 'Leads', icon: 'leads', badge: contacts.filter((c) => c.type === 'lead').length, badgeColor: 'orange' },
    ] },
    { sec: 'Pipeline', items: [
      { id: 'searches', label: 'Active Searches', icon: 'search', badge: searches.filter((s) => s.status === 'active').length, badgeColor: 'orange' },
    ] },
  ];

  return (
    <div className="app">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="logo"><h1>OFM</h1><span>Marketplace Command</span></div>
        {NAV.map((group) => (
          <div className="sb-sec" key={group.sec}>
            <div className="sb-lbl">{group.sec}</div>
            {group.items.map((it) => (
              <button key={it.id} className={`ni ${page === it.id ? 'active' : ''}`} onClick={() => setPage(it.id)}>
                <Icon d={ICONS[it.icon]} />
                {it.label}
                {it.badge !== undefined && <span className={`badge ${it.badgeColor || ''}`}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="sb-foot">
          <div className="sb-user">{userEmail}</div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        {/* ===== DASHBOARD ===== */}
        {page === 'dashboard' && (
          <>
            <div className="topbar"><div className="topbar-title">Dashboard</div></div>
            <div className="page-pad">
              <div className="metrics">
                <Metric label="Total Models" value={models.length} sub="in marketplace" />
                <Metric label="Available" value={models.filter((m) => m.status === 'available').length} sub="ready to sell" color="var(--green)" />
                <Metric label="Sold" value={soldModels.length} sub="deals closed" color="var(--gold)" />
                <Metric label="Total Billed" value={fmtMoney(totalBilled)} sub="final sale prices" color="var(--text)" small />
                <Metric label="Market Revenue" value={fmtMoney(totalCommission)} sub="commissions earned" small />
              </div>
              <div className="gold-line" />
              <div style={{ marginBottom: 18 }}><div className="sec-title">Sales Breakdown</div><div className="sec-sub">All closed deals</div></div>
              {soldModels.length === 0 ? <Empty text="No sales yet." /> : (
                <table className="stable">
                  <thead><tr><th>ID</th><th>Model</th><th>Listing</th><th>Final</th><th>Comm %</th><th>Market Earns</th><th>Seller Gets</th></tr></thead>
                  <tbody>
                    {soldModels.map((m) => {
                      const seller = contacts.find((c) => c.id === m.seller_id);
                      const sr = (Number(m.price_final) || 0) - (Number(m.market_cut) || 0);
                      return (
                        <tr key={m.id} onClick={() => { setDetailId(m.id); setDetailTab('finance'); }}>
                          <td style={{ color: 'var(--gold-dim)', fontSize: 10, letterSpacing: 2 }}>{code(m.seq)}</td>
                          <td>{m.name}{seller && <><br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{seller.name}</span></>}</td>
                          <td>{m.price_listing ? fmtMoney(m.price_listing) : '—'}</td>
                          <td>{m.price_final ? fmtMoney(m.price_final) : '—'}</td>
                          <td>{m.commission ? m.commission + '%' : '—'}</td>
                          <td className="gval">{m.market_cut ? fmtMoney(m.market_cut) : '—'}</td>
                          <td>{m.price_final ? fmtMoney(sr) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Totals</td>
                      <td style={{ fontWeight: 700 }}>{fmtMoney(totalBilled)}</td><td />
                      <td className="gval">{fmtMoney(totalCommission)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtMoney(totalBilled - totalCommission)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== MARKETPLACE ===== */}
        {page === 'marketplace' && (
          <>
            <div className="topbar"><div className="topbar-title">Marketplace</div><div className="tb-actions"><button className="btn btn-gold" onClick={openNewModel}>+ New Profile</button></div></div>
            <div className="page-pad">
              <div className="filters">
                <input className="finp" placeholder="Buscar por nombre, ID, categoría..." value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
                <select className="fsel" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All Status</option><option value="available">Available</option><option value="sold">Sold</option><option value="reserved">Reserved</option></select>
                <select className="fsel" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="">All Categories</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                <select className="fsel" value={fPrio} onChange={(e) => setFPrio(e.target.value)}><option value="">All Priority</option><option value="hot">Hot</option><option value="normal">Normal</option></select>
                <div className="vtoggle">
                  <button className={`vbtn ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}><Icon d={ICONS.dash} /></button>
                  <button className={`vbtn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><Icon d='<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' /></button>
                </div>
              </div>
              {filteredModels.length === 0 ? <Empty text="No hay modelos. Agregá tu primer perfil." icon={ICONS.models} /> : view === 'cards' ? (
                <div className="cgrid">
                  {filteredModels.map((m) => {
                    const d = daysSince(m.created_at), dc = d > 30 ? 'alert' : d > 14 ? 'warning' : '';
                    const seller = contacts.find((c) => c.id === m.seller_id);
                    const photo = (m.photos || [])[0];
                    return (
                      <div key={m.id} className={`mcard ${m.priority === 'hot' ? 'hot' : ''}`} onClick={() => { setDetailId(m.id); setDetailTab('info'); }}>
                        <div className="cimg">{photo ? <img src={photo} alt="" /> : 'NO PHOTO'}</div>
                        <div className="cbody">
                          <div className="cid">{code(m.seq)}</div>
                          <div className="cname">{m.name}</div>
                          <div className="cmeta">
                            <span className={`tag tag-${sc[m.status]}`}><span className={`sdot ${m.status}`} />{m.status}</span>
                            {m.category && <span className="tag tag-def">{m.category}</span>}
                            {m.origin && <span className="tag tag-blue">{m.origin}</span>}
                          </div>
                          <div className="cfoot"><div className="cseller">Seller: <strong>{seller ? seller.name : '—'}</strong></div><div className={`cdays ${dc}`}>{d}d</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <table className="ltable">
                  <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Category</th><th>Seller</th><th>Priority</th><th>Days</th></tr></thead>
                  <tbody>
                    {filteredModels.map((m) => {
                      const d = daysSince(m.created_at), dc = d > 30 ? 'alert' : d > 14 ? 'warning' : '';
                      const seller = contacts.find((c) => c.id === m.seller_id);
                      return (
                        <tr key={m.id} onClick={() => { setDetailId(m.id); setDetailTab('info'); }}>
                          <td style={{ color: 'var(--gold-dim)', fontSize: 10, letterSpacing: 2 }}>{code(m.seq)}</td>
                          <td>{m.name}</td><td><span className={`tag tag-${sc[m.status]}`}>{m.status}</span></td>
                          <td>{m.category || '—'}</td><td>{seller ? seller.name : '—'}</td>
                          <td>{m.priority === 'hot' ? <span className="tag tag-gold">HOT</span> : 'Normal'}</td>
                          <td className={`cdays ${dc}`}>{d}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== ALERTS ===== */}
        {page === 'alerts' && (
          <>
            <div className="topbar"><div className="topbar-title">Alerts — Follow-up Required</div><div className="tb-actions"><button className="btn btn-gold" onClick={openNewAlert}>+ New Alert</button></div></div>
            <div className="page-pad">
              {activeAlerts.length > 0 && (
                <>
                  <div className="sec-title" style={{ fontSize: 15, marginBottom: 10 }}>Manual Alerts</div>
                  <div className="apanel" style={{ borderColor: 'rgba(201,168,76,0.3)', marginBottom: 24 }}>
                    <div className="ahead" style={{ color: 'var(--gold)', background: 'var(--gold-glow)', borderColor: 'var(--border)' }}><Icon d='<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' style={{ width: 14, height: 14 }} />{activeAlerts.length} alerta{activeAlerts.length !== 1 ? 's' : ''} activa{activeAlerts.length !== 1 ? 's' : ''}</div>
                    {activeAlerts.map((a) => {
                      const m = a.model_id ? models.find((x) => x.id === a.model_id) : null;
                      const overdue = a.due_date && new Date(a.due_date) < new Date();
                      return (
                        <div className="aitem" key={a.id}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{a.title}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m && `${code(m.seq)} — ${m.name} · `}{a.due_date && `Vence: ${fmtDate(a.due_date)}`}{a.notes && ` · ${a.notes}`}</div>
                          </div>
                          <span className={`tag ${a.priority === 'high' ? 'tag-red' : 'tag-gold'}`}>{a.priority}</span>
                          {overdue && <span className="tag tag-red">Overdue</span>}
                          <button className="btn btn-outline btn-sm" onClick={() => dismissAlert(a.id)}>Dismiss</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteAlert(a.id)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {autoAlerts.length > 0 && (
                <>
                  <div className="sec-title" style={{ fontSize: 15, marginBottom: 4 }}>Automatic — No Movement</div>
                  <div className="sec-sub" style={{ marginBottom: 10 }}>Models available for 30+ days</div>
                  <div className="apanel">
                    <div className="ahead"><Icon d={ICONS.bell} style={{ width: 14, height: 14 }} />{autoAlerts.length} modelo{autoAlerts.length > 1 ? 's' : ''} sin movimiento — seguí con el seller</div>
                    {autoAlerts.map((m) => {
                      const seller = contacts.find((c) => c.id === m.seller_id);
                      return (
                        <div className="aitem" key={m.id}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{code(m.seq)} — {m.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Seller: {seller ? `${seller.name} · ${seller.telegram || 'sin handle'}` : 'Sin seller'} · Listado {fmtDate(m.created_at)}</div>
                          </div>
                          <span className="tag tag-red">{daysSince(m.created_at)}d listed</span>
                          <button className="btn btn-outline btn-sm" onClick={() => { setDetailId(m.id); setDetailTab('info'); }}>View</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {activeAlerts.length === 0 && autoAlerts.length === 0 && <Empty text="Sin alertas. Todo se mueve bien." icon='<polyline points="20 6 9 17 4 12"/>' />}
            </div>
          </>
        )}

        {/* ===== CATEGORIES ===== */}
        {page === 'categories' && (
          <>
            <div className="topbar">
              <div className="topbar-title">Categories</div>
              <div className="tb-actions" style={{ gap: 8 }}>
                <input className="finp" style={{ minWidth: 180 }} placeholder="Nueva categoría..." value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
                <button className="btn btn-gold" onClick={addCategory}>+ Add</button>
              </div>
            </div>
            <div className="page-pad">
              {categories.length === 0 ? <Empty text="No hay categorías. Creá una arriba." icon={ICONS.tag} /> : (
                <div className="catgrid">
                  {categories.map((c) => {
                    const count = models.filter((m) => m.category === c.name).length;
                    return (
                      <div className="catchip" key={c.id}>
                        <div><div className="catname">{c.name}</div><div className="catcount">{count} model{count !== 1 ? 's' : ''}</div></div>
                        <button className="catdel" onClick={() => delCategory(c.id, c.name)}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== CONTACTS (sellers/buyers/leads) ===== */}
        {['sellers', 'buyers', 'leads'].includes(page) && (() => {
          const type = page === 'sellers' ? 'seller' : page === 'buyers' ? 'buyer' : 'lead';
          const list = contacts.filter((c) => c.type === type);
          const title = page.charAt(0).toUpperCase() + page.slice(1);
          return (
            <>
              <div className="topbar"><div className="topbar-title">{title}</div><div className="tb-actions"><button className="btn btn-gold" onClick={() => openNewContact(type)}>+ New {type}</button></div></div>
              <div className="page-pad">
                {list.length === 0 ? <Empty text={`No hay ${type}s todavía.`} /> : (
                  <div className="cgrid2">
                    {list.map((c) => {
                      const cms = type === 'seller' ? models.filter((m) => m.seller_id === c.id) : [];
                      return (
                        <div className="ccard" key={c.id}>
                          <div className="cavatar">{initials(c.name)}</div>
                          <div style={{ flex: 1 }}>
                            <div className="cname2">{c.name}</div>
                            <div className="chandle">{c.telegram || 'No Telegram'}</div>
                            {c.notes && <div className="cmeta2">{c.notes}</div>}
                            {c.looking_for && <div className="cmeta2" style={{ marginTop: 4, color: 'var(--gold-dim)' }}>Busca: {c.looking_for}</div>}
                            {c.categories && <div className="cmeta2" style={{ marginTop: 4 }}>Categorías: {c.categories}</div>}
                            {cms.length > 0 && <div className="smodels">{cms.map((m) => <span className="smtag" key={m.id}>{code(m.seq)}</span>)}</div>}
                          </div>
                          <div className="ccard-actions">
                            <button className="icon-btn" onClick={() => openEditContact(c)} title="Editar">✎</button>
                            <button className="icon-btn del" onClick={() => deleteContact(c.id, c.name)} title="Eliminar">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ===== SEARCHES ===== */}
        {page === 'searches' && (
          <>
            <div className="topbar"><div className="topbar-title">Active Searches</div><div className="tb-actions"><button className="btn btn-gold" onClick={openNewSearch}>+ New Search</button></div></div>
            <div className="page-pad">
              {searches.length === 0 ? <Empty text="No hay búsquedas activas." icon={ICONS.search} /> : (
                <div className="sgrid">
                  {searches.map((s) => {
                    const buyer = contacts.find((c) => c.id === s.buyer_id);
                    return (
                      <div className={`scard ${s.status === 'resolved' ? 'resolved' : ''}`} key={s.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div><div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 500 }}>{s.title}</div><div style={{ fontSize: 10, color: 'var(--gold-dim)', marginTop: 2 }}>{buyer ? buyer.name : 'Sin buyer'}</div></div>
                          <span className={`tag ${s.status === 'active' ? 'tag-gold' : 'tag-def'}`}>{s.status}</span>
                        </div>
                        {s.requirements && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>{s.requirements}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmtDate(s.created_at)}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {s.status === 'active' && <button className="btn btn-outline btn-sm" onClick={() => resolveSearch(s.id)}>Resolver</button>}
                            <button className="btn btn-danger btn-sm" onClick={() => deleteSearch(s.id)}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ============ MODALS ============ */}
      {modelModal && <ModelModal md={modelModal} setMd={setModelModal} categories={categories} sellers={sellers} buyers={buyers} onSave={saveModel} onClose={() => setModelModal(null)} saving={saving} />}
      {detailModel && <DetailModal m={detailModel} tab={detailTab} setTab={setDetailTab} contacts={contacts} onEdit={() => openEditModel(detailModel)} onDelete={() => deleteModel(detailModel.id)} onTg={() => openTg(detailModel)} onClose={() => setDetailId(null)} showToast={showToast} />}
      {contactModal && <ContactModal cm={contactModal} setCm={setContactModal} onSave={saveContact} onClose={() => setContactModal(null)} saving={saving} />}
      {searchModal && <SearchModal sm={searchModal} setSm={setSearchModal} buyers={buyers} onSave={saveSearch} onClose={() => setSearchModal(null)} saving={saving} />}
      {alertModal && <AlertModal am={alertModal} setAm={setAlertModal} models={models} onSave={saveAlert} onClose={() => setAlertModal(null)} saving={saving} />}
      {tgModal && <TgModal tg={tgModal} setTg={setTgModal} onSend={sendToTelegram} onSaveConfig={saveTgConfig} onClose={() => setTgModal(null)} />}

      {toast && <div className={`toast ${toast.type}`}><div className="toast-title">{toast.title}</div><div className="toast-msg">{toast.msg}</div></div>}
    </div>
  );
}

// ============ SUB-COMPONENTS ============
function Metric({ label, value, sub, color, small }) {
  return (<div className="mc"><div className="mc-lbl">{label}</div><div className="mc-val" style={{ color: color || 'var(--gold)', fontSize: small ? 22 : undefined }}>{value}</div><div className="mc-sub">{sub}</div></div>);
}
function Empty({ text, icon }) {
  return (<div className="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" dangerouslySetInnerHTML={{ __html: icon || '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' }} /><p>{text}</p></div>);
}

function Field({ label, children, full }) {
  return (<div className={`fgrp ${full ? 'full' : ''}`}><label className="flbl">{label}</label>{children}</div>);
}

function ModelModal({ md, setMd, categories, sellers, buyers, onSave, onClose, saving }) {
  const d = md.data;
  const set = (k, v) => setMd((p) => ({ ...p, data: { ...p.data, [k]: v } }));
  const fileRef = useRef(null);
  const marketCut = d.price_final && d.commission ? (Number(d.price_final) * Number(d.commission)) / 100 : 0;

  function onFiles(e) {
    const files = Array.from(e.target.files);
    setMd((p) => ({ ...p, newFiles: [...(p.newFiles || []), ...files].slice(0, 10) }));
    e.target.value = '';
  }
  function removeNew(i) { setMd((p) => ({ ...p, newFiles: p.newFiles.filter((_, idx) => idx !== i) })); }
  function removeExisting(i) { set('photos', d.photos.filter((_, idx) => idx !== i)); }

  const totalPhotos = (d.photos?.length || 0) + (md.newFiles?.length || 0);

  return (
    <div className="overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 780 }}>
        <div className="mhead"><div className="mtitle">{md.editingId ? `Editar — ${code(md.seq)}` : 'New Model Profile'}</div><button className="mclose" onClick={onClose}>✕</button></div>
        <div className="mbody" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <div className="fg">
            <div className="fseclbl">Basic Info</div>
            <Field label="Name / Alias *"><input className="finput" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Model name" /></Field>
            <Field label="Status"><select className="fsel2" value={d.status} onChange={(e) => set('status', e.target.value)}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option></select></Field>
            <Field label="Category"><select className="fsel2" value={d.category} onChange={(e) => set('category', e.target.value)}><option value="">— Select —</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
            <Field label="Priority"><select className="fsel2" value={d.priority} onChange={(e) => set('priority', e.target.value)}><option value="normal">Normal</option><option value="hot">Hot</option></select></Field>
            <Field label="Seller"><select className="fsel2" value={d.seller_id} onChange={(e) => set('seller_id', e.target.value)}><option value="">— Select Seller —</option>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.telegram ? ` (${s.telegram})` : ''}</option>)}</select></Field>
            <Field label="Buyer (if sold)"><select className="fsel2" value={d.buyer_id} onChange={(e) => set('buyer_id', e.target.value)}><option value="">— None —</option>{buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>

            {d.status === 'sold' && (<>
              <hr className="fdivider" />
              <div className="fseclbl" style={{ color: 'var(--green)' }}>Sale Details</div>
              <Field label="Listing Price ($)"><input className="finput" type="number" min="0" value={d.price_listing} onChange={(e) => set('price_listing', e.target.value)} placeholder="1500" /></Field>
              <Field label="Final Sale Price ($)"><input className="finput" type="number" min="0" value={d.price_final} onChange={(e) => set('price_final', e.target.value)} placeholder="1200" /></Field>
              <Field label="Market Commission (%)"><input className="finput" type="number" min="0" max="100" value={d.commission} onChange={(e) => set('commission', e.target.value)} placeholder="20" /></Field>
              <Field label="Market Earns (auto)"><input className="finput" readOnly value={marketCut ? fmtMoney(marketCut) : ''} placeholder="Auto" /></Field>
            </>)}

            <hr className="fdivider" />
            <div className="fseclbl">Profile Data (Listing)</div>
            <Field label="Age"><input className="finput" value={d.age} onChange={(e) => set('age', e.target.value)} placeholder="22" /></Field>
            <Field label="Origin"><input className="finput" value={d.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Colombia" /></Field>
            <Field label="Smartphone"><input className="finput" value={d.phone} onChange={(e) => set('phone', e.target.value)} placeholder="iPhone 13" /></Field>
            <Field label="% or Salary"><input className="finput" value={d.pct} onChange={(e) => set('pct', e.target.value)} placeholder="70/30 o $500/mo" /></Field>
            <Field label="Time per Day"><input className="finput" value={d.time_per_day} onChange={(e) => set('time_per_day', e.target.value)} placeholder="4h" /></Field>
            <Field label="English Skills (1–10)"><input className="finput" type="number" min="1" max="10" value={d.english} onChange={(e) => set('english', e.target.value)} placeholder="7" /></Field>
            <Field label="Content" full><input className="finput" value={d.content} onChange={(e) => set('content', e.target.value)} placeholder="Explicit, Cosplay, Fitness..." /></Field>
            <Field label="Contract Signed"><select className="fsel2" value={d.contract} onChange={(e) => set('contract', e.target.value)}><option>No</option><option>Yes</option></select></Field>
            <Field label="Working with Agency"><select className="fsel2" value={d.agency} onChange={(e) => set('agency', e.target.value)}><option>No</option><option>Yes</option></select></Field>
            <Field label="When Can She Start"><input className="finput" value={d.start_when} onChange={(e) => set('start_when', e.target.value)} placeholder="Immediately" /></Field>
            <Field label="Social Media Set Up"><select className="fsel2" value={d.social} onChange={(e) => set('social', e.target.value)}><option>No</option><option>Yes</option></select></Field>
            <Field label="Comfortable with TikTok"><select className="fsel2" value={d.tiktok} onChange={(e) => set('tiktok', e.target.value)}><option>No</option><option>Yes</option></select></Field>
            <Field label="Countries Blocked"><input className="finput" value={d.blocked} onChange={(e) => set('blocked', e.target.value)} placeholder="None / US, UK" /></Field>
            <Field label="OF & Skrill Verified"><select className="fsel2" value={d.verified} onChange={(e) => set('verified', e.target.value)}><option>No</option><option>Yes</option><option>Yes (delivered verified)</option></select></Field>
            <Field label="Agency Fee"><input className="finput" value={d.fee} onChange={(e) => set('fee', e.target.value)} placeholder="$500" /></Field>

            <hr className="fdivider" />
            <div className="fseclbl">Internal Notes</div>
            <Field label="Notes (no aparecen en el listing)" full><textarea className="ftxt" value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Comentarios internos..." /></Field>

            <hr className="fdivider" />
            <div className="fseclbl">Photos</div>
            {totalPhotos < 10 && (
              <div className="photo-area" onClick={() => fileRef.current.click()}>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={onFiles} />
                <svg style={{ width: 24, height: 24, color: 'var(--gold-dim)', marginBottom: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                <div className="photo-lbl"><strong>Click para subir</strong> JPG o PNG<br /><span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Podés seleccionar varias</span></div>
              </div>
            )}
            {totalPhotos > 0 && (
              <div className="photo-thumbs">
                {d.photos.map((url, i) => (<div className="pthumb" key={`e${i}`}><img src={url} alt="" /><button className="del" onClick={() => removeExisting(i)}>✕</button>{i === 0 && <div className="main">MAIN</div>}</div>))}
                {md.newFiles.map((f, i) => (<div className="pthumb" key={`n${i}`}><img src={URL.createObjectURL(f)} alt="" /><button className="del" onClick={() => removeNew(i)}>✕</button>{d.photos.length === 0 && i === 0 && <div className="main">MAIN</div>}</div>))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="lp-lbl">Listing Preview</div>
            <div className="lp-box">{buildListing({ ...d, seq: md.seq })}</div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Save Profile'}</button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ m, tab, setTab, contacts, onEdit, onDelete, onTg, onClose, showToast }) {
  const seller = contacts.find((c) => c.id === m.seller_id);
  const buyer = contacts.find((c) => c.id === m.buyer_id);
  const sc = { available: 'green', sold: 'red', reserved: 'orange' };
  const photos = m.photos || [];
  const [mainPhoto, setMainPhoto] = useState(photos[0]);
  useEffect(() => { setMainPhoto(photos[0]); }, [m.id]); // eslint-disable-line
  const [history, setHistory] = useState(null);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    if (tab === 'history' && history === null) {
      supabase.from('activity_log').select('*').eq('model_id', m.id).order('created_at', { ascending: false }).then(({ data }) => setHistory(data || []));
    }
  }, [tab, history, m.id, supabase]);

  const rows = [
    ['Age', m.age], ['Origin', m.origin], ['Smartphone', m.phone], ['% / Salary', m.pct],
    ['Time per Day', m.time_per_day], ['English (1–10)', m.english], ['Content', m.content],
    ['Contract', m.contract], ['Agency', m.agency], ['Can Start', m.start_when],
    ['Social Media', m.social], ['TikTok', m.tiktok], ['Countries Blocked', m.blocked],
    ['OF/Skrill Verified', m.verified],
    ['Seller', seller ? `${seller.name}${seller.telegram ? ' · ' + seller.telegram : ''}` : null],
    ['Buyer', buyer ? buyer.name : null],
    ['Listed', `${fmtDate(m.created_at)} (${daysSince(m.created_at)}d ago)`],
    ['Agency Fee', m.fee],
  ].filter((r) => r[1]);

  function copyListing() { navigator.clipboard.writeText(buildListing(m)).then(() => showToast('Copiado', 'Listing copiado.')); }
  const sr = (Number(m.price_final) || 0) - (Number(m.market_cut) || 0);

  return (
    <div className="overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 840 }}>
        <div className="mhead">
          <div><div className="did">{code(m.seq)}</div><div className="mtitle">{m.name}</div></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-tg btn-sm" onClick={onTg}><svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 13, height: 13 }}><path d={TG_PATH} /></svg>Publish to Telegram</button>
            <button className="btn btn-outline btn-sm" onClick={onEdit}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
            <button className="mclose" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="mbody" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="dtabs">
            {['info', 'listing', 'finance', 'history'].map((t) => (
              <div key={t} className={`dtab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t === 'info' ? 'Profile' : t === 'finance' ? 'Financials' : t.charAt(0).toUpperCase() + t.slice(1)}</div>
            ))}
          </div>

          {tab === 'info' && (
            <div className="dgrid">
              <div>
                <div className="dphoto">{mainPhoto ? <img src={mainPhoto} alt="" /> : 'NO PHOTO'}</div>
                {photos.length > 1 && <div className="dphotos-extra">{photos.map((p, i) => <img key={i} src={p} alt="" onClick={() => setMainPhoto(p)} style={{ borderColor: p === mainPhoto ? 'var(--gold)' : 'var(--border)' }} />)}</div>}
              </div>
              <div>
                <div className="dtags">
                  <span className={`tag tag-${sc[m.status]}`}>{m.status}</span>
                  {m.category && <span className="tag tag-def">{m.category}</span>}
                  {m.priority === 'hot' && <span className="tag tag-gold">HOT</span>}
                </div>
                {rows.map((r) => <div className="drow" key={r[0]}><span className="drow-lbl">{r[0]}</span><span className="drow-val">{r[1]}</span></div>)}
                {m.notes && <div className="dnotes"><strong style={{ color: 'var(--gold-dim)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}>Internal Notes</strong><br /><br />{m.notes}</div>}
              </div>
            </div>
          )}

          {tab === 'listing' && (<><div className="lp-lbl">Ready to share</div><div className="lp-box">{buildListing(m)}</div><button className="btn btn-outline btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={copyListing}>Copy Listing</button></>)}

          {tab === 'finance' && (
            (m.status !== 'sold' || !m.price_final) ? <Empty text="Sin datos financieros. Marcala como vendida y completá los detalles." /> : (
              <div className="fcard">
                <div className="fcard-title">Sale Breakdown</div>
                <div className="frow"><span className="flabel">Listing Price</span><span className="fval">{fmtMoney(m.price_listing)}</span></div>
                <div className="frow"><span className="flabel">Final Sale Price</span><span className="fval">{fmtMoney(m.price_final)}</span></div>
                <div className="frow"><span className="flabel">Commission Rate</span><span className="fval">{m.commission || 0}%</span></div>
                <div className="frow total"><span className="flabel">Market Earns</span><span className="fval gold">{fmtMoney(m.market_cut)}</span></div>
                <div className="frow"><span className="flabel">Seller Receives</span><span className="fval">{fmtMoney(sr)}</span></div>
              </div>
            )
          )}

          {tab === 'history' && (
            history === null ? <div style={{ padding: 20 }}><div className="spinner" /></div> :
            history.length === 0 ? <Empty text="Sin historial." /> : (
              <div className="hlist">{history.map((h) => (<div className="hitem" key={h.id}><div className={`hdot ${h.type || ''}`} /><div><div className="htxt">{h.text}</div><div className="hdate">{fmtDate(h.created_at)}</div></div></div>))}</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ContactModal({ cm, setCm, onSave, onClose, saving }) {
  const set = (k, v) => setCm((p) => ({ ...p, data: { ...p.data, [k]: v } }));
  const title = cm.type === 'seller' ? 'Seller' : cm.type === 'buyer' ? 'Buyer' : 'Lead';
  return (
    <div className="overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="mhead"><div className="mtitle">{cm.editingId ? `Editar ${title}` : `New ${title}`}</div><button className="mclose" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div className="fg">
            <Field label="Full Name *" full><input className="finput" value={cm.data.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre" /></Field>
            <Field label="Telegram Handle" full><input className="finput" value={cm.data.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="@username" /></Field>
            <Field label="Notes" full><textarea className="ftxt" value={cm.data.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Info adicional..." /></Field>
            {cm.type === 'lead' && <Field label="Profile They're Looking For" full><textarea className="ftxt" value={cm.data.looking_for} onChange={(e) => set('looking_for', e.target.value)} placeholder="Qué perfil busca..." /></Field>}
            {cm.type === 'seller' && <Field label="Model Categories" full><input className="finput" value={cm.data.categories} onChange={(e) => set('categories', e.target.value)} placeholder="Fitness, Cosplay..." /></Field>}
          </div>
        </div>
        <div className="mfoot"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-gold" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Save'}</button></div>
      </div>
    </div>
  );
}

function SearchModal({ sm, setSm, buyers, onSave, onClose, saving }) {
  const set = (k, v) => setSm((p) => ({ ...p, data: { ...p.data, [k]: v } }));
  return (
    <div className="overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="mhead"><div className="mtitle">New Active Search</div><button className="mclose" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div className="fg">
            <Field label="Title / Reference" full><input className="finput" value={sm.data.title} onChange={(e) => set('title', e.target.value)} placeholder="Latina, 20-25, English 7+" /></Field>
            <Field label="Buyer" full><select className="fsel2" value={sm.data.buyer_id} onChange={(e) => set('buyer_id', e.target.value)}><option value="">— Select Buyer —</option>{buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Requirements" full><textarea className="ftxt" value={sm.data.requirements} onChange={(e) => set('requirements', e.target.value)} placeholder="Requisitos detallados..." /></Field>
            <Field label="Status" full><select className="fsel2" value={sm.data.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="resolved">Resolved</option></select></Field>
          </div>
        </div>
        <div className="mfoot"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-gold" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Save'}</button></div>
      </div>
    </div>
  );
}

function AlertModal({ am, setAm, models, onSave, onClose, saving }) {
  const set = (k, v) => setAm((p) => ({ ...p, [k]: v }));
  return (
    <div className="overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="mhead"><div className="mtitle">New Alert</div><button className="mclose" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div className="fg">
            <Field label="Title *" full><input className="finput" value={am.title} onChange={(e) => set('title', e.target.value)} placeholder="Seguir con el seller sobre precio" /></Field>
            <Field label="Linked Model (optional)" full><select className="fsel2" value={am.model_id} onChange={(e) => set('model_id', e.target.value)}><option value="">— Sin modelo —</option>{models.map((m) => <option key={m.id} value={m.id}>{code(m.seq)} — {m.name}</option>)}</select></Field>
            <Field label="Notes" full><textarea className="ftxt" value={am.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Detalles..." /></Field>
            <Field label="Due Date"><input className="finput" type="date" value={am.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>
            <Field label="Priority"><select className="fsel2" value={am.priority} onChange={(e) => set('priority', e.target.value)}><option value="normal">Normal</option><option value="high">High</option></select></Field>
          </div>
        </div>
        <div className="mfoot"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-gold" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Save Alert'}</button></div>
      </div>
    </div>
  );
}

function TgModal({ tg, setTg, onSend, onSaveConfig, onClose }) {
  const [token, setToken] = useState(tg.token);
  const [chatId, setChatId] = useState(tg.chatId);
  const m = tg.model;
  const photos = m.photos || [];
  const info = photos.length === 0 ? 'Sin fotos — se envía solo el texto.' : photos.length === 1 ? '1 foto con el listing como caption.' : `${photos.length} fotos como media group, listing en la primera.`;
  return (
    <div className="overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="mhead"><div className="mtitle">Publish to Telegram</div><button className="mclose" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div className="tg-config">
            <div className="tg-config-title">Telegram Bot Setup</div>
            <p><strong style={{ color: 'var(--text)' }}>1.</strong> En Telegram buscá <strong style={{ color: 'var(--gold)' }}>@BotFather</strong> → <code>/newbot</code> → copiá el token.<br /><strong style={{ color: 'var(--text)' }}>2.</strong> Agregá el bot como admin a tu grupo o canal.<br /><strong style={{ color: 'var(--text)' }}>3.</strong> Para el Chat ID: reenviá un mensaje del grupo/canal a <strong style={{ color: 'var(--gold)' }}>@userinfobot</strong> (número negativo como <code>-1001234567</code>), o usá <code>@tucanal</code> si es público.</p>
            <div className="tg-status"><div className={`tg-dot ${token && chatId ? 'ok' : ''}`} /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{token && chatId ? 'Configurado — listo para publicar' : 'Sin configurar'}</span></div>
          </div>
          <div className="fg">
            <Field label="Bot Token" full><input className="finput" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:ABCdef..." /></Field>
            <Field label="Chat ID" full><input className="finput" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890 o @canal" /></Field>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="lp-lbl">Message Preview</div>
            <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 8, letterSpacing: 1 }}>{info}</div>
            <div className="lp-box" style={{ fontSize: 11, lineHeight: 1.8 }}>{buildListing(m)}</div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-outline" onClick={() => onSaveConfig(token.trim(), chatId.trim())}>Save Config</button>
          <button className="btn btn-tg" onClick={() => onSend(token.trim(), chatId.trim())} disabled={tg.sending}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 13, height: 13 }}><path d={TG_PATH} /></svg>
            {tg.sending ? 'Enviando...' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
