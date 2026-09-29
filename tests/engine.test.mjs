import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACTS, CHAPTERS, UPGRADES, TOOLS, RELICS, SCENERY, createState, restoreState, serializeState,
  derive, sweep, tick, buyUpgrade, selectTool, useItem, nextContract, toggleSetting, upgradeCost,toolEfficiency,inspectScenery,getResearchLock,startChallenge,
} from '../engine.js';

function assertFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `Non-finite numeric value: ${value}`);
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFinite);
}

// Advanced feature tests receive a purchased legacy kit; progression gates are
// tested separately and the campaign test buys research with actual progress.
function researchFixture(state,nodes=UPGRADES) {
  const completed=state.completed,events=[];
  state.completed=CONTRACTS.length;
  for(const node of nodes)events.push(...buyUpgrade(state,node.id));
  state.completed=completed;
  return events;
}

function finishSurvey(state) {
  const mastery=derive(state).contract.mastery;
  if(!mastery)return;
  selectTool(state,mastery.tool);
  for(let index=0;index<state.field.cells.length&&!state.field.needleFound;index++) {
    if(state.field.cells[index].material===mastery.material&&state.field.cells[index].maxDepth>0)sweep(state,index%state.field.cols,Math.floor(index/state.field.cols),.001);
  }
}

function clearAt(state, col, row) {
  const events = [];
  for (let i = 0; i < 600 && !state.field.needleFound && state.field.cells[row * state.field.cols + col].depth > 0; i += 1) {
    events.push(...sweep(state, col, row, 0.1));
    tick(state, 0.1);
  }
  return events;
}

test('fields are deterministic, finite, contain guaranteed loot, and vary by seed', () => {
  assert.deepEqual(createState(1234), createState(1234));
  assert.notDeepEqual(createState(1234).field, createState(4567).field);
  const state = createState(1234);
  assert.equal(state.credits, 35);
  assert.equal(state.field.cells.length, 120);
  assert.ok(state.field.cells[state.field.needleCell].depth > 0);
  assert.ok(state.field.cells.some((cell) => cell.loot === 'pulse'));
  assert.ok(state.field.cells.some((cell) => cell.loot === 'overdrive'));
  assert.ok(state.field.cells.filter((cell) => cell.loot?.startsWith('relic:')).length >= 2);
  assertFinite(state);
  assertFinite(derive(state));
});

test('sweeping only affects the real spatial neighborhood, and clears reward once', () => {
  const state = createState(222);
  state.field.needleCell = state.field.cells.length - 1;
  const target = state.field.cells[0];
  target.depth = target.maxDepth = 3;
  target.loot = 'cache';
  target.collected = false;
  const farDepth = state.field.cells[80].depth;
  const hayBefore = derive(state).hayRemaining;
  const events = clearAt(state, 0, 0);
  assert.equal(target.depth, 0);
  assert.equal(state.field.cells[80].depth, farDepth);
  assert.ok(derive(state).hayRemaining < hayBefore);
  assert.equal(events.filter((event) => event.type === 'loot' && event.index === 0).length, 1);
  // Finish any neighboring tiles before comparing total payouts.
  for (let i = 0; i < 10; i += 1) sweep(state, 0, 0, 0.2);
  const earned = state.stats.earned;
  sweep(state, 0, 0, 0.2);
  sweep(state, 0, 0, 0.2);
  assert.equal(state.stats.earned, earned);
});

test('an exposed needle needs a direct manual sweep and pays exactly once', () => {
  const state = createState(40);
  state.field.needleCell = 13;
  state.field.cells[13].depth = 0;
  state.field.cells[13].collected = true;
  assert.equal(derive(state).needleExposed, true);
  assert.equal(sweep(state, 2, 1, 0.1).some((event) => event.type === 'needle'), false);
  const events = sweep(state, 1, 1, 0.1);
  assert.equal(events.filter((event) => event.type === 'needle').length, 1);
  assert.equal(state.completed, 0);
  assert.equal(state.field.needleRecovered,true);
  assert.equal(state.field.needleFound,false);
  assert.equal(derive(state).needleExposed,false);
  assert.equal(state.stats.needles, 1);
  assert.equal(sweep(state,1,1,.1).filter(event=>event.type==='needle').length,0);
  assert.equal(state.stats.needles,1);
});

