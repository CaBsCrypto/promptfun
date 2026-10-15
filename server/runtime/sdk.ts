// Executed only in the opaque-origin generated frame. It never receives a session, API key or wallet.
export const APP_SDK = `(() => {
 const pending = new Map(); let sequence = 0;
 const requestId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
 const call = (method, args = {}) => new Promise((resolve,reject) => {
   const id = String(++sequence); const timeout = setTimeout(() => {pending.delete(id); reject(new Error('La operación agotó su tiempo de espera.'));},60000);
   pending.set(id,{resolve,reject,timeout}); parent.postMessage({channel:'promptfun.sdk.v1',id,method,args},'*');
 });
 addEventListener('message',event => {
   if(event.source !== parent || !event.data || event.data.channel !== 'promptfun.sdk.result.v1') return;
   const p = pending.get(event.data.id); if(!p) return; clearTimeout(p.timeout); pending.delete(event.data.id);
   event.data.error ? p.reject(new Error(event.data.error)) : p.resolve(event.data.result);
 });
 const records = {
   list:collection=>call('records.list',{collection}), get:(collection,id)=>call('records.get',{collection,id}),
   create:(collection,data)=>call('records.create',{collection,data,request_id:requestId()}), update:(collection,id,data)=>call('records.update',{collection,id,data}),
   delete:(collection,id)=>call('records.delete',{collection,id})
 };
 window.promptfun = Object.freeze({records, auth:{session:()=>call('auth.session')},
   files:{list:()=>call('files.list'),upload:async file=>{
     if(file.size>5242880)throw new Error('El máximo por archivo es 5 MiB.');
     const bytes=new Uint8Array(await file.arrayBuffer()); let binary=''; for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
     return call('files.upload',{name:file.name,mime_type:file.type||'application/octet-stream',base64:btoa(binary),request_id:requestId()});
   },download:id=>call('files.download',{id}),delete:id=>call('files.delete',{id})}, connectors:{invoke:(name,args)=>call('connectors.invoke',{name,args})}
 });
})();`;

// This bridge lives in a trusted document outside the generated frame.
export const RUNTIME_BRIDGE = `(() => {
 const frame=document.getElementById('app'); const base=location.pathname.split('/versions/')[0];
 const access=new URLSearchParams(location.search).get('preview_token'); const version=document.body.dataset.version;
 let csrf=null; const status=document.getElementById('status');
 const api=async(path,method='GET',body,requestId) => {
   const headers={'Content-Type':'application/json','X-App-Version':version}; if(csrf)headers['X-CSRF-Token']=csrf;
   if(access)headers['X-Preview-Token']=access;
   if(requestId)headers['Idempotency-Key']=requestId;
   const serialized=body===undefined?undefined:JSON.stringify(body);
   for(let attempt=0;attempt<2;attempt++){
    let response,data;
    try{response=await fetch(base+'/api'+path,{method,headers,credentials:'same-origin',body:serialized,signal:AbortSignal.timeout(20000)});}
    catch(error){if(requestId&&attempt===0)continue;throw error;}
    try{data=await response.json();}catch(error){if(requestId&&response.ok&&attempt===0)continue;throw error;}
    if(!response.ok)throw new Error(data.error?.message||'No se pudo completar la operación.');return data;
   }
 };
 const refresh=async()=>{const data=await api('/session');csrf=data.csrf_token;status.textContent=data.user?'Sesión de la app: '+data.user.email:'Inicia sesión para guardar tus datos.';return data;};
 document.getElementById('auth').addEventListener('submit',async event=>{
   event.preventDefault();try{const form=event.currentTarget;const data=await api('/auth/'+event.submitter.value,'POST',{email:form.email.value,password:form.password.value});if(data.confirmation_required){document.getElementById('verify').hidden=false;form.password.value='';status.textContent='Introduce el código enviado a tu correo y luego inicia sesión.';return;}await refresh();form.password.value='';frame.contentWindow.postMessage({channel:'promptfun.auth.changed.v1'},'*');}catch(error){status.textContent=error.message;}
 });
 document.getElementById('verify').addEventListener('submit',async event=>{
  event.preventDefault();try{const form=event.currentTarget;const email=document.getElementById('auth').email.value;const action=event.submitter.value;
   await api('/auth/'+action,'POST',{email,otp:form.otp.value});
   if(action==='verify-email'){form.hidden=true;form.otp.value='';status.textContent='Correo confirmado. Inicia sesión con tu contraseña.';}else status.textContent='Código reenviado. Revisa tu correo.';
  }catch(error){status.textContent=error.message;}
 });
 document.getElementById('logout').onclick=async()=>{try{await api('/auth/logout','POST',{});await refresh();frame.contentWindow.postMessage({channel:'promptfun.auth.changed.v1'},'*');}catch(error){status.textContent=error.message;}};
 const methods={
  'auth.session':()=>refresh().then(s=>({user:s.user})),
  'records.list':a=>api('/records/'+encodeURIComponent(a.collection)),
  'records.get':a=>api('/records/'+encodeURIComponent(a.collection)+'/'+encodeURIComponent(a.id)),
  'records.create':a=>api('/records/'+encodeURIComponent(a.collection),'POST',{data:a.data},a.request_id),
  'records.update':a=>api('/records/'+encodeURIComponent(a.collection)+'/'+encodeURIComponent(a.id),'PATCH',{data:a.data}),
  'records.delete':a=>api('/records/'+encodeURIComponent(a.collection)+'/'+encodeURIComponent(a.id),'DELETE',{}),
  'files.list':()=>api('/files'), 'files.upload':a=>api('/files','POST',a,a.request_id), 'files.download':a=>api('/files/'+encodeURIComponent(a.id)),
  'files.delete':a=>api('/files/'+encodeURIComponent(a.id),'DELETE',{}),
  'connectors.invoke':a=>api('/connectors','POST',a)
 };
 let inflight=0;
 addEventListener('message',async event=>{
   if(event.source!==frame.contentWindow || event.origin!=='null' || !event.data || event.data.channel!=='promptfun.sdk.v1')return;
   const {id,method,args}=event.data; if(typeof id!=='string'||id.length>80||typeof method!=='string'||!Object.hasOwn(methods,method)||!args||typeof args!=='object'||Array.isArray(args))return;
   if(inflight>=4 || JSON.stringify(args).length>7100000){frame.contentWindow.postMessage({channel:'promptfun.sdk.result.v1',id,error:'Demasiadas operaciones o solicitud demasiado grande.'},'*');return;}
   const handler=methods[method]; inflight++;
   try{const result=await handler(args);frame.contentWindow.postMessage({channel:'promptfun.sdk.result.v1',id,result},'*');}
   catch(error){frame.contentWindow.postMessage({channel:'promptfun.sdk.result.v1',id,error:error.message},'*');}
   finally{inflight--;}
 }); refresh().catch(error=>status.textContent=error.message);
})();`;
