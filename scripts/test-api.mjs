import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const dll = resolve(root, 'backend/bin/Debug/net8.0/UsuariosCrud.Api.dll');
await mkdir(resolve(root, '.local'), { recursive: true });
const temp = await mkdtemp(resolve(root, '.local/api-test-'));
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
let processHandle;
let output = '';

async function start() {
  output = '';
  processHandle = spawn('dotnet', [dll], {
    cwd: temp,
    windowsHide: true,
    env: { ...process.env, ConnectionStrings__UsersDb: `Data Source=${resolve(temp, 'users.db')}`, ASPNETCORE_URLS: base, ASPNETCORE_ENVIRONMENT: 'Production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.on('data', data => { output += data; });
  processHandle.stderr.on('data', data => { output += data; });
  processHandle.on('error', error => { output += error.message; });
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    if (processHandle.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`API não iniciou: ${output}`);
}

async function stop() {
  if (!processHandle || processHandle.exitCode !== null) return;
  const exited = once(processHandle, 'exit');
  processHandle.kill();
  await exited;
}

async function request(path = '', method = 'GET', body) {
  const response = await fetch(`${base}/api/users${path}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, location: response.headers.get('location'), body: response.status === 204 ? null : await response.json() };
}

test('Contrato HTTP e persistência SQLite', { timeout: 45000 }, async t => {
  t.after(stop);
  await start();
  let id;
  await t.test('lista inicial vazia e validação no servidor', async () => {
    assert.deepEqual((await request()).body, []);
    const invalid = await request('', 'POST', { name: ' ', email: 'invalido' });
    assert.equal(invalid.status, 400);
    assert.ok(invalid.body.errors.name);
    assert.ok(invalid.body.errors.email);
    assert.equal((await request('', 'POST', { name: 'a'.repeat(121), email: 'teste@example.com' })).status, 400);
  });
  await t.test('cria, normaliza e consulta usuário', async () => {
    const created = await request('', 'POST', { name: ' Ana Souza ', email: ' ANA@EXAMPLE.COM ', isActive: true });
    assert.equal(created.status, 201);
    id = created.body.id;
    assert.equal(created.location, `/api/users/${id}`);
    assert.equal(created.body.name, 'Ana Souza');
    assert.equal(created.body.email, 'ana@example.com');
    assert.equal((await request(`/${id}`)).body.isActive, true);
  });
  await t.test('bloqueia duplicidade e concorrência de cadastros', async () => {
    assert.equal((await request('', 'POST', { name: 'Outra Ana', email: 'Ana@Example.com' })).status, 409);
    const race = await Promise.all([1, 2].map(() => request('', 'POST', { name: 'Concorrente', email: 'race@example.com' })));
    assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
  });
  await t.test('edita dados e impede conflito de e-mail na edição', async () => {
    const updated = await request(`/${id}`, 'PUT', { name: 'Ana Lima', email: 'ana.lima@example.com', isActive: false });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.isActive, false);
    assert.equal((await request(`/${id}`, 'PUT', { name: 'Ana Lima', email: 'RACE@example.com' })).status, 409);
    assert.equal((await request(`/${id}`)).body.email, 'ana.lima@example.com');
  });
  await t.test('mantém os dados depois de reiniciar a API', async () => {
    await stop(); await start();
    const persisted = await request(`/${id}`);
    assert.equal(persisted.body.name, 'Ana Lima');
    assert.equal(persisted.body.isActive, false);
  });
  await t.test('exclui e retorna 404 para registros inexistentes', async () => {
    assert.equal((await request(`/${id}`, 'DELETE')).status, 204);
    assert.equal((await request(`/${id}`)).status, 404);
    assert.equal((await request(`/${id}`, 'DELETE')).status, 404);
    assert.equal((await request(`/${id}`, 'PUT', { name: 'Ana Lima', email: 'ana@example.com' })).status, 404);
    assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  });
  await t.test('recusa inicialização sem conexão no ambiente', async () => {
    const env = { ...process.env, ASPNETCORE_ENVIRONMENT: 'Production' };
    delete env.ConnectionStrings__UsersDb;
    const missing = spawn('dotnet', [dll], { cwd: temp, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '';
    missing.stderr.on('data', data => { error += data; });
    missing.stdout.resume();
    const [exitCode] = await once(missing, 'exit');
    assert.notEqual(exitCode, 0);
    assert.match(error, /ambiente ConnectionStrings__UsersDb/);
  });
});