test('needle recovery continues the hunt, and objective milestones and final bonuses pay once',()=>{
  const state=createState(99),events=[];
  state.field.needleCell=65;state.field.cells[65].depth=0;state.field.cells[65].collected=true;
  events.push(...sweep(state,5,5,.01));
  assert.equal(state.field.needleRecovered,true);
  assert.equal(state.field.needleFound,false);
  assert.equal(state.completed,0);
  assert.equal(events.find(event=>event.type==='needle').credits,25);
  assert.deepEqual(nextContract(state),[]);
  state.credits=100000;events.push(...researchFixture(state));
  for(let i=0;i<4000&&!state.field.needleFound;i++)events.push(...tick(state,.25));
  assert.equal(state.field.needleFound,true);
  assert.equal(state.completed,1);
  assert.equal(events.filter(event=>event.type==='needle').length,1);
  assert.equal(events.filter(event=>event.type==='complete').length,1);
  assert.equal(events.find(event=>event.type==='complete').bonus,CONTRACTS[0].bonus);
  for(const id of ['processing','salvage','needle'])assert.equal(events.filter(event=>event.type==='objective'&&event.id===id).length,1);
  const savedCredits=state.credits,savedItems={...state.items};
  for(let i=0;i<10;i++){assert.deepEqual(tick(state,.25),[]);assert.deepEqual(sweep(state,5,5,.2),[]);}
  assert.equal(state.credits,savedCredits);assert.deepEqual(state.items,savedItems);
  assert.equal(derive(state).objectives.every(objective=>objective.complete),true);
});

test('materials make the vacuum, magnet, and cutter meaningfully different',()=>{
  const original=createState(155);original.credits=100000;
  researchFixture(original);
  const removed=(tool,material)=>{
    const state=restoreState(serializeState(original));
    state.field.needleCell=119;
    const cell=state.field.cells[13];cell.depth=cell.maxDepth=30;cell.material=material;cell.loot=null;cell.collected=false;
    selectTool(state,tool);sweep(state,1,1,.2);return 30-cell.depth;
  };
  assert.ok(removed('vacuum','loose')>removed('cutter','loose'));
  assert.ok(removed('cutter','packed')>removed('rake','packed')*2);
  assert.ok(removed('cutter','tangled')>removed('vacuum','tangled')*4);
  assert.ok(removed('magnet','static')>removed('cutter','static')*4);
  const view=derive(original);
  assert.equal(view.materialSummary.length,4);
  assert.ok(Math.abs(view.materialSummary.reduce((total,material)=>total+material.remaining,0)-view.hayRemaining)<.000001);
  assertFinite(view.efficiencies);
});

test('advanced survey routes recovered-needle hunts to salvage and reduces goals',()=>{
  const state=createState(877);state.credits=100000;
  researchFixture(state,UPGRADES.filter(node=>node.branch==='survey'&&node.tier<=5));
  state.field.cells[state.field.needleCell].depth=0;state.field.cells[state.field.needleCell].collected=true;
  sweep(state,state.field.needleCell%state.field.cols,Math.floor(state.field.needleCell/state.field.cols),.01);
  const clue=derive(state).clue;
  assert.equal(clue.kind,'salvage');
  assert.ok(state.field.cells[clue.row*state.field.cols+clue.col].loot);
  researchFixture(state,[UPGRADES.find(node=>node.id==='survey6')]);
  assert.ok(toolEfficiency(state,'magnet','static')>TOOLS.find(tool=>tool.id==='magnet').efficiencies.static);
  const oldTarget=derive(state).objectives.find(objective=>objective.id==='salvage').target;
  researchFixture(state,[UPGRADES.find(node=>node.id==='survey7')]);
  assert.ok(derive(state).objectives.find(objective=>objective.id==='salvage').target<=oldTarget);
});

