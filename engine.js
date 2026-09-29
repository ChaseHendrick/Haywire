/** Haywire's deterministic simulation. No browser APIs or external dependencies. */
export const VERSION = 3;
const EPSILON = 0.000001;
const MAX_CREDITS = 1_000_000_000;
const DEFAULT_SEED = 0x48415957;
const MAX_DEPTH = 64;

export const MATERIALS = Object.freeze([
  {id:'loose',name:'Loose hay',description:'Light, airy hay. Rakes and vacuums make quick work of it.',color:'#e9c86b'},
  {id:'packed',name:'Packed bales',description:'Compressed hay. A vacuum or cutter breaks it apart.',color:'#c49b58'},
  {id:'tangled',name:'Tangled fibers',description:'Knotted fibers resist suction. Bring a cutter.',color:'#adad72'},
  {id:'static',name:'Static straw',description:'Metal-flecked straw. A magnet makes it fly.',color:'#97acb0'},
].map(Object.freeze));

export const CHAPTERS = Object.freeze([
  {id:'homestead',name:'The homestead',description:'Learn the tools and build your first search crew.'},
  {id:'wild',name:'The wild fields',description:'Specialist materials and focused surveys reward a versatile kit.'},
  {id:'frontier',name:'The harvest frontier',description:'Work distinct zones, follow material signals, and finish your expedition.'},
].map(Object.freeze));

const researchGates = Object.freeze({harvest1:0,harvest2:1,harvest3:3,harvest4:4,harvest5:6,harvest6:12,harvest7:18,
  survey1:0,survey2:2,survey3:4,survey4:8,survey5:11,survey6:15,survey7:20,
  automation1:1,automation2:4,automation3:6,automation4:9,automation5:13,automation6:17,automation7:21});
const researchCosts = Object.freeze({harvest4:650,harvest6:2400,harvest7:4400,survey4:900,survey5:1700,survey6:2800,survey7:4400,
  automation4:1050,automation5:1900,automation6:3200,automation7:5200});

export const CONTRACTS = Object.freeze([
  { id: 'sunlit', name: 'Sunlit meadow', description: 'Recover the needle, process the field, and uncover three keepsakes.', cols: 12, rows: 10, depth: 8, density: 0.84, bonus: 120, color: '#e9c86b', region:'The homestead', processingTarget:72, salvageTarget:3, materialMix:[.85,.10,.02,.03], estimatedMinutes:1.5 },
  { id: 'orchard', name: 'Orchard windfall', description: 'Compressed orchard bales reward a wider sweep.', cols: 14, rows: 12, depth: 10, density: 0.87, bonus: 190, color: '#e7b85f', region:'The homestead', processingTarget:75, salvageTarget:4, materialMix:[.60,.30,.04,.06], estimatedMinutes:1.5 },
  { id: 'granary', name: 'The old granary', description: 'Packed bales and metal flecks call for two different tools.', cols: 16, rows: 14, depth: 12, density: 0.89, bonus: 270, color: '#d9a451', region:'The homestead', processingTarget:78, salvageTarget:5, materialMix:[.35,.40,.05,.20], estimatedMinutes:1.5 },
  { id: 'festival', name: 'After the festival', description: 'A busy field with twisted fibers and festival treasures.', cols: 18, rows: 16, depth: 14, density: 0.91, bonus: 360, color: '#ddb76a', region:'The homestead', processingTarget:80, salvageTarget:6, materialMix:[.40,.25,.12,.23], estimatedMinutes:2 },
  { id: 'moonrise', name: 'Moonrise farm', description: 'Follow conductive strands through a quiet, tangled field.', cols: 20, rows: 18, depth: 16, density: 0.93, bonus: 460, color: '#b7aa78', region:'The homestead', processingTarget:82, salvageTarget:7, materialMix:[.25,.20,.20,.35], estimatedMinutes:2 },
  { id: 'legend', name: 'The legendary haystack', description: 'The giant central stack tests the kit you have built.', cols: 22, rows: 20, depth: 18, density: 0.95, bonus: 650, color: '#d6b657', region:'The homestead', processingTarget:84, salvageTarget:8, materialMix:[.25,.25,.25,.25], estimatedMinutes:2 },
  { id: 'bramble', name: 'Bramble hollow', description: 'Vine-wrapped fibers are a job for a rotary cutter.', cols: 22, rows: 20, depth: 20, density:.95, bonus:850, color:'#b0b177', region:'The wild fields', processingTarget:86, salvageTarget:10, materialMix:[.15,.15,.55,.15], estimatedMinutes:2.5 },
  { id: 'ironwood', name: 'Ironwood salvage', description: 'Old metal shavings turn the magnet into your best friend.', cols:22, rows:20, depth:22, density:.95, bonus:1000, color:'#a8b7ac', region:'The wild fields', processingTarget:88, salvageTarget:12, materialMix:[.10,.20,.15,.55], estimatedMinutes:2.5 },
  { id: 'terraces', name: 'Amber terraces', description: 'Packed harvests hold a wealth of buried finds.', cols:22, rows:20, depth:24, density:.96, bonus:1200, color:'#d7a774', region:'The wild fields', processingTarget:90, salvageTarget:14, materialMix:[.15,.55,.20,.10], estimatedMinutes:2.5 },
  { id: 'storm', name: 'Stormglass farm', description: 'Tangles and charged straw reward quick tool changes.', cols:22, rows:20, depth:26, density:.96, bonus:1400, color:'#b6a8b8', region:'The wild fields', processingTarget:91, salvageTarget:16, materialMix:[.10,.15,.40,.35], estimatedMinutes:2.5 },
  { id: 'vault', name: 'The harvest vault', description: 'A dense salvage contract for a properly equipped operation.', cols:22, rows:20, depth:28, density:.97, bonus:1650, color:'#d0b785', region:'The wild fields', processingTarget:92, salvageTarget:18, materialMix:[.20,.30,.30,.20], estimatedMinutes:2.5 },
  { id: 'aurora', name: 'Aurora haylands', description: 'The wild fields open into a larger expedition. Every tool has its moment.', cols:22, rows:20, depth:30, density:.98, bonus:2000, color:'#c6caa0', region:'The wild fields', processingTarget:94, salvageTarget:20, materialMix:[.25,.25,.25,.25], estimatedMinutes:3 },
  {id:'reedbank',name:'Reedbank crossings',description:'Loose riverside rows surround a stubborn northern strip.',cols:22,rows:18,depth:20,density:.94,bonus:900,color:'#cfbc79',processingTarget:80,salvageTarget:12,materialMix:[.50,.25,.15,.10]},
  {id:'brassmarket',name:'Brass market sweep',description:'Use the magnet to survey conductive patches in the eastern rows.',cols:20,rows:20,depth:23,density:.95,bonus:1050,color:'#c1ae70',processingTarget:82,salvageTarget:13,materialMix:[.15,.15,.15,.55]},
  {id:'thistledown',name:'Thistledown grove',description:'Cutter surveys open tangled paths through the southern beds.',cols:22,rows:20,depth:24,density:.95,bonus:1150,color:'#acb17d',processingTarget:84,salvageTarget:14,materialMix:[.15,.15,.55,.15]},
  {id:'hayloft',name:'The high hayloft',description:'Vacuum compressed loft bales and finish the western delivery rows.',cols:20,rows:18,depth:27,density:.96,bonus:1300,color:'#d2b17a',processingTarget:86,salvageTarget:15,materialMix:[.15,.55,.15,.15]},
  {id:'coppercreek',name:'Copper creek',description:'Static straw collects along the northern creek bank.',cols:22,rows:20,depth:26,density:.96,bonus:1450,color:'#a8b7a7',processingTarget:86,salvageTarget:16,materialMix:[.15,.20,.15,.50]},
  {id:'fernfold',name:'Fernfold orchard',description:'Tangled southern beds and loose lanes need different heads.',cols:20,rows:20,depth:25,density:.96,bonus:1550,color:'#adb97c',processingTarget:87,salvageTarget:17,materialMix:[.30,.15,.45,.10]},
  {id:'silos',name:'The twin silos',description:'Break packed eastern rows while scouting the remaining valuables.',cols:22,rows:18,depth:29,density:.97,bonus:1700,color:'#c9a56c',processingTarget:88,salvageTarget:18,materialMix:[.15,.50,.20,.15]},
  {id:'firefly',name:'Firefly clearing',description:'Loose western hay surrounds small conductive islands.',cols:22,rows:20,depth:27,density:.95,bonus:1800,color:'#c9bd7d',processingTarget:88,salvageTarget:19,materialMix:[.45,.15,.15,.25]},
  {id:'hedgerow',name:'The old hedgerow',description:'Complete a cutter survey and restore the northern hedgerow.',cols:20,rows:20,depth:30,density:.97,bonus:1950,color:'#a7ac70',processingTarget:89,salvageTarget:20,materialMix:[.15,.20,.50,.15]},
  {id:'railside',name:'Railside salvage',description:'Metal flecks crowd the eastern loading rows.',cols:22,rows:20,depth:31,density:.97,bonus:2100,color:'#adb5ad',processingTarget:90,salvageTarget:21,materialMix:[.15,.15,.15,.55]},
  {id:'goldenacre',name:'Golden acre',description:'A packed southern harvest rewards careful vacuum passes.',cols:22,rows:20,depth:32,density:.97,bonus:2250,color:'#d2b271',processingTarget:91,salvageTarget:22,materialMix:[.15,.50,.20,.15]},
  {id:'homecoming',name:'Harvest homecoming',description:'Complete the final western survey with every lesson you have learned.',cols:22,rows:20,depth:30,density:.98,bonus:2600,color:'#d6bd7f',processingTarget:92,salvageTarget:23,materialMix:[.25,.25,.25,.25]},
].map((contract,index)=>{
  const chapter=CHAPTERS[Math.floor(index/8)];
  const focus=index>=3?['packed','static','loose','tangled','static','packed','tangled','packed','loose','loose','static','tangled','packed','static','tangled','packed','loose','tangled','static','packed','loose'][(index-3)%21]:null;
  const tools={loose:'rake',packed:'vacuum',tangled:'cutter',static:'magnet'};
  const mastery=focus?{tool:tools[focus],material:focus,cells:Math.min(18,6+Math.floor(index*.6))}:null;
  // The cutter becomes researchable after six contracts, before its first survey.
  if(index===5&&mastery?.tool==='cutter')mastery.tool='rake';
  const materialTargets=focus?[{material:focus,target:Math.min(96,78+Math.floor(index*.7))}]:[];
  const zone=index>=12?['north','east','south','west'][(index-12)%4]:null;
  return Object.freeze({...contract,chapter:Math.floor(index/8)+1,region:chapter.name,chapterDescription:chapter.description,
    materialTargets:Object.freeze(materialTargets.map(Object.freeze)),mastery:mastery?Object.freeze(mastery):null,
    zoneTargets:Object.freeze(zone?[Object.freeze({zone,target:90})]:[])});
}));

