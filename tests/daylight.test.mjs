import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {DAY_SECONDS, getDaylight, createDaylight} from '../daylight.js';

function fixture(options={}){
  const scene=new THREE.Scene(),sunLight=new THREE.DirectionalLight(),hemisphereLight=new THREE.HemisphereLight();
  sunLight.castShadow=true;
  const renderer={setClearColor(value){this.clearColor=value;},toneMappingExposure:1};
  const controller=createDaylight({THREE,scene,renderer,sunLight,hemisphereLight,...options});
  return{controller,sunLight,renderer,scene};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('daylight cycles through warm sunrise, bright day, warm sunset, and readable blue night',()=>{
  const dawn=getDaylight(0), day=getDaylight(0,{startPhase:.5}), dusk=getDaylight(0,{startPhase:.75}), night=getDaylight(0,{startPhase:0});
  assert.equal(dawn.period,'sunrise');assert.equal(day.period,'day');assert.equal(dusk.period,'sunset');assert.equal(night.period,'night');
  for(const warm of [dawn,dusk])assert.ok(parseInt(warm.sun.slice(1,3),16)>parseInt(warm.sun.slice(5,7),16));
  assert.ok(day.sunIntensity>dawn.sunIntensity&&dawn.sunIntensity>night.sunIntensity);
  assert.equal(day.starsOpacity,0);assert.ok(night.starsOpacity>.9);
  assert.ok(night.hemisphereIntensity>=1,'The field stays readable at night');
  assert.ok(parseInt(night.sky.slice(5,7),16)>parseInt(night.sky.slice(1,3),16));
});

test('cycle wrapping and clock values stay finite and continuous for invalid or large times',()=>{
  const before=getDaylight(DAY_SECONDS-.001), after=getDaylight(DAY_SECONDS+.001);
  assert.ok(Math.abs(before.sunIntensity-after.sunIntensity)<.001);
  assert.ok(Math.abs(before.starsOpacity-after.starsOpacity)<.001);
  for(const seconds of [0,-1,NaN,Infinity,1e12]){
    const data=getDaylight(seconds,{cycleSeconds:NaN,startPhase:Infinity});
    assert.ok(data.phase>=0&&data.phase<1);
    assert.match(data.clock,/^\d{2}:\d{2}$/);
    for(const key of ['sky','fog','sun','skyLight','groundLight'])assert.match(data[key],/^#[0-9a-f]{6}$/);
    for(const value of [data.sunIntensity,data.hemisphereIntensity,data.exposure,data.starsOpacity,...Object.values(data.sunPosition),...Object.values(data.moonPosition)])assert.ok(Number.isFinite(value));
  }
});

test('controller updates lights, background floor, and stars, and disposes only what it owns',()=>{
  const scene=new THREE.Scene();scene.fog=new THREE.Fog('#ffffff',28,60);
  const sunLight=new THREE.DirectionalLight(),hemisphereLight=new THREE.HemisphereLight();
  const farm=new THREE.Group();scene.add(sunLight,hemisphereLight,farm);
  const groundMaterial=new THREE.MeshStandardMaterial({color:'#ffffff'});
  const renderer={setClearColor(value){this.clearColor=value;},toneMappingExposure:1};
  const controller=createDaylight({THREE,scene,renderer,sunLight,hemisphereLight,groundMaterial,startPhase:0});
  const night=controller.update(0);
  assert.equal(renderer.clearColor,night.sky);assert.equal(sunLight.intensity,night.sunIntensity);
  assert.equal(hemisphereLight.intensity,night.hemisphereIntensity);
  assert.equal(scene.getObjectByName('Night stars').visible,true);
  assert.ok(Math.abs(scene.getObjectByName('Night stars').material.opacity-night.starsOpacity)<.000001);
  const paused=controller.update(0);assert.deepEqual(paused,night);
  controller.update(DAY_SECONDS/2);
  assert.equal(scene.getObjectByName('Night stars').visible,false);
  assert.equal(controller.getState().period,'day');
  controller.dispose();controller.dispose();
  assert.equal(scene.getObjectByName('Haywire daylight'),undefined);
  assert.ok(scene.children.includes(farm)&&scene.children.includes(sunLight)&&scene.children.includes(hemisphereLight));
  assert.equal(controller.update(120).period,'day');
});

test('time skips crossfade the palette and relocate shadows only when fully invisible',()=>{
  const{controller,sunLight}=fixture();
  const initial=controller.getState(),targetSeconds=67.2,target=getDaylight(targetSeconds);
  controller.transitionTo(targetSeconds);
  assert.equal(controller.getTargetState().phase,target.phase);
  assert.equal(controller.getState().phase,initial.phase);
  let previous=controller.getState(),relocated=false,intermediatePalette=false,sawFadeOut=false,sawFadeIn=false;
  for(let frame=0;frame<35;frame++){
    const data=controller.update(targetSeconds,.05);
    if(data.sky!==initial.sky&&data.sky!==target.sky)intermediatePalette=true;
    if(distance(data.lightPosition,previous.lightPosition)>.000001){
      relocated=true;
      assert.equal(data.shadowIntensity,0,'A light must never relocate while its shadow is visible');
    }
    if(data.transitionProgress<.25){assert.ok(data.shadowIntensity<=previous.shadowIntensity);sawFadeOut=true;}
    if(data.transitionProgress>.75&&data.transitioning){assert.ok(data.shadowIntensity>=previous.shadowIntensity);sawFadeIn=true;}
    assert.ok(data.lightPosition.y>=8,'Horizon light must not create long racing shadows');
    assert.equal(sunLight.shadow.intensity,data.shadowIntensity);
    previous=data;
  }
  assert.ok(relocated&&intermediatePalette&&sawFadeOut&&sawFadeIn);
  assert.equal(controller.getState().transitioning,false);
  assert.equal(controller.getState().sky,target.sky);
  assert.equal(controller.getState().shadowIntensity,1);
  assert.ok(distance(controller.getState().lightPosition,{x:0,y:19,z:-10})<.000001);
  controller.dispose();
});

test('rapid repeated time changes preserve current shadow strength and safely retarget',()=>{
  const{controller}=fixture();
  controller.transitionTo(67.2);
  for(let i=0;i<4;i++)controller.update(67.2,.04);
  const faded=controller.getState().shadowIntensity;
  assert.ok(faded>0&&faded<1);
  controller.transitionTo(127.2);
  assert.equal(controller.getState().shadowIntensity,faded);
  assert.ok(controller.update(127.2,.05).shadowIntensity<faded);
  for(let i=0;i<8;i++)controller.update(127.2,.05);
  assert.equal(controller.getState().shadowIntensity,0);
  controller.transitionTo(177.6);
  assert.equal(controller.getState().shadowIntensity,0);
  let previous=controller.getState();
  for(let i=0;i<35;i++){
    const data=controller.update(177.6,.05);
    if(distance(data.lightPosition,previous.lightPosition)>.000001)assert.equal(data.shadowIntensity,0);
    previous=data;
  }
  assert.equal(controller.getState().transitioning,false);
  assert.equal(controller.getState().sky,getDaylight(177.6).sky);
  controller.dispose();
});

test('reduced motion changes time safely in static frames even with a frozen clock',()=>{
  const{controller}=fixture();
  const old=controller.getState().lightPosition;
  controller.transitionTo(67.2,{reducedMotion:true});
  assert.equal(controller.getState().shadowIntensity,0);
  assert.equal(controller.getState().sky,getDaylight(67.2).sky);
  const hiddenOld=controller.update(67.2,0);
  assert.deepEqual(hiddenOld.lightPosition,old);
  assert.equal(hiddenOld.shadowIntensity,0);
  const hiddenNew=controller.update(67.2,0);
  assert.ok(distance(hiddenNew.lightPosition,old)>1);
  assert.equal(hiddenNew.shadowIntensity,0);
  const settled=controller.update(67.2,0);
  assert.deepEqual(settled.lightPosition,hiddenNew.lightPosition);
  assert.equal(settled.shadowIntensity,1);
  assert.equal(settled.transitioning,false);
  controller.dispose();
});

test('pause freezes transition progress and ordinary light motion stays bounded',()=>{
  const{controller}=fixture();
  const initial=controller.getState().lightPosition;
  const ordinary=controller.update(67.2,.05);
  assert.ok(distance(initial,ordinary.lightPosition)<=.125001);
  assert.equal(ordinary.shadowIntensity,1);
  controller.transitionTo(127.2);
  const frozen=controller.update(127.2,.1);
  for(let i=0;i<5;i++)assert.deepEqual(controller.update(127.2,0),frozen);
  const resumed=controller.update(127.2,.05);
  assert.ok(resumed.transitionProgress>frozen.transitionProgress);
  const valid=controller.getState();
  assert.equal(controller.transitionTo(NaN),valid);
  const invalid=controller.update(Infinity,NaN);
  for(const value of [invalid.phase,invalid.shadowIntensity,invalid.transitionProgress,...Object.values(invalid.lightPosition)])assert.ok(Number.isFinite(value));
  controller.dispose();
});

test('an advancing clock is tracked while shadows are hidden rather than chased after fade-in',()=>{
  const{controller}=fixture({startPhase:.5});
  controller.transitionTo(60);
  let elapsed=0,previous=controller.getState();
  while(controller.getState().transitioning&&elapsed<2){
    elapsed+=.05;
    const data=controller.update(60+elapsed,.05);
    if(distance(data.lightPosition,previous.lightPosition)>.000001)assert.equal(data.shadowIntensity,0);
    previous=data;
  }
  const target=controller.getTargetState(),weight=target.sunVisibility;
  const desired={x:target.sunPosition.x*weight+target.moonPosition.x*(1-weight),y:Math.max(8,target.sunPosition.y*weight+target.moonPosition.y*(1-weight)),z:target.sunPosition.z};
  assert.ok(distance(controller.getState().lightPosition,desired)<2.5);
  assert.equal(controller.getState().shadowIntensity,1);
  controller.dispose();
});
