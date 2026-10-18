const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../src/hooks/useVoice.js'), 'utf8').replace(/^import .*;\n/, '').replace('export function useVoice', 'function useVoice') + '\nthis.hook = useVoice;';
function setup() {
 const states=[], effects=[], timers=new Map(); let id=0, spoken=[], resolveMeter, stopped=0; const recognizers=[];
 const synthesis={getVoices:()=>[], cancel(){}, resume(){}, speak(u){spoken.push(u)}};
 const ctx={useState(v){const s={value:v};states.push(s);return [v,n=>s.value=n]},useRef:v=>({current:v}),useCallback:f=>f,useEffect:f=>effects.push(f),window:{speechSynthesis:synthesis, SpeechSynthesisUtterance:class {constructor(text){this.text=text}},SpeechRecognition:class {constructor(){recognizers.push(this)} start(){} stop(){} abort(){this.aborted=true}}}, navigator:{language:'en-US',mediaDevices:{getUserMedia:()=>new Promise(r=>resolveMeter=r)}}, performance:{now:()=>0},requestAnimationFrame:()=>++id,cancelAnimationFrame(){},setTimeout(f){timers.set(++id,f);return id},clearTimeout:i=>timers.delete(i),setInterval:()=>++id,clearInterval(){}};
 vm.runInNewContext(source,ctx);const hook=ctx.hook(); const cleanups=effects.map(f=>f());
 return {hook,states,timers,spoken,cleanups,recognizers,resolve(){resolveMeter({getTracks:()=>[{stop(){stopped++}}]})},stopped:()=>stopped};
}
(async()=>{
 let t=setup();t.hook.speak('first');assert.equal(t.states[2].value,true);const first=t.spoken[0];t.hook.speak('second');first.onend();assert.equal(t.states[2].value,true);t.spoken[1].onstart();t.spoken[1].onend();assert.equal(t.states[2].value,false);
 t=setup();t.hook.speak('blocked');const u=t.spoken[0];[...t.timers.values()][0]();assert.equal(t.states[2].value,false);assert.match(t.states[5].value,/blocked/);u.onstart();assert.equal(t.states[2].value,false);
 t=setup();t.hook.startListening(()=>{});t.hook.stopListening();t.resolve();await new Promise(setImmediate);assert.equal(t.stopped(),1);
 t=setup();t.hook.startListening(()=>{});t.cleanups.filter(Boolean).forEach(f=>f());t.resolve();await new Promise(setImmediate);assert.equal(t.stopped(),1);
 t=setup();t.hook.startListening(()=>assert.fail('No transcript should be sent'));const stalled=t.recognizers[0];[...t.timers.values()][0]();assert.equal(t.states[1].value,false);assert.match(t.states[4].value,/did not start/);assert.equal(stalled.aborted,true);assert.equal(t.timers.size,0);
 t=setup();t.hook.startListening(()=>{});t.recognizers[0].onstart();assert.equal(t.timers.size,1);[...t.timers.values()][0]();assert.equal(t.states[1].value,false);assert.match(t.states[4].value,/No completed speech transcript/);
 t=setup();t.hook.startListening(()=>{});const old=t.recognizers[0];old.onerror({error:'no-speech'});assert.match(t.states[4].value,/No speech/);t.hook.startListening(()=>{});old.onend();assert.equal(t.states[1].value,true);assert.equal(t.recognizers[1].aborted,undefined);t.hook.stopListening();assert.equal(t.timers.size,0);
 t=setup();let received;t.hook.startListening(text=>received=text);const success=t.recognizers[0];success.onstart();success.onresult({resultIndex:0,results:[Object.assign([{transcript:'hello'}],{isFinal:true})]});success.onend();assert.equal(received,'hello');assert.equal(t.states[4].value,null);assert.equal(t.timers.size,0);
 console.log('PASS: playback lifecycle, microphone cleanup, recognition startup and session timeout, no-speech recovery, stale recognition events, successful transcription');
})();