test('a version-one six-field winner keeps progression and can start field seven',()=>{
  const legacy=createState(122);
  for(let stage=0;stage<5;stage++){legacy.field.needleFound=true;nextContract(legacy);}
  legacy.version=1;legacy.credits=1234;legacy.completed=6;legacy.stats.needles=6;
  legacy.field.needleFound=true;
  delete legacy.field.needleRecovered;delete legacy.field.salvage;delete legacy.field.objectiveMilestones;
  for(const cell of legacy.field.cells){cell.maxDepth=Math.min(cell.maxDepth,4.9);cell.depth=cell.maxDepth*.4;delete cell.material;}
  legacy.field.cells[legacy.field.needleCell].depth=0;legacy.field.cells[legacy.field.needleCell].collected=true;
  legacy.relics.foxbell=3;legacy.relics.suncrown=1;legacy.items.pulse=7;
  for(const node of UPGRADES.filter(node=>node.tier<=4))legacy.upgrades[node.id]=true;
  legacy.selectedTool='vacuum';legacy.settings.sound=true;
  const restored=restoreState(JSON.stringify(legacy));
  assert.equal(restored.completed,6);assert.equal(restored.contractIndex,5);
  assert.equal(restored.field.needleRecovered,true);assert.equal(restored.field.needleFound,true);
  assert.equal(restored.relics.foxbell,3);assert.equal(restored.relics.suncrown,1);assert.equal(restored.items.pulse,7);
  assert.equal(Object.keys(restored.upgrades).length,12);assert.equal(restored.settings.sound,true);
  assert.equal(derive(restored).objectives.every(objective=>objective.complete),true);
  assert.deepEqual(tick(restored,.25),[]);assert.equal(restored.credits,1234);
  assert.equal(nextContract(restored).length,1);
  assert.equal(restored.contractIndex,6);assert.equal(restored.completed,6);
  assert.equal(restored.field.needleRecovered,false);assert.equal(restored.field.needleFound,false);
  assert.equal(restored.relics.foxbell,3);assert.equal(restored.credits,1234);
  assertFinite(restored);assert.deepEqual(restoreState(serializeState(restored)),restored);
});

test('upgrade prerequisites, prices, tool locks, and repeated purchase protection work', () => {
  const state = createState(2);
  assert.equal(UPGRADES.length, 21);
  assert.equal(TOOLS.length, 4);
  assert.equal(RELICS.length, 7);
  assert.deepEqual(buyUpgrade(state, 'harvest1'), []);
  assert.deepEqual(selectTool(state, 'vacuum'), []);
  state.credits = 1000;
  assert.deepEqual(buyUpgrade(state, 'harvest2'), []);
  const before = derive(state);
  buyUpgrade(state, 'harvest1');
  assert.equal(state.credits, 955);
  assert.ok(derive(state).power > before.power);
  assert.deepEqual(buyUpgrade(state, 'harvest1'), []);
  assert.equal(state.credits, 955);
  state.completed=1;
  buyUpgrade(state, 'harvest2');
  assert.equal(selectTool(state, 'vacuum').length, 1);
  assert.ok(derive(state).radius > before.radius);
  assert.equal(upgradeCost(state, 'harvest4'), 650);
  assert.equal(upgradeCost(state, 'missing'), null);
  assert.deepEqual(buyUpgrade(state, 'missing'), []);
});

test('consumables are finite, cannot be wasted while active, and show reliable clues', () => {
  const state = createState(5);
  const normalPower = derive(state).power;
  useItem(state, 'pulse');
  const clue = derive(state).clue;
  const needleCol = state.field.needleCell % state.field.cols;
  const needleRow = Math.floor(state.field.needleCell / state.field.cols);
  assert.ok(Math.hypot(needleCol - clue.col, needleRow - clue.row) < clue.radius);
  assert.equal(state.items.pulse, 1);
  assert.deepEqual(useItem(state, 'pulse'), []);
  assert.equal(state.items.pulse, 1);
  useItem(state, 'overdrive');
  assert.ok(derive(state).power > normalPower);
  assert.deepEqual(useItem(state, 'overdrive'), []);
  for (let i = 0; i < 48; i += 1) tick(state, 0.25);
  assert.equal(state.active.overdrive, 0);
  assert.equal(state.active.pulse, 0);
  assert.equal(derive(state).power, normalPower);
});

test('automation clears fields but leaves the exposed needle for the player', () => {
  const state = createState(19);
  state.credits = 100000;
  researchFixture(state);
  assert.equal(derive(state).autoRate, 16);
  for (let i = 0; i < 4000 && derive(state).hayRemaining>0; i += 1) tick(state, 0.25);
  assert.equal(derive(state).hayRemaining, 0);
  assert.equal(derive(state).needleExposed, true);
  assert.equal(state.field.needleFound, false);
  assert.equal(state.completed, 0);
  const col = state.field.needleCell % state.field.cols;
  const row = Math.floor(state.field.needleCell / state.field.cols);
  sweep(state, col, row, 0.01);
  assert.equal(state.field.needleFound, true);
});

