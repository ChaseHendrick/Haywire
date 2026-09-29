/** A continuous, four-minute farm day. All time inputs are elapsed seconds. */
export const DAY_SECONDS = 240;
export const MORNING_PHASE = 0.22;

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const wrap = value => ((value % 1) + 1) % 1;
const smooth = value => {
  const n = clamp(value, 0, 1);
  return n * n * (3 - 2 * n);
};

const KEYS = Object.freeze([
  {phase:0.00,sky:'#172842',fog:'#293b57',sun:'#b9d2ff',skyLight:'#8aabe0',groundLight:'#415172',sunIntensity:.38,hemisphereIntensity:1.12,exposure:1.30,starsOpacity:.95},
  {phase:0.17,sky:'#30435d',fog:'#4a5b74',sun:'#c5cbef',skyLight:'#a2b5dc',groundLight:'#62596c',sunIntensity:.55,hemisphereIntensity:1.20,exposure:1.29,starsOpacity:.72},
  {phase:0.23,sky:'#e6bd9d',fog:'#dec3a9',sun:'#ffc38b',skyLight:'#f6d7b6',groundLight:'#9b8268',sunIntensity:2.05,hemisphereIntensity:1.90,exposure:1.25,starsOpacity:.03},
  {phase:0.31,sky:'#e0e9db',fog:'#e6eddf',sun:'#fff0d1',skyLight:'#f6fff0',groundLight:'#899879',sunIntensity:2.90,hemisphereIntensity:2.25,exposure:1.24,starsOpacity:0},
  {phase:0.50,sky:'#e8eee3',fog:'#e8eee3',sun:'#fff6d7',skyLight:'#f8fff2',groundLight:'#87976e',sunIntensity:3.10,hemisphereIntensity:2.40,exposure:1.25,starsOpacity:0},
  {phase:0.67,sky:'#e9dbc4',fog:'#e5d5bb',sun:'#ffe1ab',skyLight:'#ffe8c6',groundLight:'#9a896b',sunIntensity:2.75,hemisphereIntensity:2.12,exposure:1.24,starsOpacity:0},
  {phase:0.75,sky:'#d99d91',fog:'#d9ae99',sun:'#ffa16e',skyLight:'#ecc1b4',groundLight:'#866c73',sunIntensity:1.95,hemisphereIntensity:1.72,exposure:1.25,starsOpacity:.08},
  {phase:0.83,sky:'#555973',fog:'#606780',sun:'#c4bdea',skyLight:'#a6b4d8',groundLight:'#55516d',sunIntensity:.60,hemisphereIntensity:1.23,exposure:1.29,starsOpacity:.58},
  {phase:0.90,sky:'#1c2d49',fog:'#2d3e5b',sun:'#bdd4ff',skyLight:'#8caee1',groundLight:'#435274',sunIntensity:.38,hemisphereIntensity:1.12,exposure:1.30,starsOpacity:.95},
  {phase:1.00,sky:'#172842',fog:'#293b57',sun:'#b9d2ff',skyLight:'#8aabe0',groundLight:'#415172',sunIntensity:.38,hemisphereIntensity:1.12,exposure:1.30,starsOpacity:.95},
].map(Object.freeze));

