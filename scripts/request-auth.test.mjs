import test from 'node:test';
import assert from 'node:assert/strict';
import {readWorkspaceAction} from '../lib/workspace-request.ts';
import {publicAuthConfig,loadPublicAuthConfig} from '../lib/public-auth-config.ts';

const request = (body, headers = {}) => new Request('https://maestria.test/api/workspace', {
  method: 'POST', headers: {'content-type': 'application/json', ...headers}, body,
});

test('operação limita bytes reais sem depender de Content-Length, inclusive UTF-8', async () => {
  const body = JSON.stringify({type: 'settings', name: 'á'.repeat(30)});
  assert.ok(body.length < 80);
  await assert.rejects(readWorkspaceAction(request(body), 80), error => error.status === 413);
  await assert.rejects(readWorkspaceAction(request('{}', {'content-length': '200001'})), error => error.status === 413);
  assert.deepEqual(await readWorkspaceAction(request('{"type":"order","id":"stable"}')), {type:'order',id:'stable'});
});

test('operação rejeita JSON malformado, tipos vazios e corpo incompatível antes de alterar dados', async () => {
  for (const body of ['null', '[]', '{}', '{', '{"type":{}}']) {
    await assert.rejects(readWorkspaceAction(request(body)), error => error.status === 400);
  }
  await assert.rejects(readWorkspaceAction(request('{"type":"order"}', {'content-type':'text/plain'})), error => error.status === 415);
});

test('configuração pública recusa chave privilegiada e destino sem HTTPS', () => {
  const jwt = role => 'header.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
  for (const key of ['sb_secret_private', jwt('service_role'), 'invalid']) {
    assert.equal(publicAuthConfig({url:'https://project.supabase.co',key}), null);
  }
  assert.equal(publicAuthConfig({url:'http://project.supabase.co',key:'sb_publishable_test'}),null);
  assert.equal(publicAuthConfig({url:'https://user:password@project.supabase.co',key:'sb_publishable_test'}),null);
  assert.equal(publicAuthConfig({url:'https://project.supabase.co',key:jwt('anon')}).key,jwt('anon'));
});

test('acesso offline reutiliza somente configuração pública previamente carregada e permite renovar online', async () => {
  const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
  const stored = new Map();
  globalThis.localStorage = {getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
  const config = {url:'https://project.supabase.co',key:'sb_publishable_test'};
  try {
    globalThis.fetch = async () => Response.json(config);
    assert.deepEqual(await loadPublicAuthConfig(),config);
    globalThis.fetch = async () => {throw new TypeError('offline')};
    assert.deepEqual(await loadPublicAuthConfig(),config);
    globalThis.fetch = async () => Response.json({error:'Configuração removida.'},{status:503});
    await assert.rejects(loadPublicAuthConfig(),/Configuração removida/);
    globalThis.fetch = async () => Response.json({url:config.url,key:'sb_secret_rejected'});
    await assert.rejects(loadPublicAuthConfig(),/inválida/);
    assert.deepEqual(JSON.parse([...stored.values()][0]),config);
    stored.clear();
    globalThis.fetch = async () => {throw new TypeError('offline')};
    await assert.rejects(loadPublicAuthConfig(),/Abra o painel com internet/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
