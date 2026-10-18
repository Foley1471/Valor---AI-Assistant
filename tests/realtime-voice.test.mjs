import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceHandler } from '../base44/functions/valor-voice/service.js';
import { createRealtimeVoice } from '../src/lib/realtimeVoice.js';

function backend({user = {id:'owner'}, enabled='true', rows=[], upstream}={}) {
  const updates=[], calls=[], pending=[];
  const store={filter:async()=>rows,create:async data=>{const row={id:'local-session',...data};rows.push(row);return row;},get:async id=>rows.find(r=>r.id===id),update:async(id,data)=>updates.push({id,...data})};
  const client={auth:{me:async()=>user},asServiceRole:{entities:{VoiceSession:store}},entities:{UserPreference:{filter:async()=>[]}}};
  const secrets={OPENAI_API_KEY:'private-test-value',VALOR_VOICE_ENABLED:enabled,VALOR_VOICE_ALLOWED_USER_IDS:'owner'};
  const handler=createVoiceHandler({clientFromRequest:()=>client,secret:k=>secrets[k],now:()=>1000000,waitUntil:p=>pending.push(p),sleep:()=>new Promise(()=>{}),fetcher:async(url,opts)=>{calls.push({url,opts});return upstream?upstream(url,opts):new Response('v=0 answer',{headers:{location:'/v1/realtime/calls/rtc_test'}});}});
  return {calls,updates,pending,request:body=>handler(new Request('https://example.test',{method:'POST',body:JSON.stringify(body)}))};
}
test('anonymous and disabled users cannot initiate paid calls',async()=>{
  for(const options of [{user:null},{user:{id:'stranger'}},{enabled:'false'}]){
    const b=backend(options);const r=await b.request({action:'start',consent:true,sdp:'v=0 offer'});
    assert.ok([401,403].includes(r.status));assert.equal(b.calls.length,0);
  }
});
test('stop verifies ownership and does not accept arbitrary upstream IDs',async()=>{
  const b=backend({rows:[{id:'other',user_id:'someone',state:'active',call_id:'rtc_other'}]});
  assert.equal((await b.request({action:'stop',sessionId:'other'})).status,404);assert.equal(b.calls.length,0);
});
test('daily allowance rejects before provider call',async()=>{
  const b=backend({rows:Array.from({length:5},()=>({state:'stopped',day:'1970-01-01'}))});
  assert.equal((await b.request({action:'start',consent:true,sdp:'v=0 offer'})).status,429);assert.equal(b.calls.length,0);
});
test('session uses Marin, returns no credentials, and enforces explicit consent',async()=>{
  const b=backend();assert.equal((await b.request({action:'start',consent:'yes',sdp:'v=0 offer'})).status,400);
  const r=await b.request({action:'start',consent:true,sdp:'v=0 offer'});assert.equal(r.status,200);
  const result=await r.json();assert.equal(result.sessionId,'local-session');assert.equal(result.expiresAt,1180000);
  assert.equal(JSON.stringify(result).includes('private-test-value'),false);
  const config=JSON.parse(b.calls[0].opts.body.get('session'));assert.equal(config.audio.output.voice,'marin');assert.equal(config.max_output_tokens,400);
});
test('quota failure is sanitized',async()=>{
  const b=backend({upstream:()=>Response.json({error:{code:'insufficient_quota',message:'private-provider-detail'}},{status:429})});
  const r=await b.request({action:'start',consent:true,sdp:'v=0 offer'});assert.equal(r.status,502);
  assert.equal((await r.text()).includes('private-provider-detail'),false);
});
function browser(invoke,media) {
  const events=[],tasks=new Map();let n=0,stopped=0;
  const track={stop:()=>stopped++};
  class Peer {constructor(){this.channel={close(){}};}addTrack(){}close(){}createDataChannel(){return this.channel;}async createOffer(){return {sdp:'v=0 offer'};}async setLocalDescription(){}async setRemoteDescription(){this.channel.onopen();}}
  const timers={setTimeout:f=>{tasks.set(++n,f);return n;},clearTimeout:id=>tasks.delete(id),setInterval:f=>{tasks.set(++n,f);return n;},clearInterval:id=>tasks.delete(id)};
  const controller=createRealtimeVoice({invoke,media:media||{getUserMedia:async()=>({getTracks:()=>[track]})},Peer,timers,clock:()=>1000,onState:s=>events.push(s),onAudio:()=>{},onTranscript:()=>{}});
  return {controller,events,tasks,get stopped(){return stopped;}};
}
test('stop releases microphone and allows another session',async()=>{
  const calls=[];const b=browser(async data=>{calls.push(data);return {sessionId:'session',sdp:'answer',expiresAt:181000};});
  await b.controller.start(true);await b.controller.close();assert.equal(b.stopped,1);assert.equal(b.tasks.size,0);
  await b.controller.start(true);assert.equal(calls.filter(x=>x.action==='start').length,2);await b.controller.close();
});
test('stop while provider start is pending cleans up late remote session',async()=>{
  let resolve;const calls=[];const b=browser(data=>{calls.push(data);return data.action==='start'?new Promise(r=>resolve=r):Promise.resolve({});});
  const starting=b.controller.start(true);await new Promise(r=>setImmediate(r));await b.controller.close();resolve({sessionId:'late',sdp:'answer',expiresAt:181000});await starting;
  assert.ok(calls.some(x=>x.action==='stop'&&x.sessionId==='late'));assert.equal(b.tasks.size,0);assert.equal(b.stopped,1);
});
test('session deadline closes mic and asks backend to hang up',async()=>{
  const calls=[];let current=1000;let tick;let stopped=0;
  class Peer {addTrack(){}close(){}createDataChannel(){return {close(){}};}async createOffer(){return {sdp:'v=0'};}async setLocalDescription(){}async setRemoteDescription(){}}
  const controller=createRealtimeVoice({invoke:async data=>{calls.push(data);return {sessionId:'deadline',sdp:'answer',expiresAt:181000};},media:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})},Peer,clock:()=>current,timers:{setTimeout:()=>1,clearTimeout(){},setInterval:f=>{tick=f;return 2;},clearInterval(){}},onState(){},onAudio(){},onTranscript(){}});
  await controller.start(true);current=181001;tick();await new Promise(r=>setImmediate(r));assert.equal(stopped,1);assert.ok(calls.some(x=>x.action==='stop'&&x.sessionId==='deadline'));
});

import { createCleanupHandler } from '../base44/functions/valor-voice-cleanup/service.js';
test('cleanup authenticates admin and only stops expired calls',async()=>{
  for (const user of [null,{id:'ordinary',role:'user'},{id:'owner',role:'admin'}]) {
    const calls=[],updates=[];
    const handler=createCleanupHandler({clientFromRequest:()=>({auth:{me:async()=>user},asServiceRole:{entities:{VoiceSession:{filter:async({state})=>state==='active'?[{id:'expired',call_id:'rtc_old',expires_at:new Date(0).toISOString()},{id:'live',call_id:'rtc_live',expires_at:new Date(9000).toISOString()}]:[],update:async id=>updates.push(id)}}}}),secret:()=> 'test-private-key',now:()=>1000,fetcher:async url=>{calls.push(url);return new Response(null,{status:200});}});
    const r=await handler(new Request('https://example.test',{method:'POST'}));
    assert.equal(r.status,!user?401:user.role==='admin'?200:403);
    assert.equal(calls.length,user?.role==='admin'?1:0);
    if(user?.role==='admin') assert.deepEqual(updates,['expired']);
  }
});
