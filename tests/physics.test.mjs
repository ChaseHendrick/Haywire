import test from 'node:test';
import assert from 'node:assert/strict';
import { createHayPhysics, MAX_HAY_BODIES } from '../physics.js';

function advance(physics, seconds) {
  for (let index = 0; index < Math.ceil(seconds * 60); index += 1) physics.step(1 / 60);
}

function field(depth = 1, seed = 1, contractIndex = 0) {
  return { seed, contractIndex, field: { cols: 1, rows: 1,
    cells: [{ depth, maxDepth: 1 }] } };
}

function assertBodyFinite(body) {
  for (const vector of [body.position, body.velocity, body.angularVelocity]) {
    assert.ok([vector.x, vector.y, vector.z].every(Number.isFinite));
  }
  assert.ok([body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w].every(Number.isFinite));
}

test('a new remix seed resets loose hay even when the field dimensions stay the same',()=>{
  const physics=createHayPhysics(),state=field(1,7,23);
  state.field.generationSeed=100;physics.syncField(state,.5);physics.emit(0,0,'rake',2);
  assert.equal(physics.getStats().activeBodies,2);
  physics.syncField(state,.5);assert.equal(physics.getStats().activeBodies,2);
  state.field.generationSeed=101;physics.syncField(state,.5);
  assert.equal(physics.getStats().activeBodies,0);physics.dispose();
});

test('restoring the same field and changing tools preserves hay, while an equal-size next field clears it',()=>{
  const physics=createHayPhysics(),state=field(1,73,8);
  state.field.generationSeed=400;
  state.selectedTool='rake';state.settings={reducedMotion:false};
  physics.syncField(state,.5);physics.emit(0,.15,'magnet',1,2);
  advance(physics,4);
  const body=physics.getBodies()[0],before=physics.getStats();
  assert(before.collisions>0);
  const restored=JSON.parse(JSON.stringify(state));
  restored.selectedTool='cutter';restored.settings.reducedMotion=true;
  physics.syncField(restored,.5);
  assert.strictEqual(physics.getBodies()[0],body,'A saved field clone retains the same live hay');
  assert.deepEqual(physics.getStats(),before);
  restored.contractIndex++;
  restored.field.cells[0].depth=0;
  physics.syncField(restored,.5);
  assert.equal(physics.getStats().activeBodies,0);
  assert.equal(physics.getStats().collisions,0);
  physics.emit(0,.15,'magnet',1,2);advance(physics,4);
  assert.ok(physics.getBodies()[0].position.y<.52,'The next field cannot inherit its predecessor\'s pile collider');
  assertBodyFinite(physics.getBodies()[0]);physics.dispose();
});

test('real gravity pulls airborne hay onto the ground, where collisions settle and sleep', () => {
  const physics = createHayPhysics();
  physics.emit(0, 0, 'magnet', 1, 2);
  const body = physics.getBodies()[0];
  const initialY = body.position.y;
  advance(physics, 0.2);
  assert.ok(body.position.y < initialY - 0.1);
  assert.ok(body.velocity.y < -1);
  advance(physics, 5);
  assert.ok(body.position.y >= 0.34 && body.position.y < 0.52, `Settled height ${body.position.y}`);
  assert.ok(body.velocity.length() < 0.12);
  assert.ok(physics.getStats().collisions > 0);
  assert.equal(physics.getStats().sleepingBodies, 1);
  assertBodyFinite(body);
  physics.dispose();
});

test('pile collisions support hay and clearing their depths lets the same body fall', () => {
  const physics = createHayPhysics();
  const state = field(1);
  physics.syncField(state, 1);
  physics.emit(0, 0.15, 'magnet', 1, 2);
  const body = physics.getBodies()[0];
  advance(physics, 4);
  assert.ok(body.position.y > 1.2, `Pile height ${body.position.y}`);
  state.field.cells[0].depth = 0;
  physics.syncField(state, 1);
  assert.strictEqual(physics.getBodies()[0], body);
  advance(physics, 4);
  assert.ok(body.position.y < 0.52, `Cleared height ${body.position.y}`);
  assertBodyFinite(body);
  physics.dispose();
});