function mixHex(a, b, t) {
  const from = parseInt(a.slice(1), 16), to = parseInt(b.slice(1), 16);
  const channel = shift => Math.round(((from >>> shift) & 255) * (1 - t) + ((to >>> shift) & 255) * t).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Pure cycle data, usable by WebGL, a 2D fallback, or UI without any Three APIs. */
export function getDaylight(seconds = 0, options = {}) {
  const cycleSeconds = clamp(finite(options?.cycleSeconds, DAY_SECONDS), 30, 3600);
  const startPhase = wrap(finite(options?.startPhase, MORNING_PHASE));
  const phase = wrap((finite(seconds) % cycleSeconds) / cycleSeconds + startPhase);
  const right = KEYS.findIndex(key => key.phase >= phase);
  const a = KEYS[Math.max(0, right - 1)], b = KEYS[Math.max(1, right)];
  const blend = smooth((phase - a.phase) / (b.phase - a.phase));
  const data = {phase, cycleSeconds};
  for (const key of ['sky', 'fog', 'sun', 'skyLight', 'groundLight']) data[key] = mixHex(a[key], b[key], blend);
  for (const key of ['sunIntensity', 'hemisphereIntensity', 'exposure', 'starsOpacity']) data[key] = a[key] + (b[key] - a[key]) * blend;
  const angle = (phase - .25) * TAU;
  const altitude = Math.sin(angle);
  data.sunPosition = {x:-18 * Math.cos(angle), y:2 + Math.max(-.05, altitude) * 17, z:-10};
  data.moonPosition = {x:18 * Math.cos(angle), y:2 + Math.max(-.05, -altitude) * 17, z:-10};
  data.sunVisibility = smooth((altitude + .15) / .3);
  data.moonVisibility = 1 - data.sunVisibility;
  data.period = phase >= .19 && phase < .31 ? 'sunrise' : phase >= .31 && phase < .69 ? 'day' : phase >= .69 && phase < .83 ? 'sunset' : 'night';
  data.label = {sunrise:'Sunrise', day:'Daylight', sunset:'Sunset', night:'Moonlit night'}[data.period];
  const minute = Math.floor(phase * 24 * 60);
  data.clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return data;
}

/**
 * Applies cycle data and owns only its added celestial meshes and lights.
 * The caller owns its clock: freeze seconds for pause or reduced motion, and
 * explicitly advance seconds when the player chooses to skip forward.
 */
export function createDaylight({THREE, scene, renderer, sunLight, hemisphereLight, groundMaterial, cycleSeconds = DAY_SECONDS, startPhase = MORNING_PHASE} = {}) {
  if (!THREE || !scene || !sunLight || !hemisphereLight) throw new TypeError('Daylight needs Three, a scene, a directional light, and a hemisphere light.');
  const sky = new THREE.Group();
  sky.name = 'Haywire daylight';
  scene.add(sky);
  const starVertices = [];
  const hash = n => {const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value);};
  for (let i = 0; i < 220; i += 1) {
    const angle = hash(i + 17) * TAU, radius = 13 + hash(i + 31) * 17;
    starVertices.push(Math.cos(angle) * radius, 5 + hash(i + 59) * 17, Math.sin(angle) * radius);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const starMaterial = new THREE.PointsMaterial({color:'#eef5ff', size:2.4, sizeAttenuation:false, transparent:true, opacity:0, depthWrite:false, fog:false});
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = 'Night stars';
  sky.add(stars);
  const sunMaterial = new THREE.MeshBasicMaterial({color:'#fff0bf', transparent:true, depthWrite:false, fog:false});
  const moonMaterial = new THREE.MeshBasicMaterial({color:'#d5e4ff', transparent:true, depthWrite:false, fog:false});
  const sun = new THREE.Mesh(new THREE.SphereGeometry(.7, 16, 12), sunMaterial);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(.52, 16, 12), moonMaterial);
  sun.name = 'Sun';moon.name = 'Moon';
  sky.add(sun, moon);
  const porchLight = new THREE.PointLight('#ffbe77', 0, 5.5, 2);
  porchLight.position.set(3.7, 1.1, -2.7);
  sky.add(porchLight);
  const baseShadowIntensity=clamp(finite(sunLight.shadow?.intensity,1),0,1);
  let targetSeconds=0,current=getDaylight(0,{cycleSeconds,startPhase}),transition=null,disposed=false;
  const sourcePosition=data=>{
    const sunlight=data.sunVisibility,moonlight=1-sunlight;
    return {x:data.sunPosition.x*sunlight+data.moonPosition.x*moonlight,
      y:Math.max(8,data.sunPosition.y*sunlight+data.moonPosition.y*moonlight),z:data.sunPosition.z};
  };
  const firstPosition=sourcePosition(current);
  sunLight.position.set(firstPosition.x,firstPosition.y,firstPosition.z);
  function shadow(value){if(sunLight.shadow)sunLight.shadow.intensity=clamp(value,0,baseShadowIntensity);}
  function apply(data,shadowIntensity){
    current=data;
    if (renderer) {renderer.setClearColor?.(current.sky);renderer.toneMappingExposure = current.exposure;}
    scene.background?.set?.(current.sky);
    scene.fog?.color?.set?.(current.fog);
    groundMaterial?.color?.set?.(current.sky);
    sunLight.color.set(current.sun);
    sunLight.intensity = current.sunIntensity;
    shadow(shadowIntensity);
    hemisphereLight.color.set(current.skyLight);
    hemisphereLight.groundColor.set(current.groundLight);
    hemisphereLight.intensity = current.hemisphereIntensity;
    stars.visible = current.starsOpacity > .005;
    starMaterial.opacity = current.starsOpacity;
    sun.position.set(current.sunPosition.x, current.sunPosition.y, current.sunPosition.z);
    moon.position.set(current.moonPosition.x, current.moonPosition.y, current.moonPosition.z);
    sun.visible = current.sunVisibility > .01;
    moon.visible = current.moonVisibility > .01;
    sunMaterial.opacity = current.sunVisibility;
    sunMaterial.color.set(current.sun);
    moonMaterial.opacity = current.moonVisibility;
    porchLight.intensity = current.starsOpacity * 1.7;
    current.shadowIntensity=finite(sunLight.shadow?.intensity,shadowIntensity);
    current.lightPosition={x:sunLight.position.x,y:sunLight.position.y,z:sunLight.position.z};
    return current;
  }
  function dampPosition(target,dt){
    if(dt<=0)return;
    const dx=target.x-sunLight.position.x,dy=target.y-sunLight.position.y,dz=target.z-sunLight.position.z;
    const distance=Math.hypot(dx,dy,dz);
    if(distance<.000001)return;
    const fraction=Math.min(1-Math.exp(-dt*2.5),dt*2.5/distance);
    sunLight.position.set(sunLight.position.x+dx*fraction,Math.max(8,sunLight.position.y+dy*fraction),sunLight.position.z+dz*fraction);
  }
  function transitionData(from,to,amount){
    const data={...to},blend=smooth(amount);
    for(const key of ['sky','fog','sun','skyLight','groundLight'])data[key]=mixHex(from[key],to[key],blend);
    for(const key of ['sunIntensity','hemisphereIntensity','exposure','starsOpacity'])data[key]=from[key]+(to[key]-from[key])*blend;
    data.phase=wrap(from.phase+wrap(to.phase-from.phase)*blend);
    data.period=data.phase>=.19&&data.phase<.31?'sunrise':data.phase>=.31&&data.phase<.69?'day':data.phase>=.69&&data.phase<.83?'sunset':'night';
    data.label={sunrise:'Sunrise',day:'Daylight',sunset:'Sunset',night:'Moonlit night'}[data.period];
    const minute=Math.floor(data.phase*1440);data.clock=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
    return data;
  }
  /** Begin a sky crossfade. Directional shadows relocate only while invisible. */
  function transitionTo(seconds,{duration=1.4,reducedMotion=false}={}){
    if(disposed||typeof seconds!=='number'||!Number.isFinite(seconds))return current;
    targetSeconds=seconds;
    const from={...current,sunPosition:{...current.sunPosition},moonPosition:{...current.moonPosition}};
    transition={from,elapsed:0,duration:clamp(finite(duration,1.4),.4,5),startShadow:finite(sunLight.shadow?.intensity,baseShadowIntensity),reducedMotion:reducedMotion===true,stage:0,relocated:false};
    current={...current,transitioning:true,transitionProgress:0,targetPhase:getDaylight(targetSeconds,{cycleSeconds,startPhase}).phase};
    // This is also the first hidden frame for reduced-motion skips. The next
    // rendered update holds the old direction before moving it out of sight.
    if(transition.reducedMotion){
      const target=getDaylight(targetSeconds,{cycleSeconds,startPhase});
      current=apply({...target,sunPosition:from.sunPosition,moonPosition:from.moonPosition,sunVisibility:0,moonVisibility:0,transitioning:true,transitionProgress:0,targetPhase:target.phase},0);
    }
    return current;
  }
  /** dt is real rendered seconds, independently of the caller's game clock. */
  function update(seconds,dt){
    if(disposed)return current;
    const previousTarget=targetSeconds;
    targetSeconds=finite(seconds,targetSeconds);
    const step=clamp(finite(dt,Math.min(.05,Math.abs(targetSeconds-previousTarget))),0,.1);
    const target=getDaylight(targetSeconds,{cycleSeconds,startPhase});
    if(!transition){
      dampPosition(sourcePosition(target),step);
      return apply({...target,transitioning:false,transitionProgress:1,targetPhase:target.phase},baseShadowIntensity);
    }
    const pending=transition;
    if(pending.reducedMotion){
      const stage=pending.stage++;
      if(stage===0)return apply({...target,sunPosition:pending.from.sunPosition,moonPosition:pending.from.moonPosition,sunVisibility:0,moonVisibility:0,transitioning:true,transitionProgress:.25,targetPhase:target.phase},0);
      if(stage===1){
        const position=sourcePosition(target);sunLight.position.set(position.x,position.y,position.z);
        return apply({...target,sunVisibility:0,moonVisibility:0,transitioning:true,transitionProgress:.75,targetPhase:target.phase},0);
      }
      transition=null;
      return apply({...target,transitioning:false,transitionProgress:1,targetPhase:target.phase},baseShadowIntensity);
    }
    pending.elapsed=Math.min(pending.duration,pending.elapsed+step);
    const progress=pending.elapsed/pending.duration;
    const data=transitionData(pending.from,target,progress);
    let visibility=progress<.25?1-smooth(progress/.25):progress>.75?smooth((progress-.75)/.25):0;
    let shadowIntensity=progress<.25?pending.startShadow*visibility:progress>.75?baseShadowIntensity*visibility:0;
    if(progress>=.25&&progress<=.75){
      // Set the shadow contribution to zero before changing its direction.
      // Keep tracking the advancing clock while hidden, so the resumed
      // shadow does not need to rush to catch up after its fade-in.
      shadow(0);
      const position=sourcePosition(target);sunLight.position.set(position.x,position.y,position.z);
      pending.relocated=true;
    }
    const bodyPositions=pending.relocated?target:pending.from;
    data.sunPosition=bodyPositions.sunPosition;data.moonPosition=bodyPositions.moonPosition;
    data.sunVisibility=bodyPositions.sunVisibility*visibility;
    data.moonVisibility=bodyPositions.moonVisibility*visibility;
    data.transitioning=progress<1;data.transitionProgress=progress;data.targetPhase=target.phase;
    if(progress>=1){transition=null;visibility=1;shadowIntensity=baseShadowIntensity;}
    return apply(data,shadowIntensity);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    shadow(baseShadowIntensity);
    scene.remove(sky);
    starGeometry.dispose();starMaterial.dispose();
    sun.geometry.dispose();sunMaterial.dispose();
    moon.geometry.dispose();moonMaterial.dispose();
  }
  update(0,0);
  return {update,transitionTo,dispose,getState:()=>current,getTargetState:()=>getDaylight(targetSeconds,{cycleSeconds,startPhase})};
}
