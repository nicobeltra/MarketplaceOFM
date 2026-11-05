// Genera el TG_SESSION (string de sesión) de TU cuenta de Telegram.
// Se corre UNA vez en tu computadora:  node scripts/tg-session.mjs
// Necesitás api_id y api_hash de https://my.telegram.org  (API development tools).
// El resultado se pega como variable de entorno TG_SESSION en Vercel. NO lo subas a GitHub.
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });
const apiId = Number(await rl.question('api_id: '));
const apiHash = (await rl.question('api_hash: ')).trim();

const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 3 });
await client.start({
  phoneNumber: () => rl.question('Tu número (con +código de país): '),
  phoneCode: () => rl.question('Código que te llegó a Telegram: '),
  password: () => rl.question('Contraseña de verificación en dos pasos (Enter si no tenés): '),
  onError: (e) => console.error(e),
});
console.log('\n=== TG_SESSION (copiala, es como una contraseña de tu cuenta) ===\n');
console.log(client.session.save());
console.log('\n=================================================================\n');
await client.disconnect();
rl.close();
process.exit(0);
