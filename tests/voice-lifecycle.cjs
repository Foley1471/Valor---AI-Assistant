const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../src/hooks/useVoice.js'), 'utf8').replace(/^import .*;\n/, '').replace('export function useVoice', 'function useVoice') + '\nthis.hook = useVoice;';
function setup() {
 const states=[], effects=[], timers=new Map(); let id=0, spoken=[], resolveMeter, stopped=0;
 const synthesis={getVoices:()=>[], cancel(){}, resume(){}, speak(u){spoken.push(u)}};
 const ctx={useState(v){const s={value:v};states.push(s);return [v,n=>s.value=n]},useRef:v=>({current:v}),useCallback:f=>f,useEffect:f=>effects.push(f),window:{speechSynthesis:synthesis, SpeechSynthesisUtterance:class {constructor(text){this.text=text}},SpeechRecognition:class {start(){} stop(){} abort(){}}}, navigator:{language:'en-US',mediaDevices:{getUserMedia:()=>new Promise(r=>resolveMeter=r)}}, performance:{now:()=>0},requestAnimationFrame:()=>++id,cancelAnimationFrame(){},setTimeout(f){timers.set(++id,f);return id},clearTimeout:i=>timers.delete(i),setInterval:()=>++id,clearInterval(){}};
 vm.runInNewContext(source,ctx);const hook=ctx.hook(); const cleanups=effects.map(f=>f());
 return {hook,states,timers,spoken,cleanups,resolve(){resolveMeter({getTracks:()=>[{stop(){stopped++}}]})},stopped:()=>stopped};
}
(async()=>{
 let t=setup();t.hook.speak('first');assert.equal(t.states[2].value,true);const first=t.spoken[0];t.hook.speak('second');first.onend();assert.equal(t.states[2].value,true);t.spoken[1].onstart();t.spoken[1].onend();assert.equal(t.states[2].value,false);
 t=setup();t.hook.speak('blocked');const u=t.spoken[0];[...t.timers.values()][0]();assert.equal(t.states[2].value,false);assert.match(t.states[5].value,/blocked/);u.onstart();assert.equal(t.states[2].value,false);
 t=setup();t.hook.startListening(()=>{});t.hook.stopListening();t.resolve();await new Promise(setImmediate);assert.equal(t.stopped(),1);
 t=setup();t.hook.startListening(()=>{});t.cleanups.filter(Boolean).forEach(f=>f());t.resolve();await new Promise(setImmediate);assert.equal(t.stopped(),1);
 console.log('PASS: stale playback, startup timeout/late start, stopped and unmounted microphone permission cleanup');
})();
