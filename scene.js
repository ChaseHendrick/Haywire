import * as THREE from './vendor/three.module.js';
import {createHayPhysics,MAX_HAY_BODIES} from './physics.js';
import {createDaylight,getDaylight} from './daylight.js';

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const hash = (n) => { const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); };
export function createScene(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); }
  catch { return createFallback(canvas); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor('#e8eee3');
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();
  const opaqueObjects=[];
  scene.fog=new THREE.Fog('#e8eee3',28,60);
  const camera=new THREE.OrthographicCamera(-9,9,7,-7,.1,100);
  const cameraTarget=new THREE.Vector3(0,.3,0),cameraDistance=24;
  let yaw=Math.atan2(12,16),elevation=.575;
  function updateCamera(){camera.position.set(Math.sin(yaw)*Math.cos(elevation)*cameraDistance,Math.sin(elevation)*cameraDistance+cameraTarget.y,Math.cos(yaw)*Math.cos(elevation)*cameraDistance);camera.lookAt(cameraTarget);camera.updateMatrixWorld();}
  updateCamera();
  const light=new THREE.DirectionalLight('#fff6d7',3.1);
  light.position.set(-7,13,7); light.castShadow=true;
  light.shadow.mapSize.set(2048,2048); light.shadow.camera.left=-12; light.shadow.camera.right=12;
  light.shadow.camera.top=12; light.shadow.camera.bottom=-12; light.shadow.normalBias=.035;
  const hemisphere=new THREE.HemisphereLight('#f8fff2','#87976e',2.4);scene.add(light,hemisphere);
  const mats={grass:mat('#9aaf76'),soil:mat('#d0b487'),edge:mat('#b7c692'),wood:mat('#c7a47b'),dark:mat('#69704f'),red:mat('#bf7055'),roof:mat('#596a57'),cream:mat('#f4e8ca'),metal:mat('#7c9290'),orange:mat('#e48445'),leaf:mat('#6d8a57')};
  // Leave a small land margin around the barn and its roof overhang.
  const ground=mesh(new THREE.CylinderGeometry(7.45,7.62,.42,80),mats.edge,0,-.05,0);ground.scale.z=.78;
  const turf=mesh(new THREE.CylinderGeometry(7.41,7.41,.09,80),mats.grass,0,.21,0);turf.scale.z=.78;
  const fieldMat=mat('#c4a774');
  mesh(new THREE.BoxGeometry(7.35,.06,6.12),fieldMat,0,.29,.15);
  for(let i=0;i<11;i++){
    const z=-2.75+i*.56;
    const line=mesh(new THREE.BoxGeometry(7.5,.025,.022),mat('#b89967'),0,.34,z);line.receiveShadow=false;
  }
  const floor=mesh(new THREE.PlaneGeometry(200,200),mat('#e8eee3'),0,-.35,0);floor.rotation.x=-Math.PI/2;
  const daylight=createDaylight({THREE,scene,renderer,sunLight:light,hemisphereLight:hemisphere,groundMaterial:floor.material,startPhase:.22});
  // A small farm, built from reusable geometry and warm, flat materials.
  const barn=new THREE.Group();barn.position.set(3.9,.28,-3.35);scene.add(barn);
  addBox(barn,1.65,1.38,1.35,mats.red,0,.69,0);
  const roof=addBox(barn,1.95,.18,1.15,mats.roof,0,1.63,-.35);roof.rotation.x=-.6;
  const roof2=addBox(barn,1.95,.18,1.15,mats.roof,0,1.63,.35);roof2.rotation.x=.6;
  addBox(barn,.6,.87,.045,mats.cream,0,.43,.697);
  addBox(barn,.075,.95,.06,mats.wood,0,.46,.728);
  addBox(barn,.47,.35,.05,mats.cream,-.55,1.02,.695);
  addBox(barn,.32,.22,.055,mats.roof,-.55,1.02,.726);
  addBox(barn,.18,.5,.22,mats.cream,.62,1.8,-.1);
  const mill=new THREE.Group();mill.position.set(-4.7,.26,-2.55);scene.add(mill);
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(.29,.49,2.25,7),mats.cream);tower.position.y=1.12;tower.castShadow=true;mill.add(tower);
  const head=new THREE.Mesh(new THREE.ConeGeometry(.5,.55,7),mats.roof);head.position.y=2.47;mill.add(head);
  const blades=new THREE.Group();blades.position.set(0,2.1,.4);mill.add(blades);
  for(let i=0;i<4;i++){const arm=addBox(blades,.17,1.35,.075,mats.wood,0,0,0);arm.rotation.z=i*Math.PI/2;}
  const hub=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),mats.orange);blades.add(hub);
  for(let i=0;i<8;i++){
    const x=-3.55+i*1.08;
    addBox(scene,.12,.66,.12,mats.wood,x,.59,-3.37);
    if(i<7){addBox(scene,1.08,.085,.08,mats.cream,x+.54,.74,-3.37);addBox(scene,1.08,.085,.08,mats.cream,x+.54,.48,-3.37);}
  }
  for(let i=0;i<4;i++){
    const z=-.9+i*1.1;
    addBox(scene,.12,.66,.12,mats.wood,-4.3,.59,z);
    if(i<3)addBox(scene,.08,.085,1.1,mats.cream,-4.3,.74,z+.55);
  }
  const conveyor=new THREE.Group();conveyor.position.set(4.65,.45,1.95);conveyor.rotation.y=-.32;scene.add(conveyor);
  addBox(conveyor,.7,.16,2.8,mats.dark,0,.44,0);
  for(let i=0;i<13;i++)addBox(conveyor,.68,.07,.07,mats.metal,0,.55,-1.25+i*.21);
  for(let i=0;i<4;i++)addBox(conveyor,.09,.75,.09,mats.metal,i%2? .24:-.24,0,i>1?.85:-.85);
  const crates=[];
  for(let i=0;i<4;i++){
    const crate=addBox(scene,.5,.5,.5,mats.wood,3.72+(i%2)*.63,.54+Math.floor(i/2)*.5,3.38);
    addBox(crate,.52,.07,.53,mats.cream,0,.1,0);crates.push(crate);
  }
  for(let i=0;i<9;i++){
    const a=i*2.399, x=Math.cos(a)*5.85,z=Math.sin(a)*4.23;
    if(z< -2 || x>3.5)continue;
    const plant=mesh(new THREE.ConeGeometry(.25,.65,5),mats.leaf,x,.6,z);
    mesh(new THREE.CylinderGeometry(.045,.05,.45,5),mats.wood,x,.4,z);plant.rotation.z=.1;
  }
  for(let i=0;i<32;i++){
    const a=i*2.399,x=Math.cos(a)* (5.2+hash(i)*.65),z=Math.sin(a)*(3.85+hash(i+50)*.5);
    mesh(new THREE.SphereGeometry(.035,5,4),i%2?mats.cream:mats.orange,x,.34,z);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.82,1,64),new THREE.MeshBasicMaterial({color:'#fff4cc',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
  const scan=new THREE.Mesh(new THREE.RingGeometry(.82,1,80),new THREE.MeshBasicMaterial({color:'#a0de61',transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}));scan.rotation.x=-Math.PI/2;scan.renderOrder=5;scan.visible=false;scene.add(scan);
  const scanBorder=new THREE.Mesh(new THREE.RingGeometry(.79,1.03,80),new THREE.MeshBasicMaterial({color:'#243c21',transparent:true,opacity:.85,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}));scanBorder.renderOrder=4;scan.add(scanBorder);
  const needle=new THREE.Group();scene.add(needle);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.025,.009,.64,8),new THREE.MeshStandardMaterial({color:'#fff3a0',metalness:.8,roughness:.25}));shaft.position.y=.38;needle.add(shaft);
  const eye=new THREE.Mesh(new THREE.TorusGeometry(.065,.018,6,16),shaft.material);eye.position.y=.74;needle.add(eye);
  const needleHit=new THREE.Mesh(new THREE.SphereGeometry(.42,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));needleHit.position.y=.58;needle.add(needleHit);
  const halo=new THREE.Mesh(new THREE.CylinderGeometry(.22,.4,2,24,1,true),new THREE.MeshBasicMaterial({color:'#fff7b6',transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));halo.position.y=1;needle.add(halo);
  const drone=new THREE.Group();scene.add(drone);
  addBox(drone,.42,.18,.34,mats.orange,0,0,0);addBox(drone,.2,.09,.23,mats.cream,0,.12,0);
  const propellers=[];
  for(const x of [-.34,.34])for(const z of [-.28,.28]){
    addBox(drone,.045,.06,.55,mats.dark,x*.8,0,0).rotation.y=x<0?-.5:.5;
    const prop=addBox(drone,.45,.028,.07,mats.dark,x,.07,z);propellers.push(prop);
  }
  const interactiveObjects=[{id:'barn',label:'Supply barn',object:barn},{id:'windmill',label:'Windmill',object:mill},{id:'conveyor',label:'Sorting belt',object:conveyor},...crates.map(object=>({id:'crates',label:'Salvage crates',object})),{id:'drone',label:'Helper drone',object:drone}];
  const objectHighlight=new THREE.BoxHelper(barn,'#d7ebbe');objectHighlight.visible=false;objectHighlight.material.transparent=true;objectHighlight.material.opacity=.7;scene.add(objectHighlight);
  const lantern=new THREE.PointLight('#ffbf69',0,5,2);lantern.position.set(3.9,1,-2.55);scene.add(lantern);
  let sceneryHover=null,feedback=null,daySeconds=0;
  const strawMeshes=[];const strawData=[];const dummy=new THREE.Object3D();let lastDepths=[],lastStage=-1;
  const physics=createHayPhysics();let currentState;
  const particleMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.044,.044,.32),mat('#d9b76a'),MAX_HAY_BODIES);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(particleMesh);
  for(let i=0;i<MAX_HAY_BODIES;i++){dummy.scale.setScalar(0);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);}
  let cols=12,rows=10,hover=null,lastTool='rake',fieldBoxes=[];
  let unit=.565;
  function center(c,r){return {x:(c-(cols-1)/2)*unit,z:(r-(rows-1)/2)*unit+.15};}
  function cellHeight(col,row){const cell=currentState?.field.cells[Math.round(row)*cols+Math.round(col)];if(!cell||cell.depth<=0)return .35;const mound=1.12-.4*Math.sqrt(((Math.round(col)-cols/2)/cols)**2+((Math.round(row)-rows/2)/rows)**2);return .36+clamp(cell.depth/cell.maxDepth,0,1)*mound;}
  function setupField(state){
    for(const s of strawMeshes){scene.remove(s);s.geometry.dispose();s.material.dispose();}strawMeshes.length=0;strawData.length=0;
    cols=state.field.cols;rows=state.field.rows;unit=6.7/Math.max(cols,rows*1.16);
    const perCell=Math.max(12,Math.floor(6200/(cols*rows)));
    const count=cols*rows*perCell;
    const colors=['#d2a24c','#e0b65f','#eccb79','#bf8e3b'];
    for(let color=0;color<4;color++){
      const m=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.025,.35),mat('#ffffff'),Math.ceil(count/4));
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=true;m.receiveShadow=true;scene.add(m);strawMeshes.push(m);
      strawData.push([]);
    }
    for(let i=0;i<count;i++){
      const cell=Math.floor(i/perCell),col=cell%cols,row=Math.floor(cell/cols),p=center(col,row),color=i%4;
      const f=hash(i+state.seed%10000),g=hash(i+71),h=hash(i+111);
      const mound=1.12-.4*Math.sqrt(((col-cols/2)/cols)**2+((row-rows/2)/rows)**2);
      const material=state.field.cells[cell].material;const tint=material==='packed'?'#a87937':material==='tangled'?'#839650':material==='static'?'#9da8b0':colors[color];strawMeshes[color].setColorAt(strawData[color].length,new THREE.Color(tint));
      strawData[color].push({cell,x:p.x+(f-.5)*unit*1.3,z:p.z+(g-.5)*unit*1.3,h:h,baseHeight:.36+h*mound,rx:hash(i+157)*Math.PI,ry:hash(i+181)*Math.PI,rz:(hash(i+229)-.5)*.65,scale:.7+hash(i+12)*.8});
    }
    fieldBoxes=state.field.cells.map(()=>new THREE.Box3());lastDepths=[];lastStage=state.contractIndex;
  }
  function updateField(state){
    if(lastStage!==state.contractIndex || cols!==state.field.cols || rows!==state.field.rows)setupField(state);
    const changed=state.field.cells.some((cell,i)=>lastDepths[i]!==cell.depth);
    if(!changed)return;
    for(let color=0;color<4;color++){
      const data=strawData[color],m=strawMeshes[color];
      for(let i=0;i<data.length;i++){
        const d=data[i],cell=state.field.cells[d.cell],ratio=cell.maxDepth>0?clamp(cell.depth/cell.maxDepth,0,1):0;
        if(d.h>ratio || ratio<.002)dummy.scale.setScalar(0);
        else {dummy.position.set(d.x,d.baseHeight,d.z);dummy.rotation.set(d.rx,d.ry,d.rz);dummy.scale.set(d.scale,1,d.scale);}
        dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);
      }
      m.instanceMatrix.needsUpdate=true;
    }
    lastDepths=state.field.cells.map(c=>c.depth);
    for(let i=0;i<fieldBoxes.length;i++){const col=i%cols,row=Math.floor(i/cols),p=center(col,row),height=cellHeight(col,row);fieldBoxes[i].min.set(p.x-unit*.5,.34,p.z-unit*.5);fieldBoxes[i].max.set(p.x+unit*.5,height,p.z+unit*.5);}
  }
  function resize(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);const aspect=rect.width/rect.height;const height=aspect<1.3?12.7:10.7;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();}
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.35),point=new THREE.Vector3();
  function setRay(clientX,clientY){const rect=canvas.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);}
  function fieldHit(){let closest=null;const hitPoint=new THREE.Vector3();for(let i=0;i<fieldBoxes.length;i++){if(raycaster.ray.intersectBox(fieldBoxes[i],hitPoint)){const distance=raycaster.ray.origin.distanceTo(hitPoint);if(!closest||distance<closest.distance)closest={distance,point:hitPoint.clone(),cell:i};}}return closest;}
  function pickScenery(clientX,clientY){setRay(clientX,clientY);const hits=raycaster.intersectObjects(interactiveObjects.filter(entry=>entry.object.visible).map(entry=>entry.object),true);if(hits.length){const nearest=hits[0],hay=fieldHit();if(hay&&hay.distance<nearest.distance-.02)return null;const obstruction=raycaster.intersectObjects(opaqueObjects,false)[0];if(obstruction&&obstruction.distance<nearest.distance-.02)return null;const hit=nearest.object;const entry=interactiveObjects.find(entry=>{let object=hit;while(object){if(object===entry.object)return true;object=object.parent;}return false;});if(entry)return{id:entry.id,label:entry.label};}return null;}
  function projectScenery(id){const entry=interactiveObjects.find(entry=>entry.id===id);if(!entry||!entry.object.visible)return null;const box=new THREE.Box3().setFromObject(entry.object),v=box.getCenter(new THREE.Vector3()).project(camera),r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function orbit(dx,dy){yaw-=dx*.007;elevation=clamp(elevation+dy*.005,.22,1.22);updateCamera();}
  function zoom(amount){camera.zoom=clamp(camera.zoom*Math.exp(amount),.7,1.8);camera.updateProjectionMatrix();}
  function resetCamera(){yaw=Math.atan2(12,16);elevation=.575;camera.zoom=1;camera.updateProjectionMatrix();updateCamera();}
  function pick(clientX,clientY){setRay(clientX,clientY);const hay=fieldHit(),needleTarget=needle.visible?raycaster.intersectObject(needleHit,false)[0]:null;if(needleTarget&&(!hay||hay.cell===currentNeedleCell||needleTarget.distance<hay.distance)){const cell=currentNeedleCell;return{col:cell%cols,row:Math.floor(cell/cols)};}if(hay){const col=hay.point.x/unit+(cols-1)/2,row=(hay.point.z-.15)/unit+(rows-1)/2;return{col:clamp(col,0,cols-1),row:clamp(row,0,rows-1)};}if(!raycaster.ray.intersectPlane(plane,point))return null;const col=point.x/unit+(cols-1)/2,row=(point.z-.15)/unit+(rows-1)/2;if(col<-.5||row<-.5||col>cols-.5||row>rows-.5)return null;return {col,row};}
  function project(col,row,height){const p=center(col,row),v=new THREE.Vector3(p.x,height??cellHeight(col,row),p.z).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function burst(col,row,type='hay'){
    if(!currentState||currentState.settings.reducedMotion)return;
    const p=center(col,row);physics.syncField(currentState,unit);physics.emit(p.x,p.z,currentState.selectedTool,type==='needle'?14:type==='stroke'?3:7,1.2);
  }
  function interact(col,row,tool,radius,dt){const p=center(col,row);physics.stir?.(p.x,p.z,tool,radius*unit,dt);}
  let previousTime=0,animationTime=0,currentNeedleCell=0;
  function render(state,view,time,running=true){
    const dt=clamp((time-previousTime)/1000,0,.05)||0;previousTime=time;currentState=state;updateField(state);physics.syncField(state,unit);if(running&&!state.settings.reducedMotion){physics.step(dt);animationTime+=dt*1000;daySeconds+=dt;}currentNeedleCell=state.field.needleCell;time=animationTime;
    const day=daylight.update(daySeconds,running&&!state.settings.reducedMotion?dt:0);lantern.intensity=day.starsOpacity*3;
    blades.rotation.z=time*.00016;
    drone.visible=!!state.upgrades.automation1;
    if(drone.visible){drone.position.set(Math.sin(time*.0003)*2.6,2.2+Math.sin(time*.002)*.1,Math.cos(time*.0003)*2);propellers.forEach(p=>p.rotation.y=time*.035);}
    objectHighlight.visible=!!sceneryHover;
    if(sceneryHover){const entry=interactiveObjects.find(entry=>entry.id===sceneryHover.id&&entry.object.visible);if(entry)objectHighlight.setFromObject(entry.object);else objectHighlight.visible=false;}
    if(feedback){const age=time-feedback.start;const entry=interactiveObjects.find(entry=>entry.id===feedback.id);if(entry){const pulse=age<700?1+Math.sin(age/700*Math.PI)*.065:1;entry.object.scale.setScalar(pulse);}if(age>=700)feedback=null;}
    if(hover&&!state.field.needleFound){const p=center(hover.col,hover.row);ring.visible=true;ring.position.set(p.x,cellHeight(hover.col,hover.row)+.035,p.z);ring.scale.setScalar(Math.max(.4,view.radius*unit));ring.material.color.set(state.selectedTool==='magnet'?'#9fced0':state.selectedTool==='vacuum'?'#f1a873':'#fff4cc');}else ring.visible=false;
    const needleCol=state.field.needleCell%cols,needleRow=Math.floor(state.field.needleCell/cols),np=center(needleCol,needleRow);
    needle.visible=view.needleExposed||state.field.needleFound;
    if(needle.visible){needle.position.set(np.x,.38,np.z);needle.rotation.y=time*.0018;needle.position.y+=Math.sin(time*.004)*.045;halo.material.opacity=.16+Math.sin(time*.003)*.07;}
    scan.visible=!!view.clue&&!state.field.needleFound;
    if(scan.visible){const p=center(view.clue.col,view.clue.row);scan.position.set(p.x,cellHeight(view.clue.col,view.clue.row)+.06,p.z);scan.scale.setScalar((view.clue.radius||1)*unit*(1+.035*Math.sin(time*.004)));scan.material.opacity=.85+.1*Math.sin(time*.003);}
    const bodies=physics.getBodies();
    for(let i=0;i<MAX_HAY_BODIES;i++){const body=bodies[i];if(body){dummy.position.set(body.position.x,body.position.y,body.position.z);dummy.quaternion.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w);dummy.scale.setScalar(1);}else dummy.scale.setScalar(0);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);}particleMesh.instanceMatrix.needsUpdate=true;
    renderer.render(scene,camera);
  }
  resize();
  return {render,pick,pickScenery,project,projectScenery,orbit,zoom,resetCamera,burst,interact,resize,getPhysicsStats:()=>physics.getStats(),getCameraState:()=>({yaw,elevation,zoom:camera.zoom}),getDaylightState:()=>daylight.getState(),advanceTime(){const phase=getDaylight(daySeconds,{startPhase:.22}).phase;daySeconds+=([.22,.5,.75,.96,1.22].find(next=>next>phase+.015)-phase)*240;daylight.transitionTo(daySeconds,{reducedMotion:currentState?.settings.reducedMotion});},settleLighting(){if(daylight.getState().transitioning)daylight.transitionTo(daySeconds,{reducedMotion:true});},setSceneryHover(p){sceneryHover=p;},activateScenery(id){const prior=interactiveObjects.find(entry=>entry.id===feedback?.id);if(prior)prior.object.scale.setScalar(1);feedback={id,start:animationTime};},setHover(p){hover=p;},resetField(){lastStage=-1;},dispose(){physics.dispose();daylight.dispose();renderer.dispose();}};
  function mat(color){return new THREE.MeshStandardMaterial({color,roughness:.92});}
  function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);opaqueObjects.push(m);return m;}
  function addBox(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(parent===scene)opaqueObjects.push(m);return m;}
}