test('all twenty-four stages have achievable objectives, actual-credit progression, and bounded active clearing time', () => {
  const state = createState(7531);
  const collection = new Set();
  for (let stage = 0; stage < CONTRACTS.length; stage += 1) {
    assert.equal(state.contractIndex, stage);
    let elapsed = 0;
    // Upgrade with actual earned credits throughout a full raster search.
    for (let row = 0; row < state.field.rows && !state.field.needleFound; row += 1) {
      for (let col = 0; col < state.field.cols && !state.field.needleFound; col += 1) {
        for (let attempt = 0; attempt < 600 && !state.field.needleFound&&state.field.cells[row * state.field.cols + col].depth > 0; attempt += 1) {
          for (const node of UPGRADES) buyUpgrade(state, node.id);
          const material=state.field.cells[row*state.field.cols+col].material;
          const bestTool=TOOLS.filter(tool=>!tool.requires||state.upgrades[tool.requires]).sort((a,b)=>b.power*toolEfficiency(state,b.id,material)*b.radius**1.5-a.power*toolEfficiency(state,a.id,material)*a.radius**1.5)[0];
          selectTool(state,bestTool.id);
          // Efficient moving strokes spend at most 2.25 work seconds per real second.
          for (const event of sweep(state, col, row, 0.18)) if (event.relic) collection.add(event.relic);
          tick(state, 0.08);
          elapsed += 0.08;
        }
        // Automation can have exposed the needle before this tile's turn.
        sweep(state, col, row, 0.001);
      }
    }
    finishSurvey(state);
    // An early finish is intended, and the reliable clue lets us collect an exposed needle.
    if (!state.field.needleFound) {
      const col = state.field.needleCell % state.field.cols;
      const row = Math.floor(state.field.needleCell / state.field.cols);
      clearAt(state, col, row);
      sweep(state, col, row, 0.01);
    }
    assert.ok(state.field.needleFound, `Stage ${stage + 1} must be completable`);
    assert.ok(elapsed < 300, `Stage ${stage + 1} took ${elapsed} seconds`);
    assert.ok(derive(state).objectives.every(objective=>objective.complete));
    assert.equal(state.completed, stage + 1);
    assertFinite(state);
    if (stage < CONTRACTS.length - 1) assert.equal(nextContract(state).length, 1);
  }
  assert.equal(state.completed, CONTRACTS.length);
  assert.equal(state.stats.needles, CONTRACTS.length);
  assert.deepEqual(nextContract(state), []);
  assert.ok(state.upgrades.harvest2);
  assert.ok(collection.size > 0);
});

test('roundtrip preserves every real cell, needle location, upgrades, timers, and settings', () => {
  const state = createState('haywire');
  state.credits = 1000;
  researchFixture(state,UPGRADES.filter(node=>node.branch==='survey'&&node.tier<=2));
  selectTool(state, 'magnet');
  sweep(state, 3, 4, 0.12);
  tick(state, 0.1);
  useItem(state, 'overdrive');
  toggleSetting(state, 'sound');
  toggleSetting(state, 'reducedMotion');
  assert.deepEqual(restoreState(serializeState(state)), state);
});

test('corrupt and impossible saves recover to playable finite states', () => {
  const original = createState(1);
  const corrupt = {
    ...original,
    credits: Infinity,
    contractIndex: -900,
    upgrades: { harvest4: true, survey2: true, automation4: true },
    selectedTool: 'magnet',
    items: { pulse: -300, overdrive: 'infinite' },
    stats: { hay: NaN, earned: Infinity, needles: -200 },
    field: { ...original.field, needleCell: Infinity, elapsed: NaN, cells: original.field.cells.map(() => ({ depth: NaN, maxDepth: -999, loot: '__proto__', collected: false })) },
  };
  const recovered = restoreState(corrupt);
  assert.equal(recovered.credits, 35);
  assert.equal(recovered.contractIndex, 0);
  assert.equal(recovered.selectedTool, 'rake');
  assert.deepEqual(recovered.upgrades, {});
  assertFinite(recovered);
  assertFinite(derive(recovered));
  assert.ok(recovered.field.needleCell >= 0 && recovered.field.needleCell < 120);
  sweep(recovered, recovered.field.needleCell % 12, Math.floor(recovered.field.needleCell / 12), 0.1);
  assert.equal(recovered.field.needleFound, true);
  for (const raw of [null, undefined, 'bad json', [], 0, true, { field: { cells: [] } }]) {
    const state = restoreState(raw);
    assertFinite(state);
    assert.ok(state.field.cells.length === 120);
  }
  const sparse = createState(33);
  sparse.field.cells = Array(120);
  const filled = restoreState(sparse);
  assert.equal(filled.field.cells.filter(Boolean).length, 120);
  assert.ok(filled.field.cells[filled.field.needleCell].depth > 0);
});