test('dynamic bodies are bounded, retained briefly, and recycled only at the cap', () => {
  const physics = createHayPhysics();
  physics.emit(0, 0, 'rake', 999);
  assert.equal(physics.getBodies().length, MAX_HAY_BODIES);
  const oldest = physics.getBodies()[0];
  physics.emit(0, 0, 'vacuum', 10);
  assert.strictEqual(physics.getBodies()[0], oldest);
  advance(physics, 3.1);
  physics.emit(0, 0, 'vacuum', 10);
  assert.equal(physics.getBodies().length, MAX_HAY_BODIES);
  assert.ok(!physics.getBodies().includes(oldest));
  advance(physics, 2);
  for (const body of physics.getBodies()) {
    assertBodyFinite(body);
    assert.ok(Math.abs(body.position.x) <= 6.4 && Math.abs(body.position.z) <= 4.9);
  }
  assert.equal(physics.getStats().maxBodies, MAX_HAY_BODIES);
  physics.dispose();
});

test('field identity changes clear dynamic hay and stale terrain, while empty cells stay finite', () => {
  const physics = createHayPhysics();
  physics.syncField(field(1), 1);
  physics.emit(0, 0.15, 'rake', 4);
  assert.equal(physics.getStats().activeBodies, 4);
  physics.syncField(field(0, 1, 1), 1);
  assert.equal(physics.getStats().activeBodies, 0);
  physics.emit(0, 0.15, 'magnet', 1, 2);
  advance(physics, 4);
  assert.ok(physics.getBodies()[0].position.y < 0.52);
  physics.syncField({ seed: 2, contractIndex: 1, field: { cols: 1, rows: 1,
    cells: [{ depth: NaN, maxDepth: 0 }] } }, 1);
  assert.equal(physics.getStats().activeBodies, 0);
  physics.emit(0, 0.15, 'magnet', 1);
  advance(physics, 3);
  assertBodyFinite(physics.getBodies()[0]);
  physics.reset();
  assert.deepEqual(physics.getStats(), { activeBodies: 0, sleepingBodies: 0, collisions: 0, maxBodies: MAX_HAY_BODIES, samples: [] });
  physics.dispose();
});

test('tools impart distinct finite real impulses and invalid inputs cannot corrupt physics', () => {
  const velocities = {};
  for (const tool of ['rake', 'vacuum', 'magnet']) {
    const physics = createHayPhysics();
    physics.emit(0, 0, tool, 1);
    const body = physics.getBodies()[0];
    velocities[tool] = body.velocity.clone();
    assertBodyFinite(body);
    if (tool === 'vacuum') assert.ok(body.velocity.x > 1 && body.velocity.z > 0.4);
    physics.emit(NaN, 0, tool);
    physics.emit(0, Infinity, tool);
    assert.equal(physics.getStats().activeBodies, 1);
    physics.step(NaN);
    physics.step(-1);
    physics.step(1000);
    assertBodyFinite(body);
    assert.ok(body.position.y > 1.3, 'Frozen tabs only advance a bounded frame');
    physics.dispose();
    physics.emit(0, 0);
    physics.step(1);
    assert.equal(physics.getStats().activeBodies, 0);
  }
  assert.ok(velocities.rake.length() > velocities.magnet.length() * 2);
  assert.ok(velocities.vacuum.length() > velocities.rake.length());
});

test('sweeping wakes settled hay and gives each tool a spatially limited real impulse', () => {
  for (const tool of ['rake', 'vacuum', 'magnet', 'cutter']) {
    const physics = createHayPhysics();
    physics.emit(0, 0, 'magnet', 1, 2);
    advance(physics, 5);
    const body = physics.getBodies()[0];
    const origin = body.position.clone();
    assert.equal(physics.getStats().sleepingBodies, 1);
    physics.stir(origin.x - 0.3, origin.z, tool, 0.8, 0.08);
    assert.equal(physics.getStats().sleepingBodies, 0);
    assert.ok(body.velocity.length() > 0.025);
    if (tool === 'vacuum') assert.ok(body.velocity.x < 0 && body.velocity.y > 0);
    if (tool === 'rake' || tool === 'magnet') assert.ok(body.velocity.x > 0);
    if (tool === 'cutter') assert.ok(body.velocity.z > 0);
    advance(physics, 0.1);
    assert.ok(body.position.distanceTo(origin) > 0.001);
    const before = body.velocity.clone();
    physics.stir(6, 4, tool, 0.1);
    assert.deepEqual(body.velocity, before);
    const sample = physics.getStats().samples[0];
    sample.position.x = 999;
    assert.notEqual(body.position.x, 999, 'QA samples cannot mutate the simulation');
    assertBodyFinite(body);
    physics.dispose();
  }
});