export const UPGRADES = Object.freeze([
  { id: 'harvest1', name: 'Tempered teeth', description: 'Clear hay 30% faster with every tool.', branch: 'harvest', tier: 1, cost: 45, prerequisites: [] },
  { id: 'harvest2', name: 'Field vacuum', description: 'Unlock the vacuum, a wide sweep for big satisfying clearings.', branch: 'harvest', tier: 2, cost: 110, prerequisites: ['harvest1'] },
  { id: 'harvest3', name: 'Wide intake', description: 'Every tool reaches an extra 0.35 tiles.', branch: 'harvest', tier: 3, cost: 210, prerequisites: ['harvest2'] },
  { id: 'harvest4', name: 'Turbine core', description: 'Add 40% clearing power to every tool.', branch: 'harvest', tier: 4, cost: 390, prerequisites: ['harvest3'] },
  { id: 'survey1', name: 'Echo lens', description: 'Get a needle clue at 32% cleared. Pulses last 12 seconds.', branch: 'survey', tier: 1, cost: 55, prerequisites: [] },
  { id: 'survey2', name: 'Salvage magnet', description: 'Unlock the magnet. It clears twice as fast around metal and relics.', branch: 'survey', tier: 2, cost: 140, prerequisites: ['survey1'] },
  { id: 'survey3', name: 'Triangulation', description: 'A precise needle clue appears at just 12% cleared.', branch: 'survey', tier: 3, cost: 240, prerequisites: ['survey2'] },
  { id: 'survey4', name: 'Resonant scanner', description: 'Always locate the needle. Magnets gain 25% power and 0.20 reach.', branch: 'survey', tier: 4, cost: 450, prerequisites: ['survey3'] },
  { id: 'automation1', name: 'Clockwork helper', description: 'A little helper clears 0.7 hay per second while you search.', branch: 'automation', tier: 1, cost: 85, prerequisites: [] },
  { id: 'automation2', name: 'Picker crew', description: 'Helpers clear 2 hay per second in total.', branch: 'automation', tier: 2, cost: 180, prerequisites: ['automation1'] },
  { id: 'automation3', name: 'Sorting belt', description: 'Clear 4 hay per second and earn 30% more from hay and caches.', branch: 'automation', tier: 3, cost: 310, prerequisites: ['automation2'] },
  { id: 'automation4', name: 'Autonomous combine', description: 'Clear 7 hay per second. An exposed needle waits for your touch.', branch: 'automation', tier: 4, cost: 520, prerequisites: ['automation3', 'harvest2'] },
  { id: 'harvest5', name:'Rotary cutter', description:'Unlock a cutter that shreds tangled fibers and compressed bales.', branch:'harvest', tier:5, cost:850, prerequisites:['harvest4'] },
  { id: 'harvest6', name:'Adaptive heads', description:'Add 20% base power. Every tool gains at least 0.6 efficiency on difficult materials.', branch:'harvest', tier:6, cost:1500, prerequisites:['harvest5'] },
  { id: 'harvest7', name:'Cascade drives', description:'Add 0.20 reach. Rapid clearing combos build up to 18% extra power.', branch:'harvest', tier:7, cost:2400, prerequisites:['harvest6'] },
  { id: 'survey5', name:'Salvage atlas', description:'After needle recovery, your scanner continually locates the remaining salvage.', branch:'survey', tier:5, cost:750, prerequisites:['survey4'] },
  { id: 'survey6', name:'Conductive field', description:'Magnets gain 20% more power on static straw and 25% near buried finds.', branch:'survey', tier:6, cost:1400, prerequisites:['survey5'] },
  { id: 'survey7', name:"Prospector's license", description:'Require 20% fewer salvage finds. Relics earn 30% more coins.', branch:'survey', tier:7, cost:2300, prerequisites:['survey6'] },
  { id: 'automation5', name:'Smart dispatch', description:'Helpers prioritize buried salvage and clear 9 hay per second.', branch:'automation', tier:5, cost:900, prerequisites:['automation4','survey2'] },
  { id: 'automation6', name:'Material sorter', description:'Clear 12 hay per second. Helpers work packed and tangled hay 50% faster.', branch:'automation', tier:6, cost:1600, prerequisites:['automation5'] },
  { id: 'automation7', name:'Survey convoy', description:'Clear 16 hay per second. Helper salvage finds count twice toward the contract.', branch:'automation', tier:7, cost:2500, prerequisites:['automation6'] },
].map((node) => Object.freeze({ ...node, cost:researchCosts[node.id]??node.cost, requiredContracts:researchGates[node.id]??0,
  prerequisites: Object.freeze(node.prerequisites) })));

