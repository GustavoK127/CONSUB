// Read only: use the same public client configuration as the frontend.
// Does not load or use an administrative key, saved login or user session.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile(new URL('../../.env.local', import.meta.url), 'utf8'))
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#'))
  .map((line) => {
    const at = line.indexOf('=');
    return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
  }));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert(url && key, 'Missing frontend public Supabase configuration');
const settingsResponse = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: key } });
assert.equal(settingsResponse.status, 200, 'Auth settings endpoint');
const settings = await settingsResponse.json();
assert.equal(settings.disable_signup, false, 'Public signup must be enabled');
assert.equal(settings.mailer_autoconfirm, false, 'Email confirmation must be required');
assert.equal(settings.external?.email, true, 'Email provider must be enabled');
assert.equal(settings.external?.anonymous_users, false, 'Anonymous sign-in must be disabled');
console.log('PASS: public signup enabled; email confirmation required; anonymous sign-in disabled');

for (const table of ['pacientes', 'inscricoes_fila', 'solicitacoes_consulta', 'solicitacoes_transporte', 'user_roles', 'perfis_usuarios']) {
  const response = await fetch(new URL(`/rest/v1/${table}?select=*&limit=1`, url), { headers: { apikey: key } });
  assert(!response.ok, `Anonymous access must be denied on ${table}`);
  const error = await response.json();
  assert.equal(error.code, '42501', `Expected privilege denial on ${table}`);
  console.log(`PASS: anonymous REST SELECT denied on ${table}`);
}
const roleResponse = await fetch(new URL('/rest/v1/rpc/meu_papel', url), {
  method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}'
});
assert(!roleResponse.ok, 'Anonymous role RPC must be denied');
const roleError = await roleResponse.json();
assert.equal(roleError.code, '42501');
console.log('PASS: anonymous REST RPC denied');
