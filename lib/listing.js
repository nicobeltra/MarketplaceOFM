// Arma el texto del listing de una modelo. Se usa en el cliente (preview / canal)
// y en el servidor (envío desde la cuenta personal), así queda idéntico en ambos.
export function buildListing(m, emoji = '🌴', showSku = true) {
  const e = emoji || '🌴';
  const head = showSku ? `Model ${m.sku || '(nuevo)'}\n\n` : '';
  return `${head}${(m.name || '').toUpperCase()}

${e} Age: ${m.age || '—'}
${e} Origin: ${m.origin || '—'}
${e} Smartphone: ${m.phone || '—'}
${e} % or salary: ${m.pct || '—'}
${e} Time per day: ${m.time_per_day || '—'}
${e} English skills (1–10): ${m.english || '—'}
${e} Content: ${m.content || '—'}
${e} Contract signed: ${m.contract || '—'}
${e} Working with an agency currently: ${m.agency || '—'}
${e} When can she start: ${m.start_when || '—'}
${e} Social media set up: ${m.social || '—'}
${e} Comfortable with TikTok: ${m.tiktok || '—'}
${e} Any countries blocked?: ${m.blocked || '—'}
${e} OF and Skrill verified: ${m.verified || '—'}

💵 Agency Fee: ${m.fee || '—'}`.trim();
}