export const TOOLS = Object.freeze([
  { id: 'rake', name: 'Rake', description: 'Best for loose hay. A precise, reliable sweep.', power: 4.2, radius: 1.15, requires: null, efficiencies:{loose:1.35,packed:.6,tangled:.45,static:.7} },
  { id: 'vacuum', name: 'Vacuum', description: 'Best for loose hay and packed bales. Tangles resist suction.', power: 3.6, radius: 2.0, requires: 'harvest2', efficiencies:{loose:1.6,packed:1,tangled:.3,static:.35} },
  { id: 'magnet', name: 'Magnet', description: 'Best for static straw and metal. Use it around buried finds.', power: 4.0, radius: 1.75, requires: 'survey2', efficiencies:{loose:.65,packed:.5,tangled:.45,static:2.6} },
  { id: 'cutter', name: 'Cutter', description: 'Best for tangled fibers and packed bales. Metal resists the blades.', power: 5.2, radius: 1.4, requires:'harvest5', efficiencies:{loose:.8,packed:1.4,tangled:2.8,static:.4} },
].map(Object.freeze));

export const RELICS = Object.freeze([
  { id: 'foxbell', name: 'Fox bell', description: 'A tiny brass bell with a very big story.', rarity: 'uncommon', value: 28, color: '#f5b26a' },
  { id: 'mooncoin', name: 'Moon coin', description: 'A silver coin that seems to hold a little moonlight.', rarity: 'uncommon', value: 32, color: '#b9d6ef' },
  { id: 'ceramicbird', name: 'Ceramic bird', description: 'A blue bird, perfectly intact beneath the hay.', rarity: 'uncommon', value: 35, color: '#83d5e6' },
  { id: 'amberkey', name: 'Amber key', description: 'Warm to the touch. Nobody remembers the lock.', rarity: 'rare', value: 45, color: '#ffc970' },
  { id: 'starcompass', name: 'Star compass', description: 'It points towards adventure, which is not very practical.', rarity: 'rare', value: 52, color: '#b4b1ff' },
  { id: 'glassacorn', name: 'Glass acorn', description: 'A little impossible forest, captured in green glass.', rarity: 'rare', value: 58, color: '#a1e0a3' },
  { id: 'suncrown', name: 'Sun crown', description: 'A miniature golden crown for the champion of this field.', rarity: 'legendary', value: 75, color: '#ffe389' },
].map(Object.freeze));

export const SCENERY = Object.freeze([
  { id: 'barn', name: 'Barn', title: 'Barn delivery', description: 'Collect one scanner charge for this field.', requires: null,
    repeatMessage: 'This field\'s barn delivery is already collected.' },
  { id: 'windmill', name: 'Windmill', title: 'Windmill workshop', description: 'Collect one freshly mixed turbo flask for this field.', requires: null,
    repeatMessage: 'The windmill has supplied this field\'s turbo flask.' },
  { id: 'crates', name: 'Supply crates', title: 'Forgotten coin pouch', description: 'Search the crates for a small coin cache once per field.', requires: null,
    repeatMessage: 'These crates are searched. A fresh field brings a new delivery.' },
  { id: 'conveyor', name: 'Conveyor', title: 'Sorting delivery', description: 'Collect a small sorting payment once per field after researching the sorting belt.', requires: 'automation3',
    repeatMessage: 'This field\'s sorting delivery has already been paid.' },
  { id: 'drone', name: 'Helper drone', title: 'Drone supply run', description: 'Refill low supplies to two scanner charges and one turbo flask once per field.', requires: 'automation1',
    repeatMessage: 'The drone has made this field\'s supply run.' },
].map(Object.freeze));

const upgradeById = new Map(UPGRADES.map((node) => [node.id, node]));
const toolById = new Map(TOOLS.map((tool) => [tool.id, tool]));
const relicById = new Map(RELICS.map((relic) => [relic.id, relic]));
const sceneryById = new Map(SCENERY.map((location) => [location.id, location]));
const validLoot = new Set(['scrap', 'cache', 'pulse', 'overdrive', ...RELICS.map((relic) => `relic:${relic.id}`)]);
const materialIds = new Set(MATERIALS.map(material => material.id));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const numeric = (value, fallback = 0, low = 0, high = MAX_CREDITS) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, low, high) : fallback;
const integer = (value, fallback = 0, low = 0, high = MAX_CREDITS) => Math.floor(numeric(value, fallback, low, high));
const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
const owned = (state, id) => own(state?.upgrades, id) && state.upgrades[id] === true;

function seedNumber(value) {
  if (typeof value === 'string') {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return hash >>> 0;
  }
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) >>> 0 : DEFAULT_SEED;
}

function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let n = value;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function challengeContract(round) {
  const material=MATERIALS[(round-1)%MATERIALS.length].id;
  const tools={loose:'rake',packed:'vacuum',tangled:'cutter',static:'magnet'};
  return {...CONTRACTS[CONTRACTS.length-1],id:`challenge-${round}`,name:`${MATERIALS[(round-1)%4].name} challenge ${round}`,
    description:'A fresh seeded survey. Keep your workshop and put a specialist tool to work.',region:'Open field challenges',chapter:4,
    depth:24+(round%3)*3,density:.96,bonus:800+(round%5)*100,processingTarget:84,salvageTarget:18+(round%4)*2,
    materialMix:MATERIALS.map(candidate=>candidate.id===material?.55:.15),
    materialTargets:[{material,target:92}],mastery:{tool:tools[material],material,cells:14},zoneTargets:[{zone:['north','east','south','west'][(round-1)%4],target:90}]};
}

function contractFor(state) {
  return state.challenge?challengeContract(state.challenge.round):CONTRACTS[state.contractIndex];
}