test('invalid action inputs are safe and frozen tabs cannot leap forward', () => {
  const state = createState(71);
  const before = serializeState(state);
  for (const coordinates of [[NaN, 0], [Infinity, 2], [-1, 0], [120, 0], [1, '2'], [0, -0.1]]) assert.deepEqual(sweep(state, ...coordinates), []);
  assert.equal(serializeState(state), before);
  assert.deepEqual(tick(state, NaN), []);
  assert.deepEqual(tick(state, -1), []);
  tick(state, 3600);
  assert.equal(state.field.elapsed, 0.25);
  const expected = createState(71);
  sweep(expected, 0, 0, 0.2);
  const actual = createState(71);
  sweep(actual, 0, 0, 3600);
  assert.deepEqual(actual.field, expected.field);
  for (const action of [() => sweep(null, 0, 0), () => tick(null, 1), () => buyUpgrade(null, 'harvest1'), () => selectTool(null, 'rake'), () => useItem(null, 'pulse'), () => nextContract(null), () => toggleSetting(null, 'sound')]) assert.deepEqual(action(), []);
  assertFinite(state);
});

test('farm scenery grants real deterministic supplies and credits only once per field', () => {
  const state = createState(918);
  const identical = createState(918);
  assert.deepEqual(SCENERY.map(location=>location.id),['barn','windmill','crates','conveyor','drone']);
  const activeBefore = { ...state.active };
  const barn = inspectScenery(state,'barn')[0];
  assert.equal(barn.type,'scenery');
  assert.equal(barn.claimed,true);
  assert.deepEqual(barn.items,{pulse:1});
  assert.equal(state.items.pulse,3);
  const windmill = inspectScenery(state,'windmill')[0];
  assert.deepEqual(windmill.items,{overdrive:1});
  assert.equal(state.items.overdrive,2);
  assert.deepEqual(state.active,activeBefore,'Supply rewards do not silently activate consumables');
  const beforeCredits = state.credits;
  const crates = inspectScenery(state,'crates')[0];
  assert.deepEqual(crates,inspectScenery(identical,'crates')[0]);
  assert.ok(crates.credits>=18&&crates.credits<=27);
  assert.equal(state.credits-beforeCredits,crates.credits);
  assert.equal(state.stats.earned,crates.credits);
  for(const id of ['barn','windmill','crates']) {
    const before=serializeState(state);
    const repeated=inspectScenery(state,id)[0];
    assert.equal(repeated.repeated,true);
    assert.equal(repeated.claimed,false);
    assert.equal(repeated.credits,0);
    assert.deepEqual(repeated.items,{});
    assert.ok(repeated.message.length>10);
    assert.equal(serializeState(state),before);
  }
  assertFinite(state);
});

test('machinery rewards require research and low supplies, without consuming unavailable claims', () => {
  const state=createState(721);
  for(const id of ['conveyor','drone']) {
    const locked=inspectScenery(state,id)[0];
    assert.equal(locked.claimed,false);
    assert.equal(locked.available,false);
    assert.ok(locked.message.startsWith('Research'));
    assert.equal(state.field.inspectedScenery[id],undefined);
  }
  state.credits=1000;
  researchFixture(state,[UPGRADES.find(node=>node.id==='automation1')]);
  const stocked=inspectScenery(state,'drone')[0];
  assert.equal(stocked.claimed,false);
  assert.equal(state.field.inspectedScenery.drone,undefined);
  state.items.pulse=0;
  state.items.overdrive=0;
  const drone=inspectScenery(state,'drone')[0];
  assert.deepEqual(drone.items,{pulse:2,overdrive:1});
  assert.deepEqual(state.items,{pulse:2,overdrive:1});
  state.items.pulse=0;
  assert.equal(inspectScenery(state,'drone')[0].repeated,true);
  assert.equal(state.items.pulse,0);
  researchFixture(state,UPGRADES.filter(node=>node.branch==='automation'&&node.tier>=2&&node.tier<=3));
  const before=state.credits;
  const conveyor=inspectScenery(state,'conveyor')[0];
  assert.equal(conveyor.claimed,true);
  assert.equal(state.credits-before,12);
  assert.equal(inspectScenery(state,'conveyor')[0].repeated,true);
  state.items.pulse=99;
  assert.equal(inspectScenery(state,'barn')[0].claimed,false);
  assert.equal(state.field.inspectedScenery.barn,undefined);
  state.items.pulse=98;
  assert.equal(inspectScenery(state,'barn')[0].claimed,true);
  assert.equal(state.items.pulse,99);
});

