import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPreviewToken, artifactCsp, escapeHtml } from '../server/runtime/security.js';
import { APP_SDK, RUNTIME_BRIDGE } from '../server/runtime/sdk.js';

const key='runtime-test-secret';
function token(claims:Record<string,unknown>){const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');}
test('preview grant is bound to app, version, owner and expiry',()=>{
 const valid=token({type:'preview',app_id:'a',version_id:'v',sub:'owner',exp:Math.floor(Date.now()/1000)+100});
 assert.equal(verifyPreviewToken(valid,key,'a','v').sub,'owner');
 for(const [app,version,secret] of [['other','v',key],['a','other',key],['a','v','other-secret']])assert.throws(()=>verifyPreviewToken(valid,secret,app,version));
 assert.throws(()=>verifyPreviewToken(token({type:'preview',app_id:'a',version_id:'v',sub:'owner',exp:1}),key,'a','v'));
 assert.throws(()=>verifyPreviewToken(valid+'.extra',key,'a','v'));
});
test('untrusted artifacts have an opaque origin, no network and no privileged navigation',()=>{
 const policy=artifactCsp('http://127.0.0.1:4000','http://localhost:3000');
 assert.match(policy,/sandbox allow-scripts allow-forms/);assert.doesNotMatch(policy,/allow-same-origin|allow-top-navigation|unsafe-eval/);
 assert.match(policy,/connect-src 'none'/);assert.match(policy,/form-action 'none'/);
});
test('bridge validates sender window and opaque origin and SDK cannot call arbitrary endpoints',()=>{
 assert.match(RUNTIME_BRIDGE,/event.source!==frame.contentWindow/);assert.match(RUNTIME_BRIDGE,/event.origin!=='null'/);
 assert.doesNotMatch(APP_SDK,/session_id|csrf_token|apiKey|signTransaction|wallet/);
 assert.match(RUNTIME_BRIDGE,/const handler=methods\[method\]/);
});
test('generated project titles cannot inject markup into the trusted runtime',()=>assert.equal(escapeHtml('<img src=x onerror="steal()">'), '&lt;img src=x onerror=&quot;steal()&quot;&gt;'));