function objectiveIds(contract) {
  return ['processing','salvage','needle',...(contract.materialTargets??[]).map(goal=>`material:${goal.material}`),
    ...(contract.zoneTargets??[]).map(goal=>`zone:${goal.zone}`),...(contract.mastery?['mastery']:[])];
}

function generateField(seed, contractIndex, customContract = null) {
  const contract = customContract || CONTRACTS[contractIndex];
  const rng = randomFrom((seed ^ Math.imul(contractIndex + 1, 0x9e3779b9)) >>> 0);
  const count = contract.cols * contract.rows;
  const needleCell = Math.floor(rng() * count);
  const materialRng = randomFrom((seed ^ Math.imul(contractIndex + 1, 0x72cf81a3)) >>> 0);
  const cells = Array.from({ length: count }, (_, index) => {
    const maxDepth = index === needleCell || rng() < contract.density
      ? Math.round(contract.depth * (0.72 + rng() * 0.4) * 100) / 100 : 0;
    let roll=materialRng(),material='static';
    for(let m=0;m<MATERIALS.length;m+=1){roll-=contract.materialMix[m];if(roll<0){material=MATERIALS[m].id;break;}}
    return { depth: maxDepth, maxDepth, loot: null, collected: maxDepth === 0, material };
  });
  const candidates = cells.map((cell, index) => index).filter((index) => index !== needleCell && cells[index].depth > 0);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const guaranteed = ['pulse', 'overdrive', 'cache', `relic:${RELICS[contractIndex % RELICS.length].id}`, `relic:${RELICS[(contractIndex + 2) % RELICS.length].id}`];
  const lootCount = Math.max(guaranteed.length, contract.salvageTarget + 8, Math.ceil(count * 0.12));
  for (let i = 0; i < Math.min(lootCount, candidates.length); i += 1) {
    cells[candidates[i]].loot = guaranteed[i] || (rng() < 0.65 ? 'scrap' : 'cache');
  }
  if ((contractIndex === 5 || contractIndex === CONTRACTS.length - 1) && candidates.length > 5) cells[candidates[5]].loot = 'relic:suncrown';
  return { cols: contract.cols, rows: contract.rows, cells, generationSeed:seedNumber(seed), needleCell, needleFound: false, needleRecovered:false, salvage:0, objectiveMilestones:{}, inspectedScenery:{}, masteryCells:{}, elapsed: 0, combo: 0, comboTimer: 0, autoCursor: 0 };
}

export function createState(seed = Date.now()) {
  const safeSeed = seedNumber(seed);
  return {
    version: VERSION,
    seed: safeSeed,
    credits: 35,
    contractIndex: 0,
    completed: 0,
    challenge: null,
    selectedTool: 'rake',
    upgrades: {},
    items: { pulse: 2, overdrive: 1 },
    relics: Object.fromEntries(RELICS.map((relic) => [relic.id, 0])),
    stats: { hay: 0, needles: 0, earned: 0, challenges:0 },
    settings: { sound: false, reducedMotion: false },
    active: { overdrive: 0, pulse: 0 },
    field: generateField(safeSeed, 0),
  };
}

/** Recover old or corrupted data without importing arbitrary properties. */
export function restoreState(raw) {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return createState(DEFAULT_SEED); }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createState(DEFAULT_SEED);
  const state = createState(seedNumber(raw.seed));
  state.credits = integer(raw.credits, 35);
  state.contractIndex = integer(raw.contractIndex, 0, 0, CONTRACTS.length - 1);
  if(raw.challenge&&typeof raw.challenge==='object'&&integer(raw.completed,0)>=CONTRACTS.length&&state.contractIndex===CONTRACTS.length-1) {
    state.challenge={round:integer(raw.challenge.round,1,1,1_000_000),seed:seedNumber(raw.challenge.seed)};
  }
  state.field = generateField(state.challenge?.seed??state.seed,state.contractIndex,state.challenge?contractFor(state):null);
  // Dependencies are recovered in tier order, so impossible upgrade chains are dropped.
  for (const node of [...UPGRADES].sort((a, b) => a.tier - b.tier)) {
    if (own(raw.upgrades, node.id) && raw.upgrades[node.id] === true && node.prerequisites.every((id) => owned(state, id))) state.upgrades[node.id] = true;
  }
  const selected = toolById.get(raw.selectedTool);
  if (selected && (!selected.requires || owned(state, selected.requires))) state.selectedTool = selected.id;
  state.items.pulse = integer(raw.items?.pulse, 2, 0, 99);
  state.items.overdrive = integer(raw.items?.overdrive, 1, 0, 99);
  for (const relic of RELICS) state.relics[relic.id] = integer(raw.relics?.[relic.id], 0, 0, 9999);
  state.stats.hay = numeric(raw.stats?.hay, 0, 0, MAX_CREDITS);
  state.stats.earned = integer(raw.stats?.earned, 0);
  state.stats.challenges = integer(raw.stats?.challenges,0,0,1_000_000);
  state.settings.sound = raw.settings?.sound === true;
  state.settings.reducedMotion = raw.settings?.reducedMotion === true;
  state.active.overdrive = numeric(raw.active?.overdrive, 0, 0, 12);
  state.active.pulse = numeric(raw.active?.pulse, 0, 0, 12);

  const savedField = raw.field;
  const shapeMatches = savedField && savedField.cols === state.field.cols && savedField.rows === state.field.rows
    && Array.isArray(savedField.cells) && savedField.cells.length === state.field.cells.length;
  if (shapeMatches) {
    state.field.cells = Array.from(savedField.cells, (cell, index) => {
      const fallback = state.field.cells[index];
      if (!cell || typeof cell !== 'object') return fallback;
      const maxDepth = numeric(cell.maxDepth, fallback.maxDepth, 0, MAX_DEPTH);
      const depth = numeric(cell.depth, maxDepth, 0, maxDepth);
      return { depth, maxDepth, loot: validLoot.has(cell.loot) ? cell.loot : null, collected: depth <= EPSILON || cell.collected === true, material:materialIds.has(cell.material)?cell.material:fallback.material };
    });
    state.field.needleCell = integer(savedField.needleCell, state.field.needleCell, 0, state.field.cells.length - 1);
    state.field.needleFound = savedField.needleFound === true;
    state.field.needleRecovered = state.field.needleFound || savedField.needleRecovered === true;
    const actualSalvage=state.field.cells.filter(cell=>cell.collected&&cell.loot).length;
    state.field.salvage=integer(savedField.salvage,actualSalvage,actualSalvage,actualSalvage*2);
    state.field.objectiveMilestones={};
    for(const id of objectiveIds(contractFor(state)))if(savedField.objectiveMilestones?.[id]===true||state.field.needleFound)state.field.objectiveMilestones[id]=true;
    // Only actual reward claims are persisted. Older saves begin with fresh deliveries.
    state.field.inspectedScenery={};
    for(const location of SCENERY)if(own(savedField.inspectedScenery,location.id)&&savedField.inspectedScenery[location.id]===true)state.field.inspectedScenery[location.id]=true;
    state.field.masteryCells={};
    for(let index=0;index<state.field.cells.length;index+=1)if(own(savedField.masteryCells,String(index))&&savedField.masteryCells[index]===true)state.field.masteryCells[index]=true;
    state.field.elapsed = numeric(savedField.elapsed, 0, 0, 10_000_000);
    state.field.combo = integer(savedField.combo, 0, 0, 12);
    state.field.comboTimer = numeric(savedField.comboTimer, 0, 0, 1.5);
    state.field.autoCursor = integer(savedField.autoCursor, 0, 0, state.field.cells.length - 1);
    if (state.field.needleRecovered) {
      state.field.cells[state.field.needleCell].depth = 0;
      state.field.cells[state.field.needleCell].collected = true;
    }
  }
  state.completed = state.challenge?CONTRACTS.length:state.contractIndex + (state.field.needleFound ? 1 : 0);
  state.stats.needles = integer(raw.stats?.needles, state.completed, state.completed, MAX_CREDITS);
  return state;
}