function createFallback(canvas){
  const ctx=canvas.getContext('2d');const physics=createHayPhysics();let state,hover,previous=0,physicalUnit=.565;
  let angle=0,magnification=1,daySeconds=0,sceneryHover;
  const rect=()=>canvas.getBoundingClientRect();
  const scale=()=>{const r=rect(),c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));return magnification*Math.min(r.width/((state.field.cols+6)*c+(state.field.rows+6)*s),r.height/((state.field.rows+6)*c+(state.field.cols+6)*s));};
  function resize(){const r=rect();canvas.width=r.width*devicePixelRatio;canvas.height=r.height*devicePixelRatio;}
  function project(col,row){const r=rect(),u=scale(),x=(col-(state.field.cols-1)/2)*u,y=(row-(state.field.rows-1)/2)*u;return{x:r.left+r.width/2+x*Math.cos(angle)-y*Math.sin(angle),y:r.top+r.height/2+x*Math.sin(angle)+y*Math.cos(angle)};}
  function pick(x,y){if(!state)return null;const r=rect(),u=scale(),dx=(x-r.left-r.width/2)/u,dy=(y-r.top-r.height/2)/u;const col=dx*Math.cos(angle)+dy*Math.sin(angle)+(state.field.cols-1)/2,row=-dx*Math.sin(angle)+dy*Math.cos(angle)+(state.field.rows-1)/2;return col>=-.5&&row>=-.5&&col<state.field.cols-.5&&row<state.field.rows-.5?{col,row}:null;}
  function scenery(){if(!state)return[];return[{id:'barn',label:'Supply barn',col:state.field.cols+.7,row:-1},{id:'windmill',label:'Windmill',col:-2,row:-1},{id:'crates',label:'Salvage crates',col:state.field.cols+.7,row:state.field.rows-1},{id:'conveyor',label:'Sorting belt',col:state.field.cols+.7,row:state.field.rows*.55},...(state.upgrades.automation1?[{id:'drone',label:'Helper drone',col:1,row:-2}]:[])];}
  function projectScenery(id){const object=scenery().find(object=>object.id===id);return object?project(object.col,object.row):null;}
  function pickScenery(x,y){const u=scale();return scenery().find(object=>{const p=project(object.col,object.row);return Math.hypot(x-p.x,y-p.y)<u*.8;})||null;}
  function render(s,view,time,running=true){
    state=s;physicalUnit=6.7/Math.max(s.field.cols,s.field.rows*1.16);const dt=clamp((time-previous)/1000,0,.05);previous=time;
    physics.syncField(s,physicalUnit);if(running&&!s.settings.reducedMotion)physics.step(dt);
    if(running&&!s.settings.reducedMotion)daySeconds+=dt;const day=getDaylight(daySeconds,{startPhase:.22});
    const r=rect(),u=scale();ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle=day.sky;ctx.fillRect(0,0,r.width,r.height);ctx.fillStyle='#9aaf76';ctx.save();ctx.translate(r.width/2,r.height/2);ctx.rotate(angle);ctx.beginPath();ctx.roundRect(-u*(s.field.cols+2)/2,-u*(s.field.rows+2)/2,u*(s.field.cols+2),u*(s.field.rows+2),25);ctx.fill();ctx.restore();
    s.field.cells.forEach((c,i)=>{const p=project(i%s.field.cols,Math.floor(i/s.field.cols)),x=p.x-r.left,y=p.y-r.top;const ratio=c.maxDepth?c.depth/c.maxDepth:0;ctx.fillStyle=c.depth>0?'#e3bb6b':'#c1a273';ctx.globalAlpha=c.depth>0?.4+.6*ratio:1;ctx.fillRect(x-u*.48,y-u*.48,u*.96,u*.96);ctx.globalAlpha=1;for(let a=0;a<ratio*14;a++){ctx.strokeStyle=c.material==='tangled'?'#839650':c.material==='static'?'#9da8b0':a%2?'#f4d792':'#b68b48';ctx.beginPath();ctx.moveTo(x+(hash(i*18+a)-.5)*u,y+(hash(i*29+a)-.5)*u);ctx.lineTo(x+(hash(i*18+a)-.5)*u+u*.25,y+(hash(i*29+a)-.5)*u+u*.12);ctx.stroke();}});
    if(view.needleExposed||s.field.needleFound){const i=s.field.needleCell,p=project(i%s.field.cols,Math.floor(i/s.field.cols));ctx.fillStyle='#fff7bf';ctx.font='30px sans-serif';ctx.fillText('✦',p.x-r.left-12,p.y-r.top+10);}
    if(view.clue&&!s.field.needleFound){const p=project(view.clue.col,view.clue.row);ctx.strokeStyle='#72944e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x-r.left,p.y-r.top,view.clue.radius*u,0,Math.PI*2);ctx.stroke();}
    if(hover){const p=project(hover.col,hover.row);ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x-r.left,p.y-r.top,view.radius*u,0,Math.PI*2);ctx.stroke();}
    for(const body of physics.getBodies()){const p=project(body.position.x/physicalUnit+(s.field.cols-1)/2,(body.position.z-.15)/physicalUnit+(s.field.rows-1)/2);ctx.strokeStyle='#d2a654';ctx.lineWidth=2;ctx.save();ctx.translate(p.x-r.left,p.y-r.top);ctx.rotate(body.quaternion.y*3);ctx.beginPath();ctx.moveTo(-u*.2,0);ctx.lineTo(u*.2,0);ctx.stroke();ctx.restore();}
    for(const object of scenery()){const p=project(object.col,object.row);ctx.fillStyle=object.id==='barn'?'#bf7055':object.id==='windmill'?'#f4e8ca':object.id==='drone'?'#e48445':'#987953';ctx.fillRect(p.x-r.left-u*.6,p.y-r.top-u*.6,u*1.2,u*1.2);ctx.fillStyle='#fff4cf';ctx.font=Math.max(10,u*.65)+'px sans-serif';ctx.textAlign='center';ctx.fillText({barn:'⌂',windmill:'✳',crates:'▣',conveyor:'▥',drone:'✣'}[object.id],p.x-r.left,p.y-r.top+u*.2);if(sceneryHover?.id===object.id){ctx.strokeStyle='#d7ebbe';ctx.lineWidth=2;ctx.strokeRect(p.x-r.left-u*.7,p.y-r.top-u*.7,u*1.4,u*1.4);}}ctx.textAlign='start';
    if(day.starsOpacity){ctx.globalAlpha=day.starsOpacity*.2;ctx.fillStyle='#081532';ctx.fillRect(0,0,r.width,r.height);ctx.globalAlpha=1;}
  }
  function burst(col,row,type='hay'){if(!state||state.settings.reducedMotion)return;physics.emit((col-(state.field.cols-1)/2)*physicalUnit,(row-(state.field.rows-1)/2)*physicalUnit+.15,state.selectedTool,type==='needle'?14:type==='stroke'?3:7,1.2);}
  function interact(col,row,tool,radius,dt){if(!state)return;physics.stir?.((col-(state.field.cols-1)/2)*physicalUnit,(row-(state.field.rows-1)/2)*physicalUnit+.15,tool,radius*physicalUnit,dt);}
  resize();return{render,pick,pickScenery,project,projectScenery,burst,interact,resize,orbit(dx){angle-=dx*.007;},zoom(amount){magnification=clamp(magnification*Math.exp(amount),.7,1.8);},resetCamera(){angle=0;magnification=1;},getCameraState:()=>({yaw:angle,elevation:Math.PI/2,zoom:magnification,fallback:true}),getDaylightState:()=>getDaylight(daySeconds,{startPhase:.22}),advanceTime(){const phase=getDaylight(daySeconds,{startPhase:.22}).phase;daySeconds+=([.22,.5,.75,.96,1.22].find(next=>next>phase+.015)-phase)*240;},setSceneryHover(p){sceneryHover=p;},activateScenery(){},getPhysicsStats:()=>physics.getStats(),setHover(p){hover=p;},resetField(){},dispose(){physics.dispose();}};
}
