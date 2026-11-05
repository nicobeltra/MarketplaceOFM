import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { createClient } from '@/lib/supabase/server';
import { buildListing } from '@/lib/listing';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Acepta "@user", "user", "https://t.me/user" o "+5491122334455"
function normalizeTarget(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
  if (t.startsWith('+') || /^\d+$/.test(t)) return t;
  return t.replace(/^@/, '');
}

async function downloadPhoto(url, i) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No pude descargar la foto ${i + 1}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = (r.headers.get('content-type') || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
  return new CustomFile(`photo${i + 1}.${ext}`, buf.length, '', buf);
}

// POST { modelId, contactId } -> manda el listing a UN contacto desde tu cuenta personal.
// El front lo llama una vez por contacto, con pausa entre cada uno.
export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  const session = process.env.TG_SESSION;
  if (!apiId || !apiHash || !session) {
    return NextResponse.json({ ok: false, error: 'Falta configurar TG_API_ID / TG_API_HASH / TG_SESSION en Vercel.' }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 }); }
  const { modelId, contactId } = body || {};
  if (!modelId || !contactId) return NextResponse.json({ ok: false, error: 'Faltan modelId o contactId' }, { status: 400 });

  // RLS + filtro explícito: solo datos del usuario logueado
  const [{ data: model }, { data: contact }, { data: settings }] = await Promise.all([
    supabase.from('models').select('*').eq('id', modelId).eq('user_id', user.id).maybeSingle(),
    supabase.from('contacts').select('*').eq('id', contactId).eq('user_id', user.id).maybeSingle(),
    supabase.from('settings').select('listing_emoji').eq('user_id', user.id).maybeSingle(),
  ]);
  if (!model) return NextResponse.json({ ok: false, error: 'Modelo no encontrada' }, { status: 404 });
  if (!contact) return NextResponse.json({ ok: false, error: 'Contacto no encontrado' }, { status: 404 });
  // Solo a contactos que marcaste explícitamente como destinatarios
  if (!contact.receives_listings) return NextResponse.json({ ok: false, error: `${contact.name} no está marcado para recibir listings.` }, { status: 400 });
  if (!contact.telegram) return NextResponse.json({ ok: false, error: `${contact.name} no tiene Telegram cargado.` }, { status: 400 });

  // A los dueños de markets se les manda SIN el número de modelo (showSku=false)
  const text = buildListing(model, settings?.listing_emoji || '🌴', false);
  const photoUrls = (model.photos || []).slice(0, 10);

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 2 });
  client.setLogLevel('none');
  try {
    await client.connect();
    const entity = await client.getEntity(normalizeTarget(contact.telegram));

    if (photoUrls.length === 0) {
      await client.sendMessage(entity, { message: text });
    } else {
      const files = await Promise.all(photoUrls.map(downloadPhoto));
      const captionFits = text.length <= 1024;
      if (files.length === 1) {
        await client.sendFile(entity, { file: files[0], caption: captionFits ? text : '' });
      } else {
        await client.sendFile(entity, { file: files, caption: captionFits ? [text] : [''] });
      }
      if (!captionFits) await client.sendMessage(entity, { message: text });
    }

    await supabase.from('activity_log').insert({
      user_id: user.id, model_id: model.id, text: `Enviado a ${contact.name} por Telegram (cuenta personal)`, type: 'orange',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e?.errorMessage || e?.message || 'Falló el envío';
    const flood = /FLOOD_WAIT_(\d+)/.exec(msg);
    return NextResponse.json(
      { ok: false, error: flood ? `Telegram pide esperar ${flood[1]}s antes de enviar más.` : `${contact.name}: ${msg}` },
      { status: 502 }
    );
  } finally {
    try { await client.disconnect(); } catch {}
    try { await client.destroy(); } catch {}
  }
}