/** A JSON string suitable for localStorage. All persisted values are sanitized. */
export function serializeState(state) {
  return JSON.stringify(restoreState(state));
}

function runtimeState(state) {
  if (!state || typeof state !== 'object' || !Number.isInteger(state.contractIndex)
      || state.contractIndex < 0 || state.contractIndex >= CONTRACTS.length) return false;
  if(state.challenge&&(!Number.isInteger(state.challenge.round)||state.challenge.round<1||state.contractIndex!==CONTRACTS.length-1))return false;
  const contract = contractFor(state);
  if (!state.field || state.field.cols !== contract.cols || state.field.rows !== contract.rows
      || !Array.isArray(state.field.cells) || state.field.cells.length !== contract.cols * contract.rows
      || !Number.isInteger(state.field.needleCell) || state.field.needleCell < 0 || state.field.needleCell >= state.field.cells.length
      || !state.stats || !state.items || !state.upgrades || !state.relics || !state.active || !state.settings) return false;
  state.credits = integer(state.credits);
  state.stats.hay = numeric(state.stats.hay);
  state.stats.earned = integer(state.stats.earned);
  state.stats.needles = integer(state.stats.needles, 0, 0, MAX_CREDITS);
  state.stats.challenges = integer(state.stats.challenges,0,0,1_000_000);
  state.items.pulse = integer(state.items.pulse, 0, 0, 99);
  state.items.overdrive = integer(state.items.overdrive, 0, 0, 99);
  state.active.overdrive = numeric(state.active.overdrive, 0, 0, 12);
  state.active.pulse = numeric(state.active.pulse, 0, 0, 12);
  state.field.elapsed = numeric(state.field.elapsed, 0, 0, 10_000_000);
  state.field.combo = integer(state.field.combo, 0, 0, 12);
  state.field.comboTimer = numeric(state.field.comboTimer, 0, 0, 1.5);
  state.field.autoCursor = integer(state.field.autoCursor, 0, 0, state.field.cells.length - 1);
  state.field.needleRecovered=state.field.needleRecovered===true||state.field.needleFound===true;
  state.field.salvage=integer(state.field.salvage,0,0,state.field.cells.length*2);
  if(!state.field.objectiveMilestones||typeof state.field.objectiveMilestones!=='object')state.field.objectiveMilestones={};
  if(!state.field.inspectedScenery||typeof state.field.inspectedScenery!=='object'||Array.isArray(state.field.inspectedScenery))state.field.inspectedScenery={};
  if(!state.field.masteryCells||typeof state.field.masteryCells!=='object'||Array.isArray(state.field.masteryCells))state.field.masteryCells={};
  return true;
}

function toolFor(state) {
  const tool = toolById.get(state.selectedTool);
  return tool && (!tool.requires || owned(state, tool.requires)) ? tool : TOOLS[0];
}

function clueFor(state, progress) {
  if(state.field.needleFound)return null;
  if(state.field.needleRecovered){
    const contract=contractFor(state);
    const needSalvage=state.field.salvage<salvageTarget(state);
    if(!owned(state,'survey5')&&state.active.pulse<=0)return null;
    let kind=needSalvage?'salvage':'processing',tool;
    let candidates=state.field.cells.map((cell,index)=>({cell,index}));
    if(needSalvage)candidates=candidates.filter(({cell})=>cell.depth>EPSILON&&!cell.collected&&validLoot.has(cell.loot));
    else if(contract.mastery){
      const patches=candidates.filter(({cell})=>cell.maxDepth>0&&cell.material===contract.mastery.material);
      const surveyed=patches.filter(({index})=>own(state.field.masteryCells,String(index))&&state.field.masteryCells[index]===true).length;
      if(surveyed<Math.min(contract.mastery.cells,patches.length)){
        candidates=patches.filter(({index})=>!own(state.field.masteryCells,String(index))||state.field.masteryCells[index]!==true);
        kind='mastery';tool=contract.mastery.tool;
      }
    }
    if(!needSalvage&&kind!=='mastery'){
      let selected=false;
      for(const goal of contract.materialTargets??[]){
        const patches=candidates.filter(({cell})=>cell.material===goal.material);
        const total=patches.reduce((sum,{cell})=>sum+numeric(cell.maxDepth,0,0,MAX_DEPTH),0);
        const remaining=patches.reduce((sum,{cell})=>sum+numeric(cell.depth,0,0,MAX_DEPTH),0);
        if(total>EPSILON&&1-remaining/total+EPSILON<goal.target/100){candidates=patches.filter(({cell})=>cell.depth>EPSILON);kind='material';selected=true;break;}
      }
      if(!selected)for(const goal of contract.zoneTargets??[]){
        const patches=candidates.filter(({index})=>inZone(state.field,index,goal.zone));
        const total=patches.reduce((sum,{cell})=>sum+numeric(cell.maxDepth,0,0,MAX_DEPTH),0);
        const remaining=patches.reduce((sum,{cell})=>sum+numeric(cell.depth,0,0,MAX_DEPTH),0);
        if(total>EPSILON&&1-remaining/total+EPSILON<goal.target/100){candidates=patches.filter(({cell})=>cell.depth>EPSILON);kind='zone';selected=true;break;}
      }
      if(!selected)candidates=candidates.filter(({cell})=>cell.depth>EPSILON);
    }
    let target=-1,best=Infinity;
    const nc=state.field.needleCell%state.field.cols,nr=Math.floor(state.field.needleCell/state.field.cols);
    candidates.forEach(({index})=>{const distance=Math.hypot(index%state.field.cols-nc,Math.floor(index/state.field.cols)-nr);if(distance<best){target=index;best=distance;}});
    return target>=0?{col:target%state.field.cols,row:Math.floor(target/state.field.cols),radius:kind==='processing'?2.1:1.1,kind,...(tool?{tool}:{})}:null;
  }
  const threshold = owned(state, 'survey4') ? 0 : owned(state, 'survey3') ? 0.12 : owned(state, 'survey1') ? 0.32 : 0.5;
  if (progress + EPSILON < threshold && state.active.pulse <= 0) return null;
  const needleCol = state.field.needleCell % state.field.cols;
  const needleRow = Math.floor(state.field.needleCell / state.field.cols);
  if (owned(state, 'survey3') || owned(state, 'survey4')) return { col: needleCol, row: needleRow, radius: owned(state, 'survey4') ? 0.55 : 1.1, kind:'needle' };
  const size = owned(state, 'survey1') || state.active.pulse > 0 ? 3 : 4;
  const col = Math.min(state.field.cols - 1, Math.floor(needleCol / size) * size + (size - 1) / 2);
  const row = Math.min(state.field.rows - 1, Math.floor(needleRow / size) * size + (size - 1) / 2);
  return { col, row, radius: Math.max(1.5, Math.hypot(col - needleCol, row - needleRow) + 0.7), kind:'needle' };
}

