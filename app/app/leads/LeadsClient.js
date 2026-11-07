'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const DAILY = 50;
const FOLLOWUP_DAYS = [3, 4]; // tras el toque 1 → +3 días; tras el 2 → +4 días; tras el 3 no hay más
const SEGMENTS = { nueva: 'Nueva', activa: 'Activa en OF', ex: 'Ex-modelo' };

// Plantillas por segmento y toque. Editalas a tu estilo. {h} = usuario.
const TEMPLATES = {
  nueva: [
    'Hola! Vi tu perfil y quería escribirte. Ayudo a chicas que quieren empezar como creadoras de contenido a encontrar una agencia confiable y las acompaño en todo el proceso. ¿Te interesaría que te cuente cómo funciona? Es +18 y sin compromiso.',
    'Hola de nuevo! Te escribí hace unos días. Si te da curiosidad cómo funciona (qué hace una agencia, qué condiciones mirar y cuánto cuesta), te lo explico en 2 minutos. ¡Sin presión!',
    'Último mensaje, prometido 😊 Si en algún momento querés info, acá estoy. ¡Mucho éxito!',
  ],
  activa: [
    'Hola! Vi tu cuenta. Si ya trabajás como creadora y sentís que tu agencia actual no te rinde o las condiciones no son claras, te ayudo a evaluar opciones y a cambiar con seguridad. ¿Te interesa que lo hablemos?',
    'Hola! Retomo mi mensaje. Si querés, en una llamada corta te cuento qué opciones hay y qué condiciones mirar, para que lo evalúes tranquila.',
    'Último mensaje por mi parte. Si más adelante querés comparar opciones, escribime cuando quieras. ¡Éxitos!',
  ],
  ex: [
    'Hola! Hace tiempo que no hablamos. Estoy conectando chicas con agencias de confianza y pensé en vos. ¿Querés que te cuente?',
    'Hola! Te escribí hace unos días. Si te interesa retomar, contame cómo estás y vemos opciones.',
    'Último mensaje. Si querés volver a trabajar juntas, acá estoy. ¡Un abrazo!',
  ],
};

const cleanHandle = (s) =>
  String(s || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@/, '').replace(/[^a-z0-9._]/g, '');

