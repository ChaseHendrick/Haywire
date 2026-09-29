import * as engine from './engine.js';
import {createScene} from './scene.js';
import {createSweepBudget} from './input.js';
const {CONTRACTS,TOOLS,UPGRADES,RELICS,derive}=engine;
const $=selector=>document.querySelector(selector);
const SAVE_KEY='haywire-save-v1';
const icons={
  volume:'<path d="m10 4-5 4H2v8h3l5 4z"/><path d="M14 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m10 4-5 4H2v8h3l5 4z"/><path d="m15 9 6 6m0-6-6 6"/>',
  pause:'<path d="M8 5v14m8-14v14"/>',play:'<path d="m8 4 12 8-12 8z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 2-1.5 2m0 3h.01"/>',
  coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="m12 8-3 4 3 4 3-4z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  cursor:'<path d="m5 3 14 10-6 1-3 6z"/><path d="m13 14 4 6"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-7M12 12h.01"/>',
  workshop:'<path d="m3 9 9-6 9 6v12H3zM9 21v-8h6v8M3 10h18M6 6V3"/>',
  leaf:'<path d="M20 3C5 3 1 10 6 17c6 6 14-2 14-14ZM5 20 16 8"/>',
  cutter:'<path d="M5 5h14v14H5zM9 2v3m6-3v3m-6 14v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3M9 9l6 6m0-6-6 6"/>',
  rake:'<path d="m5 21 10-12M8 4l9 9M7 5l3-3m0 6 3-3m0 6 3-3m0 6 3-3"/>',
  vacuum:'<path d="M7 12a5 5 0 0 1 10 0v8H7zM10 5h4v3M7 16h10M5 21h14M17 12h2l2-5"/>',
  magnet:'<path d="M5 4v9a7 7 0 0 0 14 0V4h-5v9a2 2 0 0 1-4 0V4zM5 8h5m4 0h5"/>',
  drone:'<path d="M8 10h8v6H8zM8 10 5 7m11 3 3-3M8 16l-3 3m11-3 3 3"/><ellipse cx="4" cy="6" rx="3" ry="1.5"/><ellipse cx="20" cy="6" rx="3" ry="1.5"/><ellipse cx="4" cy="20" rx="3" ry="1.5"/><ellipse cx="20" cy="20" rx="3" ry="1.5"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check:'<path d="m5 12 4 4 10-11"/>',
  bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zm5 3h4M12 4V2"/>',
  bird:'<path d="M4 16c0-5 7-5 7-9a4 4 0 0 1 7-2l3 2-3 2c0 7-6 10-14 7zM8 20l3-3m4 3-2-3M14 6h.01"/>',
  key:'<circle cx="8" cy="8" r="4"/><path d="m11 11 10 10m-6-6 3-3m0 6 3-3"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 6-5 2 3-6z"/>',
  acorn:'<path d="M5 10h14m-12 0c0 9 5 11 5 11s5-2 5-11M4 10a8 8 0 0 1 16 0zM12 3l2-2"/>',
  crown:'<path d="m3 6 4 5 5-7 5 7 4-5-2 13H5zM5 16h14"/>',
};
function icon(id){return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]||icons.coin}</svg>`;}
function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
fillIcons();
let storageAvailable=true,loaded=false;
let state;
try{const raw=localStorage.getItem(SAVE_KEY);state=raw?engine.restoreState(raw):engine.createState();loaded=!!raw;if(raw){try{JSON.parse(raw);}catch{queueMicrotask(()=>toast('Your save was repaired. A fresh field is ready.'));}}}catch{storageAvailable=false;state=engine.createState();}
if(!loaded && matchMedia('(prefers-reduced-motion: reduce)').matches)state.settings.reducedMotion=true;
let tab='workshop',paused=false,pointerDown=false,keyboardDown=false,hover=null,keyCursor={col:5.5,row:4.5};
let strokeAnchor=null,lastStrokeTime=0,strokeBurstBudget=3;
const sweepBudget=createSweepBudget();
let orbitMode=false,gesture=null,sceneryHover=null;
function endStroke(){pointerDown=false;strokeAnchor=null;lastStrokeTime=0;gesture=null;}
let scene;
try{scene=createScene($('#field-canvas'));}catch(error){$('#scene-wrap').innerHTML='<div class="pause-overlay"><div><h2>The field could not load.</h2><p>Try opening Haywire in a browser with WebGL enabled.</p></div></div>';throw error;}
let audioContext;
function sound(kind){
  if(!state.settings.sound)return;
  try{
    audioContext||=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();
    const notes=kind==='needle'?[523,659,784,1046]:kind==='loot'?[587,880]:kind==='upgrade'?[392,523,784]:[260+Math.random()*35];
    notes.forEach((freq,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=kind==='hay'?'triangle':'sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,audioContext.currentTime+i*.085);gain.gain.linearRampToValueAtTime(kind==='hay'?.018:.045,audioContext.currentTime+i*.085+.01);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+i*.085+.15);osc.connect(gain);gain.connect(audioContext.destination);osc.start(audioContext.currentTime+i*.085);osc.stop(audioContext.currentTime+i*.085+.2);});
  }catch{/* Sound is optional when a browser does not offer audio. */}
}
function toast(message,good=false){const el=document.createElement('div');el.className='toast'+(good?' good':'');el.textContent=message;const stack=$('#toast-stack');while(stack.children.length>=3)stack.firstElementChild.remove();stack.append(el);setTimeout(()=>el.remove(),3500);}
function save(){
  if(!storageAvailable){$('#save-status').textContent='Session only';return;}
  try{localStorage.setItem(SAVE_KEY,engine.serializeState(state));$('#save-status').innerHTML='<i></i> Saved locally';}
  catch{storageAvailable=false;$('#save-status').textContent='Session only';toast('Browser storage is unavailable. This expedition stays in this session.');}
}
function toolUnlocked(tool){return !tool.requires||state.upgrades[tool.requires];}
function upgradeAvailable(node){return !state.upgrades[node.id]&&node.prerequisites.every(id=>state.upgrades[id])&&!engine.getResearchLock?.(state,node.id)&&state.credits>=engine.upgradeCost(state,node.id);}
function renderDock(){
  $('#tool-dock').innerHTML=TOOLS.map((tool,i)=>`<button class="tool-button ${state.selectedTool===tool.id?'active':''}" data-select="${tool.id}" aria-label="${tool.name}${toolUnlocked(tool)?'':' locked'}" aria-pressed="${state.selectedTool===tool.id}" ${toolUnlocked(tool)?'':'disabled'} title="${toolUnlocked(tool)?tool.description:'Unlock '+UPGRADES.find(u=>u.id===tool.requires).name+' in the tech tree'}"><small>${toolUnlocked(tool)?i+1:'⌑'}</small>${icon(tool.id)}<strong>${tool.name}</strong></button>`).join('');
}
function renderPanel(){
  const target=$('#panel-content'),scroll=target.scrollTop;
  const focused=document.activeElement;const focusId=focused?.dataset.upgrade||focused?.dataset.select||focused?.dataset.item;
  if(tab==='workshop'){
    const suggested=UPGRADES.find(u=>!state.upgrades[u.id]&&u.prerequisites.every(id=>state.upgrades[id])&&!engine.getResearchLock?.(state,u.id));
    target.innerHTML=`<div class="section-kicker">YOUR SEARCH KIT <span>Hold to clear. No busywork.</span></div>${TOOLS.map(t=>`<div class="gear-card ${state.selectedTool===t.id?'equipped':''}"><span class="gear-icon">${icon(t.id)}</span><div class="gear-copy"><strong>${t.id==='rake'?'The trusty rake':t.id==='vacuum'?'Field vacuum':t.id==='cutter'?'Rotary cutter':'Salvage magnet'}</strong><p>${t.id==='rake'?'A satisfying sweep. A very good start.':t.id==='vacuum'?'Bigger clearings, in one easy pass.':t.id==='cutter'?'Cuts through tangled, stubborn hay.':'A little attraction goes a long way.'}</p><span class="gear-status">${state.selectedTool===t.id?'● Equipped':toolUnlocked(t)?'Ready to work':'↳ '+UPGRADES.find(u=>u.id===t.requires).name+' research'}</span></div>${toolUnlocked(t)?`<button class="mini-button" data-select="${t.id}" ${state.selectedTool===t.id?'disabled':''}>${state.selectedTool===t.id?'In use':'Equip'}</button>`:`<button class="mini-button" data-open-tree="${t.requires}">Unlock</button>`}</div>`).join('')}<div class="section-divider"></div><div class="section-kicker">POCKET-SIZED ADVANTAGES</div><div class="item-card"><span class="item-icon">${icon('radar')}</span><div class="item-copy"><strong>Scanner charge <small data-count="pulse">×${state.items.pulse}</small></strong><p data-item-description="pulse">${state.active.pulse>0?'Signal active for '+Math.ceil(state.active.pulse)+'s':'Find the right patch. Skip the guessing.'}</p></div><button class="mini-button" data-item="pulse">Scan</button></div><div class="item-card"><span class="item-icon">${icon('bolt')}</span><div class="item-copy"><strong>Turbo flask <small data-count="overdrive">×${state.items.overdrive}</small></strong><p data-item-description="overdrive">${state.active.overdrive>0?'Turbo active for '+Math.ceil(state.active.overdrive)+'s':'12 seconds of extra oomph.'}</p></div><button class="mini-button" data-item="overdrive">Boost</button></div>${suggested?`<div class="recommended-card"><small>YOUR NEXT BRIGHT IDEA</small><h3>${suggested.name}</h3><p>${suggested.description}</p><button data-upgrade="${suggested.id}">Research · ${engine.upgradeCost(state,suggested.id)} coins</button></div>`:`<div class="recommended-card"><small>LOOK AT YOU GO</small><h3>${Object.keys(state.upgrades).length===UPGRADES.length?'A very clever operation.':'Keep exploring.'}</h3><p>${Object.keys(state.upgrades).length===UPGRADES.length?'Every idea researched. Your workshop is ready.':'Complete more contracts to open the next workshop ideas.'}</p></div>`}`;
  }else if(tab==='research'){
    const branches=[{id:'harvest',name:'Better tools',icon:'rake',note:'Make every sweep count'},{id:'survey',name:'Sharper signals',icon:'radar',note:'Less hay. More certainty.'},{id:'automation',name:'Helpful machinery',icon:'drone',note:'A little team of your own'}];
    target.innerHTML=`<p class="research-intro">Three paths, one tiny needle. Research stays with you between fields.</p>${branches.map(b=>`<section class="tree-branch"><h3 class="branch-title">${icon(b.icon)}<span>${b.name}</span><span>${UPGRADES.filter(u=>u.branch===b.id&&state.upgrades[u.id]).length} / ${UPGRADES.filter(u=>u.branch===b.id).length}</span></h3>${UPGRADES.filter(u=>u.branch===b.id).map(n=>{const owned=state.upgrades[n.id],gate=engine.getResearchLock?.(state,n.id),locked=!n.prerequisites.every(id=>state.upgrades[id])||!!gate;return `<div class="tree-node ${owned?'owned':locked?'locked':''}"><div class="node-card"><div><strong>${n.name}</strong><p>${n.description}</p>${locked?`<p>${gate||'Needs '+n.prerequisites.filter(id=>!state.upgrades[id]).map(id=>UPGRADES.find(u=>u.id===id).name).join(' + ')}</p>`:''}</div><button data-upgrade="${n.id}" aria-label="Research ${n.name} for ${engine.upgradeCost(state,n.id)} coins" ${owned||locked?'disabled':''}>${owned?'✓ Done':locked?'Locked':engine.upgradeCost(state,n.id)+' ◉'}</button></div></div>`;}).join('')}</section>`).join('')}`;
  }else{
    const relicIcon={foxbell:'bell',mooncoin:'coin',ceramicbird:'bird',amberkey:'key',starcompass:'compass',glassacorn:'acorn',suncrown:'crown'};
    target.innerHTML=`<p class="collection-intro">The needle is only half the story. Buried treasures are sold and remembered here.</p><div class="relic-grid">${RELICS.map(r=>`<div class="relic-card ${state.relics[r.id]?'':'unknown'}" title="${r.description}"><span class="relic-quantity">${state.relics[r.id]?'×'+state.relics[r.id]:''}</span><div class="relic-image" style="color:${state.relics[r.id]?'#a3874d':'#c8cdbb'}">${icon(state.relics[r.id]?relicIcon[r.id]:'lock')}</div><strong>${state.relics[r.id]?r.name:'Undiscovered'}</strong><small>${state.relics[r.id]?r.rarity:'Something good is out there'}</small></div>`).join('')}</div><div class="collection-stat"><div><strong>${Math.floor(state.stats.hay).toLocaleString()}</strong><small>HAY SWEPT</small></div><div><strong>${state.stats.earned.toLocaleString()}</strong><small>COINS EARNED</small></div><div><strong>${state.stats.needles}</strong><small>NEEDLES FOUND</small></div></div>`;
  }
  target.scrollTop=scroll;
  if(focusId){const replacement=target.querySelector(`[data-upgrade="${focusId}"], [data-select="${focusId}"], [data-item="${focusId}"]`);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
  updateButtons();
}
function updateButtons(){
  document.querySelectorAll('[data-upgrade]').forEach(el=>{const node=UPGRADES.find(u=>u.id===el.dataset.upgrade);el.disabled=!upgradeAvailable(node);if(!state.upgrades[node.id]&&node.prerequisites.every(id=>state.upgrades[id])){const cost=engine.upgradeCost(state,node.id);el.title=engine.getResearchLock?.(state,node.id)||(state.credits<cost?`${cost-state.credits} more coins needed`:node.description);}});
  document.querySelectorAll('[data-item]').forEach(el=>{const id=el.dataset.item;el.disabled=state.items[id]<=0||state.active[id]>0||state.field.needleFound||paused;el.textContent=state.active[id]>0?Math.ceil(state.active[id])+'s':id==='pulse'?'Scan':'Boost';});
  document.querySelectorAll('[data-count]').forEach(el=>el.textContent='×'+state.items[el.dataset.count]);
  document.querySelectorAll('[data-item-description]').forEach(el=>{const id=el.dataset.itemDescription;el.textContent=state.active[id]>0?(id==='pulse'?'Signal active for ':'Turbo active for ')+Math.ceil(state.active[id])+'s':id==='pulse'?'Find the right patch. Skip the guessing.':'12 seconds of extra oomph.';});
}
function renderHUD(){
  const view=derive(state),found=state.field.needleFound;
  const daylight=scene.getDaylightState?.();if(daylight){$('#day-phase').textContent=daylight.label;$('#day-phase').title='A four minute day. Pause and reduced motion stop time.';}
  $('#credits').textContent=state.credits.toLocaleString();
  $('#contract-number').textContent=view.challenge?`REMIX CONTRACT ${view.challenge.round}`:`CHAPTER ${view.contract.chapter||Math.floor(state.contractIndex/8)+1} · FIELD ${String(state.contractIndex+1).padStart(2,'0')} / ${CONTRACTS.length}`;
  $('#contract-name').textContent=view.contract.name;
  $('#clear-percent').textContent=Math.floor(view.progress*100)+'%';
  $('#clear-progress').style.width=(view.progress*100)+'%';
  $('#field-tag').textContent=found?'Needle found':view.autoRate>0?'Helpers at work':view.progress>.5?'Getting closer':'A fresh start';
  $('#scene-description').textContent=view.contract.region || ['A good day to find something.','Good things grow here.','Old hay. New possibilities.','Someone had a very good time.','A quiet field. A busy workshop.','One last little glimmer.'][state.contractIndex] || 'A new field. A new idea.';
  const condition=hover?state.field.cells[Math.round(hover.row)*state.field.cols+Math.round(hover.col)]:null;
  if(condition?.material){const names={loose:'Loose hay',packed:'Compacted hay',tangled:'Tangled hay',static:'Static-charged hay'};const efficiency=view.efficiencies?.[condition.material]??view.tool.efficiencies?.[condition.material];const specialist=view.contract.mastery;if(specialist&&condition.material===specialist.material&&condition.maxDepth>0){const index=Math.round(hover.row)*state.field.cols+Math.round(hover.col);$('#terrain-help').textContent=names[condition.material]+' · '+(state.field.masteryCells?.[index]?'Surveyed':state.selectedTool===specialist.tool?'Sweep to survey this patch':'Survey with the '+TOOLS.find(tool=>tool.id===specialist.tool).name);}else $('#terrain-help').textContent=condition.depth>0?names[condition.material]+(efficiency?' · '+Math.round(efficiency*100)+'% tool efficiency':''):'Clear ground · loose straw still moves';}else $('#terrain-help').textContent='Sweep the loose straw. It tumbles and settles.';
  $('#upgrade-count').textContent=Object.keys(state.upgrades).length+' / '+UPGRADES.length;
  $('#finds-count').textContent=RELICS.filter(r=>state.relics[r.id]>0).length;
  $('#needle-count').textContent=`${Math.min(state.stats.needles,CONTRACTS.length)} / ${CONTRACTS.length} campaign needles found${view.challenge?' · '+state.stats.challenges+' remix'+(state.stats.challenges===1?'':'es')+' complete':''}`;
  $('#first-hint').hidden=state.stats.hay>1;
  const precise=state.upgrades.survey3||state.upgrades.survey4;
  if(view.objectives){$('#objectives-bar').innerHTML=view.objectives.map(o=>`<span class="objective ${o.complete?'done':''}" title="${o.label}"><span>${o.complete?'✓':'○'}</span><b>${o.label}</b><small>${o.format==='percent'||o.id==='processing'?Math.floor(o.current)+'% / '+o.target+'%':o.current+' / '+o.target}</small></span>`).join('');}
  else $('#objectives-bar').innerHTML='';
  $('.signal-card small').textContent=view.clue?.kind==='salvage'?'SALVAGE SIGNAL':view.clue?.kind==='mastery'?'SPECIALIST SURVEY':'NEEDLE SIGNAL';
  $('#signal-text').textContent=found?'Field complete.':state.field.needleRecovered?(view.clue?.kind==='salvage'?'A find in this patch':view.clue?.kind==='mastery'?'A survey patch nearby':'Needle in your pocket'):view.needleExposed?'There is a glimmer!':view.clue?(precise?'Signal pinpointed':'Something in this patch'):'Start exploring';
  $('#signal-description').textContent=found?'One down. Bigger ideas ahead.':state.field.needleRecovered?(view.clue?.kind==='salvage'?'Salvage is inside the green circle.':view.clue?.kind==='mastery'?'Sweep this patch with the '+(TOOLS.find(tool=>tool.id===view.clue.tool)?.name||'specialist tool')+'.':'Finish the remaining field goals.'):view.needleExposed?'Sweep over the golden needle.':view.clue?'Search inside the green circle.':`Clear ${state.upgrades.survey1?'32%':'half'} the hay for a useful clue.`;
  const marker=$('#needle-marker');marker.hidden=!view.needleExposed||found||paused;
  if(view.needleExposed&&!found){const point=scene.project(state.field.needleCell%state.field.cols,Math.floor(state.field.needleCell/state.field.cols),1.3);const box=$('#scene-wrap').getBoundingClientRect();marker.style.left=Math.max(52,Math.min(box.width-52,point.x-box.left))+'px';marker.style.top=Math.max(60,Math.min(box.height-100,point.y-box.top))+'px';}
  $('#signal-status').textContent=view.clue||view.needleExposed?'⌁':'···';
  $('#combo-badge').hidden=view.comboMultiplier<1.15||found;$('#combo-badge b').textContent='×'+view.comboMultiplier.toFixed(1);
  $('#found-overlay').hidden=!found;
  if(found){const victory=state.completed===CONTRACTS.length,challenge=view.challenge;$('#found-title').textContent=challenge?'Another good find.':victory?'What a good find.':'Good work.';$('#found-description').textContent=challenge?view.contract.name+' is in the books. Your kit is ready for another remix.':victory?'Every campaign field explored. Keep your kit and try remix contracts.':view.contract.name+' is in the books.';$('#completion-reward').innerHTML=`+${view.contract.bonus} coins<br><small>+1 scanner charge · +1 turbo flask</small>`;$('#next-button').innerHTML=(victory?'Try a remix contract':'On to the next field')+' '+icon('arrow');}
  $('#sound-button').innerHTML=icon(state.settings.sound?'volume':'mute');$('#sound-button').setAttribute('aria-label',state.settings.sound?'Turn sound off':'Turn sound on');$('#sound-button').setAttribute('aria-pressed',String(state.settings.sound));
  $('#motion-button').textContent=state.settings.reducedMotion?'Motion reduced ✓':'Reduce motion';document.documentElement.dataset.reducedMotion=state.settings.reducedMotion;
  updateButtons();
}
function renderAll(){renderDock();renderPanel();renderHUD();scene.resetField();}
let lastHaySound=0,lastBurst=0;
function processEvents(events){
  if(!events.length)return;
  let redraw=false;
  for(const e of events){
    if(e.type==='hay'&&!e.automated){const now=performance.now();if(now-lastBurst>55){scene.burst(e.col,e.row);lastBurst=now;}if(e.cleared&&now-lastHaySound>110){sound('hay');lastHaySound=now;}}
    if(e.type==='loot'){const name=e.relic?e.name:e.id==='pulse'?'Scanner charge':e.id==='overdrive'?'Turbo flask':e.id==='cache'?'Buried coin cache':'Salvaged trinket';toast(name+(e.credits?' · +'+e.credits+' coins':' · tucked in your pocket'),true);sound('loot');redraw=true;}
    if(e.type==='upgrade'){toast(e.name+' researched. Good thinking.');sound('upgrade');redraw=true;}
    if(e.type==='item'){if(e.kind==='consumable'){toast(e.id==='pulse'?'Scanner on. Follow the green circle.':'Turbo on. Make a glorious mess.');sound('upgrade');}redraw=true;}
    if(e.type==='clue')toast('A signal! Search the highlighted patch.');
    if(e.type==='needle'){scene.burst(e.col,e.row,'needle');sound('needle');toast('Needle recovered! Finish the field goals.',true);redraw=true;}
    if(e.type==='complete'){endStroke();keyboardDown=false;redraw=true;toast(e.name+' complete. Well searched.',true);}
    if(e.type==='objective')toast(e.label+' complete.');
    if(e.type==='scenery'){scene.activateScenery?.(e.id);toast(e.message,e.claimed);if(e.claimed)sound('loot');redraw=true;}
  }
  if(redraw){renderDock();renderPanel();save();}renderHUD();
}
function manualSweep(col,row,dt){const view=derive(state),work=sweepBudget.take(performance.now(),dt);if(!state.settings.reducedMotion)scene.interact?.(col,row,state.selectedTool,view.radius,dt);processEvents(engine.sweep(state,col,row,Math.max(work,view.needleExposed && Math.hypot(col-state.field.needleCell%state.field.cols,row-Math.floor(state.field.needleCell/state.field.cols))<=.8 ? .001 : 0)));}
function dragStroke(point,now,allocatedWork){
  if(!point){strokeAnchor=null;lastStrokeTime=now;return[];}
  if(!strokeAnchor){strokeAnchor={...point};lastStrokeTime=now;return[];}
  const start=strokeAnchor,dx=point.col-start.col,dy=point.row-start.row,distance=Math.hypot(dx,dy);
  if(distance<.015)return[];
  const samples=Math.min(96,Math.max(1,Math.ceil(distance/.30)));
  const elapsed=Math.max(0,Math.min((now-lastStrokeTime)/1000,.05));
  const work=allocatedWork??sweepBudget.take(now,elapsed+.20*distance);
  const dt=Math.min(.2,work/samples),view=derive(state),events=[];
  const physicalSpacing=Math.max(1,Math.ceil(samples/Math.max(1,strokeBurstBudget)));
  for(let i=1;i<=samples;i++){
    const col=start.col+dx*i/samples,row=start.row+dy*i/samples;
    const cell=state.field.cells[Math.round(row)*state.field.cols+Math.round(col)];
    const hadHay=cell?.depth>0;
    if(!state.settings.reducedMotion)scene.interact?.(col,row,state.selectedTool,view.radius,Math.max(.015,dt));
    events.push(...engine.sweep(state,col,row,dt));
    if(hadHay&&!state.settings.reducedMotion&&strokeBurstBudget>0&&i%physicalSpacing===0){scene.burst(col,row,'stroke');strokeBurstBudget--;lastBurst=now;}
  }
  strokeAnchor={...point};lastStrokeTime=now;return events;
}
function dragPointerBatch(events){
  const now=performance.now(),points=[];let anchor=strokeAnchor,totalDistance=0;
  for(const event of events){updatePointer(event);const point=hover?{...hover}:null;const distance=point&&anchor?Math.hypot(point.col-anchor.col,point.row-anchor.row):0;const meaningful=distance>=.015?distance:0;points.push({point,distance:meaningful});totalDistance+=meaningful;if(!point||!anchor||meaningful)anchor=point;}
  const elapsed=Math.max(0,Math.min((now-lastStrokeTime)/1000,.05));
  const requests=points.map(({distance})=>totalDistance>0?(elapsed+.20*totalDistance)*distance/totalDistance:0);
  const work=sweepBudget.takeBatch(now,requests);
  const results=[];points.forEach(({point},index)=>results.push(...dragStroke(point,now,work[index])));processEvents(results);
}
function setTab(id){tab=id;document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.tab===id)));$('#panel-content').setAttribute('aria-labelledby','tab-'+id);$('#panel-content').scrollTop=0;renderPanel();}
function hasDialog(){return !!document.querySelector('dialog[open]');}
function canPlay(){return !paused&&!hasDialog()&&!state.field.needleFound&&!document.hidden;}
function setPaused(value){paused=value;endStroke();keyboardDown=false;$('#pause-overlay').hidden=!paused;$('#pause-button').setAttribute('aria-label',paused?'Resume game':'Pause game');$('#pause-button').innerHTML=icon(paused?'play':'pause');updateButtons();save();}
function handleAction(event){
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.upgrade){processEvents(engine.buyUpgrade(state,button.dataset.upgrade));return;}
  if(button.dataset.select){processEvents(engine.selectTool(state,button.dataset.select));return;}
  if(button.dataset.item){if(canPlay())processEvents(engine.useItem(state,button.dataset.item));return;}
  if(button.dataset.tab){setTab(button.dataset.tab);return;}
  if(button.dataset.openTree){setTab('research');$('#panel-content').querySelector(`[data-upgrade="${button.dataset.openTree}"]`)?.scrollIntoView({block:'center',behavior:state.settings.reducedMotion?'instant':'smooth'});return;}
  if(button.dataset.close){$('#'+button.dataset.close).close();endStroke();keyboardDown=false;return;}
}
document.addEventListener('click',handleAction);
$('#sound-button').addEventListener('click',()=>{engine.toggleSetting(state,'sound');sound('upgrade');renderHUD();save();});
$('#motion-button').addEventListener('click',()=>{engine.toggleSetting(state,'reducedMotion');if(state.settings.reducedMotion)scene.settleLighting?.();renderHUD();save();});
$('#pause-button').addEventListener('click',()=>setPaused(!paused));$('#resume-button').addEventListener('click',()=>setPaused(false));
$('#help-button').addEventListener('click',()=>{endStroke();keyboardDown=false;$('#help-dialog').showModal();});
$('#restart-button').addEventListener('click',()=>{endStroke();keyboardDown=false;$('#restart-dialog').showModal();});
$('#confirm-restart').addEventListener('click',()=>{const settings={...state.settings};state=engine.createState();state.settings=settings;hover=null;scene.setHover(null);keyCursor={col:5.5,row:4.5};$('#restart-dialog').close();setPaused(false);renderAll();save();toast('A fresh expedition. A whole field of possibilities.');});
$('#needle-marker').addEventListener('click',()=>{if(canPlay()&&derive(state).needleExposed)manualSweep(state.field.needleCell%state.field.cols,Math.floor(state.field.needleCell/state.field.cols),.12);});
$('#next-button').addEventListener('click',()=>{if(state.completed===CONTRACTS.length&&engine.startChallenge){processEvents(engine.startChallenge(state));}else{processEvents(engine.nextContract(state));}hover=null;scene.setHover(null);keyCursor={col:(state.field.cols-1)/2,row:(state.field.rows-1)/2};renderAll();save();});
const canvas=$('#field-canvas');
function canView(){return !paused&&!hasDialog()&&!document.hidden;}
function clearSceneryHover(){sceneryHover=null;scene.setSceneryHover?.(null);$('#scenery-tooltip').hidden=true;}
function interruptView(){endStroke();keyboardDown=false;hover=null;scene.setHover(null);clearSceneryHover();}
function inspectScenery(target){if(!canPlay())return;if(target){processEvents(engine.inspectScenery(state,target.id));}else{toast('A quiet patch of farm. Try the barn, windmill, crates, or sorting belt.');}save();}
function updateSceneryPointer(e){sceneryHover=scene.pickScenery?.(e.clientX,e.clientY)||null;scene.setSceneryHover?.(sceneryHover);const tooltip=$('#scenery-tooltip');tooltip.hidden=!sceneryHover||!canPlay()||orbitMode;if(sceneryHover){const description=engine.SCENERY.find(object=>object.id===sceneryHover.id);tooltip.replaceChildren();const title=document.createElement('strong'),detail=document.createElement('p');title.textContent=sceneryHover.label;detail.textContent=description?.description||'Click to visit.';tooltip.append(title,detail);}}
function updatePointer(e){hover=scene.pick(e.clientX,e.clientY);if(hover){hover.col=Math.max(0,Math.min(state.field.cols-1,hover.col));hover.row=Math.max(0,Math.min(state.field.rows-1,hover.row));keyCursor={...hover};}scene.setHover(hover);}
canvas.addEventListener('pointerdown',e=>{
  if(!canView()||![0,1,2].includes(e.button))return;
  e.preventDefault();endStroke();keyboardDown=false;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  const rotate=orbitMode||e.button===2||e.button===1||e.altKey;
  gesture={id:e.pointerId,type:rotate?'orbit':'sweep',x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};
  if(rotate){hover=null;scene.setHover(null);clearSceneryHover();return;}
  if(!canPlay()){gesture=null;return;}
  updateSceneryPointer(e);if(sceneryHover){gesture.type='scenery';gesture.target=sceneryHover;return;}
  updatePointer(e);if(!hover){gesture.type='scenery';return;}
  pointerDown=true;strokeAnchor={...hover};lastStrokeTime=performance.now();strokeBurstBudget=3;manualSweep(hover.col,hover.row,.06);
});
canvas.addEventListener('pointermove',e=>{
  if(gesture&&gesture.id!==e.pointerId)return;
  if(gesture?.type==='orbit'){if(canView()){scene.orbit(e.clientX-gesture.x,e.clientY-gesture.y);gesture.x=e.clientX;gesture.y=e.clientY;}return;}
  if(gesture?.type==='scenery')return;
  if(!pointerDown){updateSceneryPointer(e);if(sceneryHover){hover=null;scene.setHover(null);return;}}
  if(pointerDown&&canPlay()){const samples=e.getCoalescedEvents?e.getCoalescedEvents():[];dragPointerBatch([...samples,e]);}else updatePointer(e);
});
canvas.addEventListener('pointerup',e=>{if(gesture&&gesture.id!==e.pointerId)return;const action=gesture;if(action?.type==='scenery'&&Math.hypot(e.clientX-action.startX,e.clientY-action.startY)<7)inspectScenery(action.target);endStroke();save();});canvas.addEventListener('pointercancel',endStroke);canvas.addEventListener('lostpointercapture',endStroke);canvas.addEventListener('pointerleave',()=>{clearSceneryHover();if(!pointerDown){hover=null;scene.setHover(null);}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(canView()){e.preventDefault();interruptView();scene.zoom(-e.deltaY*.0015);}},{passive:false});
$('#orbit-button').addEventListener('click',()=>{interruptView();orbitMode=!orbitMode;$('#orbit-button').setAttribute('aria-pressed',String(orbitMode));$('#scene-wrap').dataset.orbit=orbitMode;});
$('#camera-reset').addEventListener('click',()=>{interruptView();scene.resetCamera();renderHUD();});
$('#camera-zoom-in').addEventListener('click',()=>{interruptView();scene.zoom(.15);});$('#camera-zoom-out').addEventListener('click',()=>{interruptView();scene.zoom(-.15);});
$('#time-button').addEventListener('click',()=>{interruptView();scene.advanceTime();renderHUD();});
window.addEventListener('blur',()=>{endStroke();keyboardDown=false;save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){endStroke();keyboardDown=false;save();}});
document.addEventListener('keydown',e=>{
  if(hasDialog())return;
  if(e.code==='KeyP'&&!e.repeat){e.preventDefault();setPaused(!paused);return;}
  if(!canPlay())return;
  if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code)&&!e.repeat){const tool=TOOLS[Number(e.code.slice(-1))-1];if(tool)processEvents(engine.selectTool(state,tool.id));return;}
  if(e.code==='Space' && !e.repeat && (document.activeElement===canvas||document.activeElement===document.body)){e.preventDefault();processEvents(engine.useItem(state,'pulse'));return;}
  if(document.activeElement!==canvas)return;
  const step=.65;
  if(e.code.startsWith('Arrow')){e.preventDefault();if(e.code==='ArrowLeft')keyCursor.col-=step;if(e.code==='ArrowRight')keyCursor.col+=step;if(e.code==='ArrowUp')keyCursor.row-=step;if(e.code==='ArrowDown')keyCursor.row+=step;keyCursor.col=Math.max(0,Math.min(state.field.cols-1,keyCursor.col));keyCursor.row=Math.max(0,Math.min(state.field.rows-1,keyCursor.row));hover={...keyCursor};scene.setHover(hover);}
  if(e.code==='Enter'){e.preventDefault();keyboardDown=true;hover={...keyCursor};scene.setHover(hover);if(!e.repeat)manualSweep(hover.col,hover.row,.12);}
});
document.addEventListener('keyup',e=>{if(e.code==='Enter'){keyboardDown=false;save();}});
document.querySelectorAll('[role=tab]').forEach(el=>el.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const list=[...document.querySelectorAll('[role=tab]')];let i=list.indexOf(el);i=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(list[i].dataset.tab);list[i].focus();}));
new ResizeObserver(()=>scene.resize()).observe(canvas);
window.addEventListener('pagehide',save);
let previous=performance.now(),accumulator=0,lastHUD=0,lastSave=0;
function frame(now){
  const dt=Math.max(0,Math.min((now-previous)/1000,.05));previous=now;
  if(canPlay()){
    processEvents(engine.tick(state,dt));
    const stationary=keyboardDown||(pointerDown&&now-lastStrokeTime>35);
    if(stationary){accumulator+=dt;if(accumulator>=.08){if(hover)manualSweep(hover.col,hover.row,Math.min(accumulator,.16));accumulator=0;}}else accumulator=0;
  }else accumulator=0;
  if(now-lastHUD>240){renderHUD();lastHUD=now;}
  if(now-lastSave>2500){save();lastSave=now;}
  scene.render(state,derive(state),now,canView());
  strokeBurstBudget=3;
  requestAnimationFrame(frame);
}
window.__haywire=Object.freeze({getState:()=>state,engine,projectCell:(col,row,height)=>scene.project(col,row,height),projectObject:id=>scene.projectScenery?.(id),pickCell:(x,y)=>scene.pick(x,y),getCameraState:()=>scene.getCameraState?.(),getDaylightState:()=>scene.getDaylightState?.(),getInputStats:()=>sweepBudget.getState(),getPhysicsStats:()=>scene.getPhysicsStats?.()||{},refresh:renderAll,save,storageKey:SAVE_KEY});
renderAll();save();requestAnimationFrame(frame);