function inZone(field,index,zone){
  const col=index%field.cols,row=Math.floor(index/field.cols);
  return zone==='north'?row<field.rows*.35:zone==='south'?row>=field.rows*.65:zone==='east'?col>=field.cols*.65:col<field.cols*.35;
}

function salvageTarget(state){
  const target=Math.ceil(contractFor(state).salvageTarget*(owned(state,'survey7') ? .8 : 1));
  // Valid fields always contain more finds than required. A damaged save with
  // missing loot must still have a reachable objective.
  const available=state.field.cells.filter(cell=>validLoot.has(cell?.loot)).length;
  return Math.min(target,available);
}

export function toolEfficiency(state, toolId, material){
  const tool=toolById.get(toolId)||TOOLS[0];
  let value=tool.efficiencies[material]??tool.efficiencies.loose;
  if(owned(state,'harvest6'))value=Math.max(.6,value);
  if(tool.id==='magnet'&&material==='static'&&owned(state,'survey6'))value*=1.2;
  return value;
}

export function derive(state) {
  if (!runtimeState(state)) state = restoreState(state);
  const contract=contractFor(state);
  const tool = toolFor(state);
  let hayTotal = 0;
  let hayRemaining = 0;
  const materialSummary=MATERIALS.map(material=>({...material,cells:0,remaining:0,total:0,progress:0}));
  for (const cell of state.field.cells) {
    const total=numeric(cell?.maxDepth,0,0,MAX_DEPTH),remaining=numeric(cell?.depth,0,0,total);
    hayTotal+=total;hayRemaining+=remaining;
    const summary=materialSummary.find(material=>material.id===cell?.material)||materialSummary[0];
    if(total>0){summary.cells+=1;summary.total+=total;summary.remaining+=remaining;}
  }
  materialSummary.forEach(material=>material.progress=material.total>0?1-material.remaining/material.total:1);
  const progress = hayTotal > EPSILON ? clamp(1 - hayRemaining / hayTotal, 0, 1) : 1;
  let power = tool.power * (1 + (owned(state, 'harvest1') ? 0.3 : 0) + (owned(state, 'harvest4') ? 0.4 : 0)+(owned(state,'harvest6')?.2:0));
  let radius = tool.radius + (owned(state, 'harvest3') ? 0.35 : 0);
  if(owned(state,'harvest7')){radius+=.2;power*=1+state.field.combo*.015;}
  if (tool.id === 'magnet' && owned(state, 'survey4')) { power *= 1.25; radius += 0.2; }
  if (state.active.overdrive > 0) { power *= 1.5; radius += 0.25; }
  const autoRate = (owned(state, 'automation1') ? .7 : 0) + (owned(state, 'automation2') ? 1.3 : 0)
    + (owned(state, 'automation3') ? 2 : 0) + (owned(state, 'automation4') ? 3 : 0)
    + (owned(state,'automation5')?2:0)+(owned(state,'automation6')?3:0)+(owned(state,'automation7')?4:0);
  const objectives=[
    {id:'processing',format:'percent',label:`Process ${contract.processingTarget}% of the hay`,current:Math.min(100,Math.floor((progress+EPSILON)*100)),target:contract.processingTarget,complete:progress+EPSILON>=contract.processingTarget/100},
    {id:'salvage',format:'count',label:'Uncover buried salvage',current:state.field.salvage,target:salvageTarget(state),complete:state.field.salvage>=salvageTarget(state)},
    {id:'needle',format:'count',label:'Recover the needle',current:state.field.needleRecovered?1:0,target:1,complete:state.field.needleRecovered},
  ];
  for(const goal of contract.materialTargets??[]){
    const material=materialSummary.find(material=>material.id===goal.material);
    objectives.push({id:`material:${goal.material}`,format:'percent',label:`Process ${material.name.toLowerCase()}`,current:Math.floor((material.progress+EPSILON)*100),target:goal.target,complete:material.progress+EPSILON>=goal.target/100});
  }
  for(const goal of contract.zoneTargets??[]){
    let total=0,remaining=0;
    state.field.cells.forEach((cell,index)=>{
      if(inZone(state.field,index,goal.zone)){const max=numeric(cell?.maxDepth,0,0,MAX_DEPTH);total+=max;remaining+=numeric(cell?.depth,0,0,max);}
    });
    const cleared=total>EPSILON?1-remaining/total:1;
    objectives.push({id:`zone:${goal.zone}`,format:'percent',label:`Restore the ${goal.zone} rows`,current:Math.floor((cleared+EPSILON)*100),target:goal.target,complete:cleared+EPSILON>=goal.target/100});
  }
  if(contract.mastery){
    const available=state.field.cells.map((cell,index)=>({cell,index})).filter(({cell})=>cell.maxDepth>0&&cell.material===contract.mastery.material);
    const current=available.filter(({index})=>own(state.field.masteryCells,String(index))&&state.field.masteryCells[index]===true).length;
    const target=Math.min(contract.mastery.cells,available.length);
    objectives.push({id:'mastery',format:'count',label:`${toolById.get(contract.mastery.tool).name} survey: ${MATERIALS.find(material=>material.id===contract.mastery.material).name.toLowerCase()}`,current,target,complete:current>=target});
  }
  if(state.field.needleFound)objectives.forEach(objective=>objective.complete=true);
  return {
    progress, hayRemaining, hayTotal, power, radius, autoRate,
    comboMultiplier: 1 + state.field.combo * 0.025,
    clue: clueFor(state, progress),
    needleExposed: !state.field.needleRecovered && numeric(state.field.cells[state.field.needleCell]?.depth, 0, 0, MAX_DEPTH) <= EPSILON,
    needleRecovered:state.field.needleRecovered,objectives,materialSummary,efficiencies:Object.fromEntries(MATERIALS.map(material=>[material.id,toolEfficiency(state,tool.id,material.id)])),
    contract, tool, challenge:state.challenge?{...state.challenge}:null,
  };
}

function credit(state, amount) {
  const payout = integer(amount);
  state.credits = Math.min(MAX_CREDITS, state.credits + payout);
  state.stats.earned = Math.min(MAX_CREDITS, state.stats.earned + payout);
  return payout;
}