// Acepta una lista de @usuarios (uno por línea) o un CSV con encabezado (username/handle, followers, bio)
function parseInput(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = lines[0].toLowerCase();
  const isCsv = lines[0].includes(',') && /(user|handle)/.test(first);
  if (!isCsv) return lines.map((l) => ({ handle: cleanHandle(l.split(/[\s,;]/)[0]) })).filter((r) => r.handle);
  const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const iU = head.findIndex((h) => /^(username|handle|user)/.test(h));
  const iF = head.findIndex((h) => h.startsWith('follower'));
  const iB = head.findIndex((h) => /^(bio|biography)/.test(h));
  return lines.slice(1).map((l) => {
    const c = split(l);
    return { handle: cleanHandle(c[iU]), followers: iF >= 0 ? parseInt(c[iF], 10) || null : null, bio: iB >= 0 ? c[iB] || null : null };
  }).filter((r) => r.handle);
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

export default function LeadsClient() {
  const supabase = useRef(createClient()).current;
  const [uid, setUid] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ new: 0, contacted: 0, replied: 0, signed: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [raw, setRaw] = useState('');
  const [seed, setSeed] = useState('');
  const [segment, setSegment] = useState('nueva');
  const [minF, setMinF] = useState('');
  const [maxF, setMaxF] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);
    const [{ data: q }, { data: all }] = await Promise.all([
      supabase.from('leads').select('*').eq('queued_on', todayStr()).order('created_at'),
      supabase.from('leads').select('status'),
    ]);
    setQueue(q || []);
    const s = { new: 0, contacted: 0, replied: 0, signed: 0 };
    (all || []).forEach((l) => { if (s[l.status] !== undefined) s[l.status]++; if (l.status === 'call') s.replied++; });
    setStats(s);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function doImport() {
    let rows = parseInput(raw);
    const lo = parseInt(minF, 10), hi = parseInt(maxF, 10);
    if (lo) rows = rows.filter((r) => r.followers == null || r.followers >= lo);
    if (hi) rows = rows.filter((r) => r.followers == null || r.followers <= hi);
    const seen = new Set();
    rows = rows.filter((r) => (seen.has(r.handle) ? false : seen.add(r.handle)));
    if (!rows.length) { setMsg('No encontré usuarios válidos para importar.'); return; }
    setBusy(true);
    const payload = rows.map((r) => ({ user_id: uid, handle: r.handle, followers: r.followers ?? null, bio: r.bio ?? null, segment, source: seed.replace(/^@/, '') || null }));
    let added = 0;
    for (let i = 0; i < payload.length; i += 500) {
      const { data, error } = await supabase.from('leads').upsert(payload.slice(i, i + 500), { onConflict: 'user_id,handle', ignoreDuplicates: true }).select('id');
      if (error) { setMsg('Error: ' + error.message); setBusy(false); return; }
      added += data?.length || 0;
    }
    setMsg(`${added} leads nuevos importados (${rows.length - added} ya existían).`);
    setRaw('');
    setBusy(false);
    load();
  }

  async function generateToday() {
    setBusy(true);
    const t = todayStr();
    const { data: already } = await supabase.from('leads').select('id').eq('queued_on', t);
    let have = already?.length || 0;
    if (have >= DAILY) { setMsg('La lista de hoy ya está completa.'); setBusy(false); return; }
    // 1) seguimientos vencidos primero
    const { data: due } = await supabase.from('leads').select('id').eq('status', 'contacted').lt('touches', 3)
      .lte('next_followup_at', new Date().toISOString()).or(`queued_on.is.null,queued_on.neq.${t}`)
      .order('next_followup_at').limit(DAILY - have);
    let ids = (due || []).map((d) => d.id);
    // 2) completar con leads nuevos
    if (have + ids.length < DAILY) {
      const { data: fresh } = await supabase.from('leads').select('id').eq('status', 'new').is('queued_on', null)
        .order('created_at').limit(DAILY - have - ids.length);
      ids = ids.concat((fresh || []).map((d) => d.id));
    }
    if (!ids.length) { setMsg('No hay leads disponibles. Importá más seguidores.'); setBusy(false); return; }
    await supabase.from('leads').update({ queued_on: t }).in('id', ids);
    setMsg(`${ids.length} agregados a la lista de hoy.`);
    setBusy(false);
    load();
  }

  async function patch(lead, fields) {
    setQueue((q) => q.map((l) => (l.id === lead.id ? { ...l, ...fields } : l)));
    await supabase.from('leads').update(fields).eq('id', lead.id);
    load();
  }
  const markSent = (l) => {
    const touches = l.touches + 1;
    patch(l, { status: 'contacted', touches, last_contacted_at: new Date().toISOString(), next_followup_at: touches < 3 ? addDays(FOLLOWUP_DAYS[touches - 1]) : null });
  };
  const copyMsg = (l) => {
    const tpl = TEMPLATES[l.segment]?.[Math.min(l.touches, 2)] || TEMPLATES.nueva[0];
    navigator.clipboard.writeText(tpl.replace('{h}', l.handle)).then(() => setMsg(`Mensaje ${Math.min(l.touches, 2) + 1} copiado para @${l.handle}`));
  };

  const pending = queue.filter((l) => !(l.status !== 'new' && l.status !== 'contacted') && !(l.last_contacted_at && l.last_contacted_at.slice(0, 10) === todayStr()));
  const sentToday = queue.filter((l) => l.last_contacted_at && l.last_contacted_at.slice(0, 10) === todayStr()).length;
  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 4, fontFamily: 'inherit', fontSize: 12 };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="topbar-title">Reclutamiento · Lista diaria</div>
        <Link href="/app" className="btn btn-ghost btn-sm">← Volver</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        {[['Sin contactar', stats.new], ['En seguimiento', stats.contacted], ['Respondieron', stats.replied], ['Firmadas', stats.signed], ['Enviados hoy', `${sentToday}/${queue.length}`]].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontSize: 22, color: 'var(--gold)', fontFamily: 'var(--fd)' }}>{v}</div>
          </div>
        ))}
      </div>

      {msg && <div style={{ background: 'var(--gold-glow)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 4, marginBottom: 14, fontSize: 12 }}>{msg}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div className="sb-lbl" style={{ padding: 0, marginBottom: 8 }}>1 · Importar seguidores</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          Pegá la exportación de seguidores de tu cuenta semilla (lista de @usuarios, o CSV con columnas username, followers, bio). Se eliminan los duplicados y los que ya cargaste antes.
        </div>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={5} placeholder={'@usuario1\n@usuario2\n...  o CSV: username,followers,bio'} style={{ ...inp, width: '100%', resize: 'vertical', marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, width: 150 }} placeholder="Cuenta semilla" value={seed} onChange={(e) => setSeed(e.target.value)} />
          <select style={inp} value={segment} onChange={(e) => setSegment(e.target.value)}>{Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input style={{ ...inp, width: 100 }} placeholder="Seg. mín." value={minF} onChange={(e) => setMinF(e.target.value)} />
          <input style={{ ...inp, width: 100 }} placeholder="Seg. máx." value={maxF} onChange={(e) => setMaxF(e.target.value)} />
          <button className="btn btn-gold btn-sm" disabled={busy || !raw.trim() || !uid} onClick={doImport}>Importar</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="sb-lbl" style={{ padding: 0 }}>2 · Lista de hoy ({queue.length}/{DAILY})</div>
        <button className="btn btn-gold btn-sm" disabled={busy || !uid} onClick={generateToday}>Generar lista de hoy</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Primero van los seguimientos vencidos (a los 3 y 4 días); el resto se completa con leads nuevos. Antes de escribir, verificá que sea mayor de 18.
      </div>

      {!queue.length && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Todavía no generaste la lista de hoy.</div>}

      {queue.map((l) => {
        const sentNow = l.last_contacted_at && l.last_contacted_at.slice(0, 10) === todayStr();
        const done = sentNow || ['replied', 'call', 'signed', 'discarded'].includes(l.status);
        return (
          <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 6, opacity: done ? 0.55 : 1 }}>
            <a href={`https://instagram.com/${l.handle}`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none', minWidth: 150 }}>@{l.handle}</a>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{SEGMENTS[l.segment]} · toque {Math.min(l.touches + 1, 3)}/3{l.followers ? ` · ${l.followers.toLocaleString()} seg.` : ''}{l.source ? ` · de @${l.source}` : ''}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => copyMsg(l)}>Copiar msj</button>
              <button className="btn btn-gold btn-sm" disabled={sentNow || l.touches >= 3} onClick={() => markSent(l)}>Enviado</button>
              <button className="btn btn-ghost btn-sm" onClick={() => patch(l, { status: 'replied', next_followup_at: null })}>Respondió</button>
              <button className="btn btn-ghost btn-sm" onClick={() => patch(l, { status: 'signed', next_followup_at: null })}>Firmó</button>
              <button className="btn btn-danger btn-sm" onClick={() => patch(l, { status: 'discarded', next_followup_at: null })}>Descartar</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