test('scenery claims survive save reload, migrate old saves safely, and reset on a new field', () => {
  const state=createState(115);
  inspectScenery(state,'barn');
  inspectScenery(state,'crates');
  const restored=restoreState(serializeState(state));
  assert.deepEqual(restored,state);
  assert.equal(inspectScenery(restored,'barn')[0].repeated,true);
  const legacy=JSON.parse(serializeState(state));
  delete legacy.field.inspectedScenery;
  assert.deepEqual(restoreState(legacy).field.inspectedScenery,{});
  legacy.field.inspectedScenery={barn:true,windmill:'true',crates:1,unknown:true};
  assert.deepEqual(restoreState(legacy).field.inspectedScenery,{barn:true});
  state.field.needleFound=true;
  const closed=inspectScenery(state,'windmill')[0];
  assert.equal(closed.claimed,false);
  assert.match(closed.message,/complete/);
  nextContract(state);
  assert.deepEqual(state.field.inspectedScenery,{});
  const itemCount=state.items.pulse;
  assert.equal(inspectScenery(state,'barn')[0].claimed,true);
  assert.equal(state.items.pulse,itemCount+1);
  assert.deepEqual(inspectScenery(null,'barn'),[]);
  assert.deepEqual(inspectScenery(state,'unknown'),[]);
  assert.deepEqual(inspectScenery(state,'__proto__'),[]);
  assertFinite(state);
});

test('twenty-four contracts retain legacy IDs, have three chapters, and unlock required survey tools in time',()=>{
  assert.equal(CONTRACTS.length,24);
  assert.equal(CHAPTERS.length,3);
  assert.deepEqual(CONTRACTS.slice(0,12).map(contract=>contract.id),['sunlit','orchard','granary','festival','moonrise','legend','bramble','ironwood','terraces','storm','vault','aurora']);
  for(let chapter=1;chapter<=3;chapter++)assert.equal(CONTRACTS.filter(contract=>contract.chapter===chapter).length,8);
  assert.equal(new Set(CONTRACTS.map(contract=>contract.id)).size,24);
  CONTRACTS.forEach((contract,index)=>{
    if(contract.mastery){const tool=TOOLS.find(tool=>tool.id===contract.mastery.tool);if(tool.requires)assert.ok(UPGRADES.find(node=>node.id===tool.requires).requiredContracts<=index);}
    assert.ok(contract.cols<=22&&contract.rows<=20);
  });
  assert.ok(CONTRACTS.slice(12).every(contract=>contract.zoneTargets.length>0));
});

test('research needs actual contract milestones while owned legacy ideas remain usable',()=>{
  const state=createState(883);state.credits=10000;
  buyUpgrade(state,'harvest1');
  assert.match(getResearchLock(state,'harvest2'),/Complete 1 field/);
  assert.deepEqual(buyUpgrade(state,'harvest2'),[]);
  state.completed=1;
  assert.equal(getResearchLock(state,'harvest2'),null);
  assert.equal(buyUpgrade(state,'harvest2').length,1);
  state.completed=0;
  assert.equal(getResearchLock(state,'harvest2'),null);
  assert.equal(selectTool(state,'vacuum').length,1);
  const saved=restoreState(serializeState(state));
  assert.equal(saved.upgrades.harvest2,true);
  assert.equal(saved.selectedTool,'vacuum');
  assert.match(getResearchLock(saved,'harvest7'),/Complete 18 fields/);
});