function payoutCell(state, cell, index, events, manual) {
  if (cell.collected) return 0;
  cell.collected = true;
  if (manual) { state.field.combo = Math.min(12, state.field.combo + 1); state.field.comboTimer = 1.5; }
  const multiplier = (1 + state.field.combo * 0.025) * (owned(state, 'automation3') ? 1.3 : 1);
  const base = 1 + Math.floor(cell.maxDepth * 0.7) + Math.floor(state.contractIndex * 0.35);
  const earned = credit(state, Math.max(1, Math.round(base * multiplier)));
  if (cell.loot) {
    state.field.salvage=Math.min(state.field.cells.length*2,state.field.salvage+(!manual&&owned(state,'automation7')?2:1));
    let extra = 0;
    let relic = null;
    if (cell.loot === 'pulse' || cell.loot === 'overdrive') state.items[cell.loot] = Math.min(99, state.items[cell.loot] + 1);
    else if (cell.loot.startsWith('relic:')) {
      relic = relicById.get(cell.loot.slice(6));
      if (relic) { state.relics[relic.id] = Math.min(9999, integer(state.relics[relic.id], 0, 0, 9999) + 1); extra = credit(state, Math.round(relic.value*(owned(state,'survey7')?1.3:1))); }
    } else extra = credit(state, Math.round((cell.loot === 'cache' ? 20 + state.contractIndex * 7 : 8 + state.contractIndex * 3) * multiplier));
    events.push({ type: 'loot', index, col: index % state.field.cols, row: Math.floor(index / state.field.cols), id: cell.loot, relic: relic?.id || null, name: relic?.name || cell.loot, credits: extra });
  }
  return earned;
}

function clearCell(state, index, amount, events, manual) {
  const cell = state.field.cells[index];
  if (!cell || typeof cell !== 'object') return 0;
  cell.maxDepth = numeric(cell.maxDepth, 0, 0, MAX_DEPTH);
  cell.depth = numeric(cell.depth, cell.maxDepth, 0, cell.maxDepth);
  if (!validLoot.has(cell.loot)) cell.loot = null;
  if (cell.depth <= EPSILON || amount <= 0) return 0;
  const removed = Math.min(cell.depth, numeric(amount));
  cell.depth -= removed;
  if (cell.depth <= EPSILON) cell.depth = 0;
  state.stats.hay = Math.min(MAX_CREDITS, state.stats.hay + removed);
  const earned = cell.depth === 0 ? payoutCell(state, cell, index, events, manual) : 0;
  events.push({ type: 'hay', index, col: index % state.field.cols, row: Math.floor(index / state.field.cols), amount: removed, depth: cell.depth, cleared: cell.depth === 0, credits: earned, automated: !manual });
  return removed;
}

function collectNeedle(state, events) {
  if (state.field.needleRecovered) return;
  state.field.needleRecovered = true;
  state.stats.needles = Math.min(MAX_CREDITS, state.stats.needles + 1);
  const bounty=credit(state,25+state.contractIndex*10);
  events.push({ type: 'needle', index: state.field.needleCell, col: state.field.needleCell % state.field.cols, row: Math.floor(state.field.needleCell / state.field.cols), credits:bounty, recovered:true });
}

function processObjectives(state,events){
  if(state.field.needleFound)return;
  const view=derive(state);
  for(const objective of view.objectives){
    if(objective.complete&&!state.field.objectiveMilestones[objective.id]){
      state.field.objectiveMilestones[objective.id]=true;
      events.push({type:'objective',...objective});
    }
  }
  if(!view.objectives.every(objective=>objective.complete))return;
  state.field.needleFound=true;
  state.completed=state.challenge?CONTRACTS.length:state.contractIndex+1;
  if(state.challenge)state.stats.challenges=Math.min(1_000_000,state.stats.challenges+1);
  const contract=contractFor(state),bonus=credit(state,contract.bonus);
  state.items.pulse=Math.min(99,state.items.pulse+1);
  state.items.overdrive=Math.min(99,state.items.overdrive+1);
  events.push({type:'complete',contractIndex:state.contractIndex,name:contract.name,bonus,completed:state.completed,
    victory:!state.challenge&&state.completed===CONTRACTS.length,challenge:!!state.challenge,round:state.challenge?.round??null});
}

export function sweep(state, col, row, dt = 0.12) {
  const events = [];
  if (!runtimeState(state) || state.field.needleFound || typeof col !== 'number' || typeof row !== 'number'
      || !Number.isFinite(col) || !Number.isFinite(row) || col < 0 || row < 0 || col > state.field.cols - 1 || row > state.field.rows - 1) return events;
  const time = numeric(dt, 0, 0, 0.2);
  if (time <= 0) return events;
  const before = derive(state);
  const startCol = Math.max(0, Math.ceil(col - before.radius));
  const endCol = Math.min(state.field.cols - 1, Math.floor(col + before.radius));
  const startRow = Math.max(0, Math.ceil(row - before.radius));
  const endRow = Math.min(state.field.rows - 1, Math.floor(row + before.radius));
  for (let y = startRow; y <= endRow; y += 1) {
    for (let x = startCol; x <= endCol; x += 1) {
      const distance = Math.hypot(x - col, y - row);
      if (distance > before.radius) continue;
      const index = y * state.field.cols + x;
      const cell = state.field.cells[index];
      const metal = index === state.field.needleCell || cell?.loot === 'scrap' || cell?.loot === 'cache' || (typeof cell?.loot === 'string' && cell.loot.startsWith('relic:'));
      const strength = Math.max(0.3, 1 - distance / (before.radius + 0.5));
      const material=materialIds.has(cell?.material)?cell.material:'loose';
      const mastery=contractFor(state).mastery;
      if(mastery&&mastery.tool===before.tool.id&&mastery.material===material&&numeric(cell?.maxDepth,0,0,MAX_DEPTH)>0)state.field.masteryCells[index]=true;
      const metalBonus=before.tool.id==='magnet'&&metal?(owned(state,'survey6')?1.25:1.1):1;
      clearCell(state, index, before.power * strength * time * toolEfficiency(state,before.tool.id,material) * metalBonus, events, true);
    }
  }
  const needleCol = state.field.needleCell % state.field.cols;
  const needleRow = Math.floor(state.field.needleCell / state.field.cols);
  if (!state.field.needleRecovered&&numeric(state.field.cells[state.field.needleCell]?.depth, 0, 0, MAX_DEPTH) <= EPSILON && Math.hypot(needleCol - col, needleRow - row) <= 0.8) collectNeedle(state, events);
  processObjectives(state,events);
  const after = derive(state);
  if (!before.clue && after.clue) events.push({ type: 'clue', ...after.clue });
  return events;
}

export function tick(state, dt) {
  const events = [];
  if (!runtimeState(state)) return events;
  const time = numeric(dt, 0, 0, 0.25);
  if (time <= 0) return events;
  state.active.pulse = Math.max(0, state.active.pulse - time);
  state.active.overdrive = Math.max(0, state.active.overdrive - time);
  state.field.comboTimer = Math.max(0, state.field.comboTimer - time);
  if (state.field.comboTimer <= 0) state.field.combo = 0;
  if (state.field.needleFound) return events;
  state.field.elapsed = Math.min(10_000_000, state.field.elapsed + time);
  const before = derive(state);
  let budget = before.autoRate * time;
  const count = state.field.cells.length;
  let inspected = 0;
  while (budget > EPSILON && inspected < count) {
    if(owned(state,'automation5')&&state.field.salvage<salvageTarget(state)){
      const find=state.field.cells.findIndex(cell=>cell&&!cell.collected&&cell.depth>EPSILON&&validLoot.has(cell.loot));
      if(find>=0)state.field.autoCursor=find;
    }
    const index = state.field.autoCursor;
    const material=state.field.cells[index]?.material;
    let efficiency=({loose:1,packed:.7,tangled:.25,static:.35})[material]||1;
    if(owned(state,'automation6')&&(material==='packed'||material==='tangled'))efficiency*=1.5;
    const removed = clearCell(state, index, budget*efficiency, events, false);
    budget -= removed/efficiency;
    if (numeric(state.field.cells[index]?.depth, 0, 0, MAX_DEPTH) <= EPSILON || removed === 0) {
      state.field.autoCursor = (index + 1) % count;
      inspected += 1;
    } else break;
  }
  const after = derive(state);
  if (!before.clue && after.clue) events.push({ type: 'clue', ...after.clue });
  processObjectives(state,events);
  return events;
}