test('a completed version-two twelve-field expedition continues at field thirteen with every purchase',()=>{
  const legacy=createState(41);legacy.credits=100000;researchFixture(legacy);
  while(legacy.contractIndex<11){legacy.field.needleFound=true;nextContract(legacy);}
  legacy.version=2;legacy.field.needleFound=true;legacy.completed=12;legacy.stats.needles=12;
  legacy.credits=1234;legacy.items={pulse:7,overdrive:4};legacy.relics.foxbell=2;
  delete legacy.field.masteryCells;delete legacy.field.generationSeed;
  const saved=restoreState(JSON.stringify(legacy));
  assert.equal(saved.completed,12);
  assert.equal(Object.keys(saved.upgrades).length,21);
  assert.equal(saved.credits,1234);
  assert.equal(nextContract(saved).length,1);
  assert.equal(saved.contractIndex,12);
  assert.equal(saved.completed,12);
  assert.deepEqual(saved.items,{pulse:7,overdrive:4});
  assert.equal(saved.relics.foxbell,2);
  assert.equal(saved.selectedTool,legacy.selectedTool);
  assert.equal(derive(saved).objectives.some(objective=>objective.id.startsWith('zone:')),true);
  assert.deepEqual(restoreState(serializeState(saved)),saved);
});

test('material and zone objectives use real field cells, and appropriate surveys remain possible on cleared ground',()=>{
  const state=createState(300);state.credits=100000;researchFixture(state);
  while(state.contractIndex<13){state.field.needleFound=true;nextContract(state);}
  const contract=derive(state).contract;
  assert.equal(contract.mastery.tool,'magnet');
  let view=derive(state);
  assert.ok(view.objectives.find(objective=>objective.id==='zone:east').current<100);
  for(const cell of state.field.cells){cell.depth=0;cell.collected=true;}
  state.field.needleRecovered=true;state.field.salvage=contract.salvageTarget;
  selectTool(state,'rake');
  sweep(state,0,0,.01);
  assert.equal(state.field.needleFound,false,'Wrong-tool clearing cannot satisfy the specialist survey');
  const clue=derive(state).clue;
  assert.equal(clue.kind,'mastery');assert.equal(clue.tool,'magnet');
  assert.equal(state.field.cells[clue.row*state.field.cols+clue.col].depth,0);
  assert.equal(state.field.cells[clue.row*state.field.cols+clue.col].material,contract.mastery.material);
  finishSurvey(state);
  assert.equal(state.field.needleFound,true,'A survey remains reachable after other tools or automation clear every cell');
  view=derive(state);
  assert.ok(view.objectives.every(objective=>objective.complete));
  assert.ok(view.objectives.every(objective=>['percent','count'].includes(objective.format)));
  assert.deepEqual(restoreState(serializeState(state)).field.masteryCells,state.field.masteryCells);
});

test('repeatable seeded challenges preserve campaign completion, kit, saves, and single completion rewards',()=>{
  const state=createState(76);state.credits=100000;researchFixture(state);
  while(state.contractIndex<CONTRACTS.length-1){state.field.needleFound=true;nextContract(state);}
  state.field.needleFound=true;state.completed=CONTRACTS.length;state.stats.needles=CONTRACTS.length;
  const kit={upgrades:{...state.upgrades},items:{...state.items},relics:{...state.relics},credits:state.credits};
  const start=startChallenge(state,'challenge-fixture');
  assert.equal(start[0].id,'challenge');assert.equal(state.completed,24);assert.equal(state.challenge.round,1);
  assert.deepEqual(state.upgrades,kit.upgrades);assert.deepEqual(state.items,kit.items);assert.deepEqual(state.relics,kit.relics);assert.equal(state.credits,kit.credits);
  assert.deepEqual(startChallenge(state),[],'An unfinished challenge cannot be replaced');
  const twin=restoreState(serializeState(state));assert.deepEqual(twin,state);
  for(const cell of state.field.cells){cell.depth=0;cell.collected=true;}
  state.field.needleRecovered=true;state.field.salvage=derive(state).contract.salvageTarget;
  finishSurvey(state);
  assert.equal(state.field.needleFound,true);assert.equal(state.stats.challenges,1);assert.equal(state.completed,24);
  assert.deepEqual(tick(state,.25),[]);assert.equal(state.stats.challenges,1);
  const oldSeed=state.field.generationSeed;
  assert.equal(startChallenge(state)[0].round,2);assert.notEqual(state.field.generationSeed,oldSeed);
  assert.equal(state.completed,24);assert.equal(derive(state).contract.mastery.material,'packed');
  assert.deepEqual(restoreState(serializeState(state)),state);
  assert.deepEqual(startChallenge(createState(99)),[]);
});