export function upgradeCost(state, id) {
  return upgradeById.get(id)?.cost ?? null;
}

export function getResearchLock(state,id) {
  const node=upgradeById.get(id);
  if(!node)return 'Unknown research.';
  if(owned(state,id))return null;
  if(!runtimeState(state))return 'Start an expedition to research this idea.';
  const completed=integer(state.completed,0,0,CONTRACTS.length);
  if(completed<node.requiredContracts)return `Complete ${node.requiredContracts} field${node.requiredContracts===1?'':'s'} to research this idea (${node.requiredContracts-completed} more).`;
  const missing=node.prerequisites.filter(required=>!owned(state,required));
  return missing.length?`Research ${missing.map(required=>upgradeById.get(required).name).join(' and ')} first.`:null;
}

export function buyUpgrade(state, id) {
  const node = upgradeById.get(id);
  if (!runtimeState(state) || !node || owned(state, id) || getResearchLock(state,id)!==null || state.credits < node.cost) return [];
  state.credits -= node.cost;
  state.upgrades[id] = true;
  const events=[{ type: 'upgrade', id, name: node.name, cost: node.cost, branch: node.branch }];
  processObjectives(state,events);
  return events;
}

export function selectTool(state, id) {
  const tool = toolById.get(id);
  if (!runtimeState(state) || !tool || (tool.requires && !owned(state, tool.requires)) || state.selectedTool === id) return [];
  state.selectedTool = id;
  return [{ type: 'item', id, kind: 'tool', name: tool.name }];
}

export function useItem(state, id) {
  if (!runtimeState(state) || state.field.needleFound || (id !== 'pulse' && id !== 'overdrive') || state.items[id] <= 0 || state.active[id] > 0) return [];
  const duration = id === 'overdrive' ? 12 : owned(state, 'survey1') ? 12 : 8;
  state.items[id] -= 1;
  state.active[id] = duration;
  const events = [{ type: 'item', id, kind: 'consumable', duration, remaining: state.items[id] }];
  if (id === 'pulse') events.push({ type: 'clue', ...derive(state).clue });
  return events;
}

/** Farm deliveries are optional, deterministic, and payable once per field. */
export function inspectScenery(state, id) {
  const location = sceneryById.get(id);
  if (!runtimeState(state) || !location) return [];
  const event = { type: 'scenery', id, title: location.title, message: '',
    claimed: false, available: false, repeated: false, credits: 0, items: {} };
  if (own(state.field.inspectedScenery,id) && state.field.inspectedScenery[id] === true) {
    event.repeated = true;
    event.message = location.repeatMessage;
    return [event];
  }
  if (state.field.needleFound) {
    event.message = 'This field is complete. Start the next contract for fresh farm deliveries.';
    return [event];
  }
  if (location.requires && !owned(state,location.requires)) {
    event.message = `Research ${upgradeById.get(location.requires).name} to use ${location.name.toLowerCase()}.`;
    return [event];
  }

  if (id === 'barn' || id === 'windmill') {
    const item = id === 'barn' ? 'pulse' : 'overdrive';
    if (state.items[item] >= 99) {
      event.message = 'Your supplies are full. Use a charge or flask, then return for this delivery.';
      return [event];
    }
    state.items[item] += 1;
    event.items[item] = 1;
    event.message = id === 'barn' ? 'Delivery collected: +1 scanner charge.' : 'Freshly mixed: +1 turbo flask. Use Boost when you need it.';
  } else if (id === 'drone') {
    const pulse = Math.max(0, 2 - state.items.pulse);
    const overdrive = Math.max(0, 1 - state.items.overdrive);
    if (pulse === 0 && overdrive === 0) {
      event.message = 'Supplies are stocked. Return when you have fewer than two scanners or one turbo flask.';
      return [event];
    }
    state.items.pulse += pulse;
    state.items.overdrive += overdrive;
    if (pulse > 0) event.items.pulse = pulse;
    if (overdrive > 0) event.items.overdrive = overdrive;
    event.message = 'Supply run complete. You have at least two scanner charges and one turbo flask.';
  } else {
    const cacheRoll = seedNumber(`${state.seed}:${state.contractIndex}:farm-cache`) % 10;
    const amount = id === 'crates' ? 18 + state.contractIndex * 3 + cacheRoll : 12 + state.contractIndex * 3;
    const beforeCredits = state.credits;
    credit(state,amount);
    event.credits = state.credits - beforeCredits;
    event.message = id === 'crates' ? `A forgotten coin pouch: +${event.credits} coins.` : `Sorted and shipped: +${event.credits} coins.`;
  }
  state.field.inspectedScenery[id] = true;
  event.claimed = true;
  event.available = true;
  return [event];
}

export function nextContract(state) {
  if (!runtimeState(state) || state.challenge || !state.field.needleFound || state.contractIndex >= CONTRACTS.length - 1) return [];
  state.contractIndex += 1;
  state.completed = state.contractIndex;
  state.field = generateField(seedNumber(state.seed), state.contractIndex);
  state.active.pulse = 0;
  state.active.overdrive = 0;
  return [{ type: 'item', id: 'contract', kind: 'start', contractIndex: state.contractIndex, name: CONTRACTS[state.contractIndex].name }];
}

/** Replayable surveys preserve the completed campaign and every purchased item. */
export function startChallenge(state,seed) {
  if(!runtimeState(state)||state.completed<CONTRACTS.length||!state.field.needleFound)return [];
  const round=Math.min(1_000_000,(state.challenge?.round??0)+1);
  const challengeSeed=seed===undefined?seedNumber(`${state.seed}:challenge:${round}`):seedNumber(seed);
  state.contractIndex=CONTRACTS.length-1;
  state.completed=CONTRACTS.length;
  state.challenge={round,seed:challengeSeed};
  const contract=contractFor(state);
  state.field=generateField(challengeSeed,state.contractIndex,contract);
  state.active.pulse=0;
  state.active.overdrive=0;
  return [{type:'item',id:'challenge',kind:'start',round,name:contract.name}];
}

export function toggleSetting(state, key) {
  if (!runtimeState(state) || (key !== 'sound' && key !== 'reducedMotion')) return [];
  state.settings[key] = !state.settings[key];
  return [{ type: 'item', id: key, kind: 'setting', value: state.settings[key] }];
}
