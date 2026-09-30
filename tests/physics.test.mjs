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

const identityQuaternion = [0, 0, 0, 1];
function box(id, position, size, quaternion = identityQuaternion, moving = false) {
  return { id, objectId: id.split(':')[0], type: 'box', position, size, quaternion, moving };
}
function rotation(axis, angle) {
  const half = angle / 2;
  return axis.map(component => component * Math.sin(half)).concat(Math.cos(half));
}
function placeStraw(physics, position, velocity = [0, 0, 0], quaternion = identityQuaternion) {
  physics.emit(position[0], position[2], 'magnet', 1, position[1]);
  const body = physics.getBodies().at(-1);
  body.position.set(...position);
  body.velocity.set(...velocity);
  body.angularVelocity.setZero();
  body.quaternion.set(...quaternion);
  body.aabbNeedsUpdate = true;
  body.wakeUp();
  return body;
}

test('scenery registration preserves separate exact shapes and updates only changed geometry', () => {
  const physics = createHayPhysics();
  const yaw = rotation([0, 1, 0], 0.7);
  const descriptors = [box('barn:roof', [2, 1.6, -2], [1.8, 0.1, 1], yaw),
    { id: 'mill:tower', objectId: 'mill', type: 'cylinder', position: [-2, 1, -2],
      quaternion: identityQuaternion, radiusTop: .3, radiusBottom: .5, height: 1.4, moving: false },
    { id: 'plant:crown', objectId: 'plant', type: 'sphere', position: [3, .8, 2],
      quaternion: identityQuaternion, radius: .2, moving: false }];
  physics.syncScenery(descriptors);
  const [roof, tower, crown] = physics.getSceneryBodies();
  const shape = roof.shapes[0];
  assert.equal(physics.getSceneryStats().count, 3);
  assert.deepEqual(roof.position.toArray(), descriptors[0].position);
  assert.deepEqual(roof.quaternion.toArray(), yaw);
  assert.deepEqual(shape.halfExtents.toArray(), [.9, .05, .5]);
  assert.equal(tower.shapes[0].height, 1.4);
  assert.equal(tower.shapes[0].radiusTop, .3);
  assert.equal(crown.shapes[0].radius, .2);
  physics.syncScenery(structuredClone(descriptors), 1 / 60);
  assert.strictEqual(physics.getSceneryBodies()[0], roof);
  assert.strictEqual(roof.shapes[0], shape);
  descriptors[0].size[0] += 1e-14;
  physics.syncScenery(descriptors);
  assert.strictEqual(roof.shapes[0], shape, 'World-transform roundoff preserves cached geometry');
  descriptors[0].size[0] = 2;
  physics.syncScenery(descriptors);
  assert.strictEqual(physics.getSceneryBodies()[0], roof);
  assert.notStrictEqual(roof.shapes[0], shape);
  assert.equal(roof.shapes[0].halfExtents.x, 1);
  const snapshot = physics.getSceneryStats();
  snapshot.shapes[0].position[0] = 999;
  assert.equal(roof.position.x, 2);
  physics.dispose();
});

test('rotated walls stop hay in their local orientation rather than a world-aligned oversized box', () => {
  const physics = createHayPhysics();
  const yaw = rotation([0, 1, 0], .68);
  physics.syncScenery([box('fence:rail', [0, 1.1, 0], [.08, 1.2, 2], yaw)]);
  const wall = physics.getSceneryBodies()[0];
  const start = wall.quaternion.vmult({ x: -1, y: 0, z: 0 });
  start.y += 1.1;
  const velocity = wall.quaternion.vmult({ x: 16, y: 0, z: 0 });
  const body = placeStraw(physics, start.toArray(), velocity.toArray(), yaw);
  advance(physics, .15);
  const local = wall.quaternion.conjugate().vmult(body.position.vsub(wall.position));
  assert.ok(local.x < -.05, `Wall-local X ${local.x}`);
  assert.ok(physics.getStats().collisions > 0);
  assertBodyFinite(body);
  physics.dispose();
});

test('sloped roofs support hay at the actual different heights of the pitched surface', () => {
  const physics = createHayPhysics();
  physics.syncScenery([box('barn:roof', [0, 1.2, 0], [2, .12, 2], rotation([1, 0, 0], .6))]);
  const roof = physics.getSceneryBodies()[0];
  const higher = placeStraw(physics, [-.5, 2.2, -.35]);
  const lower = placeStraw(physics, [.5, 2.2, .35]);
  advance(physics, 1);
  for (const body of [higher, lower]) {
    const local = roof.quaternion.conjugate().vmult(body.position.vsub(roof.position));
    assert.ok(local.y > .04 && local.y < .3, `Roof-local height ${local.y}`);
    assertBodyFinite(body);
  }
  assert.ok(higher.position.y > lower.position.y + .3,
    `Pitched contact heights ${higher.position.y}, ${lower.position.y}`);
  assert.ok(physics.getStats().collisions > 0);
  physics.dispose();
});

test('stacked crates support stable hay while the real gap between neighboring crates remains open', () => {
  const physics = createHayPhysics();
  physics.syncScenery([box('crate:left-low', [-.45, .6, 0], [.5, .5, .5]),
    box('crate:left-high', [-.45, 1.1, 0], [.5, .5, .5]),
    box('crate:right-low', [.45, .6, 0], [.5, .5, .5])]);
  const onStack = placeStraw(physics, [-.45, 2.2, 0]);
  const inGap = placeStraw(physics, [0, 2.2, 0], [0, 0, 0], rotation([1, 0, 0], Math.PI / 2));
  advance(physics, 5);
  assert.ok(onStack.position.y > 1.34 && onStack.position.y < 1.52, `Stack height ${onStack.position.y}`);
  assert.ok(inGap.position.y < .54, `Open gap height ${inGap.position.y}`);
  assert.ok(Math.abs(inGap.position.x) < .18);
  assert.ok(onStack.velocity.length() < .12);
  assert.equal(onStack.sleepState, 2, 'A supported straw settles instead of jittering indefinitely');
  physics.dispose();
});

test('thin fence contacts survive high-speed throws and leave the space between rails open', () => {
  const physics = createHayPhysics();
  physics.syncScenery([box('fence:lower', [0, .75, 0], [.04, .08, 2]),
    box('fence:upper', [0, 1.45, 0], [.04, .08, 2])]);
  const hit = placeStraw(physics, [-.6, 1.45, -.4], [240, 0, 0]);
  const throughGap = placeStraw(physics, [-.6, 1.05, .4], [20, 0, 0]);
  physics.step(.05);
  assert.ok(hit.position.x < -.035, `Thin fence crossing ${hit.position.x}`);
  assert.ok(throughGap.position.x > .3, `Real rail gap crossing ${throughGap.position.x}`);
  assert.ok(hit.velocity.x < 10, `Fence impact speed ${hit.velocity.x}`);
  assertBodyFinite(hit);
  assertBodyFinite(throughGap);
  physics.dispose();
});

test('cylinders retain their round silhouette and orientation and spheres support contact', () => {
  const physics = createHayPhysics();
  physics.syncScenery([{ id: 'roller', objectId: 'conveyor', type: 'cylinder',
    position: [0, 1, 0], quaternion: rotation([0, 0, 1], Math.PI / 2),
    radiusTop: .3, radiusBottom: .3, height: 2, moving: false },
    { id: 'crown', objectId: 'plant', type: 'sphere', position: [2, .8, 0],
      quaternion: identityQuaternion, radius: .3, moving: false }]);
  const roller = placeStraw(physics, [0, 2, 0]);
  const roundGap = placeStraw(physics, [0, 2, .5]);
  const crown = placeStraw(physics, [2, 1.8, 0]);
  advance(physics, .6);
  assert.ok(roller.position.y > 1.29, `Horizontal cylinder top ${roller.position.y}`);
  assert.ok(roundGap.position.y < .7, `Open space outside cylinder ${roundGap.position.y}`);
  assert.ok(crown.position.y > 1.03, `Sphere contact ${crown.position.y}`);
  for (const body of [roller, roundGap, crown]) assertBodyFinite(body);
  physics.dispose();
});

test('moving parts carry bounded contact velocities, match their render pose, and wake resting hay', () => {
  const physics = createHayPhysics();
  const paddle = box('mill:blade', [-.5, .62, 0], [.1, .5, 1], identityQuaternion, true);
  physics.syncScenery([paddle]);
  const body = placeStraw(physics, [0, .38, 0]);
  advance(physics, 5);
  assert.equal(body.sleepState, 2);
  const initial = body.position.x;
  for (let frame = 1; frame <= 36; frame += 1) {
    paddle.position[0] = -.5 + frame * .02;
    paddle.quaternion = rotation([0, 1, 0], frame * .012);
    physics.syncScenery([paddle], 1 / 60);
    physics.step(1 / 60);
    const collider = physics.getSceneryBodies()[0];
    assert.deepEqual(collider.position.toArray(), paddle.position);
    for (let index = 0; index < 4; index += 1) assert.ok(Math.abs(collider.quaternion.toArray()[index] - paddle.quaternion[index]) < 1e-9);
    assert.ok(collider.velocity.length() <= 12.000001);
    assert.ok(collider.angularVelocity.length() <= 24.000001);
  }
  assert.ok(body.position.x > initial + .1, `Moving paddle displacement ${body.position.x - initial}`);
  assert.notEqual(body.sleepState, 2);
  assertBodyFinite(body);
  physics.dispose();
});

test('removed, hidden, invalid, and reset scenery cannot leave invisible colliders or stale support', () => {
  const physics = createHayPhysics();
  physics.syncScenery([box('drone:body', [0, 1, 0], [1, .1, 1], identityQuaternion, true)]);
  const body = placeStraw(physics, [0, 2, 0]);
  advance(physics, 5);
  assert.ok(body.position.y > 1.04);
  physics.syncScenery([]);
  assert.equal(physics.getSceneryStats().count, 0);
  advance(physics, 3);
  assert.ok(body.position.y < .52, `Removed support fall ${body.position.y}`);
  physics.syncScenery([box('bad', [NaN, 1, 0], [1, 1, 1]),
    box('valid', [2, 1, 0], [1, 1, 1])]);
  assert.equal(physics.getSceneryStats().count, 1);
  physics.reset();
  assert.equal(physics.getSceneryStats().count, 0);
  assert.equal(physics.getStats().activeBodies, 0);
  physics.syncScenery([box('valid', [2, 1, 0], [1, 1, 1])]);
  physics.dispose();
  physics.syncScenery([box('valid', [2, 1, 0], [1, 1, 1])]);
  assert.equal(physics.getSceneryStats().count, 0);
});


test('low-poly cone colliders use one apex and outward finite normals without degenerate cylinder faces', () => {
  const physics = createHayPhysics();
  physics.syncScenery([{ id: 'mill:cap', objectId: 'mill', type: 'cylinder',
    position: [0, 1.1, 0], quaternion: identityQuaternion,
    radiusTop: 0, radiusBottom: .7, height: .8, segments: 7, moving: false },
    { id: 'inverted-cone', objectId: 'test', type: 'cylinder',
      position: [3, 1, 0], quaternion: identityQuaternion,
      radiusTop: .3, radiusBottom: 0, height: .5, segments: 5, moving: false }]);
  const [cone, inverted] = physics.getSceneryBodies();
  assert.equal(cone.shapes[0].vertices.length, 8);
  assert.equal(inverted.shapes[0].vertices.length, 6);
  for (const collider of [cone, inverted]) for (const normal of collider.shapes[0].faceNormals) {
    assert.ok(Number.isFinite(normal.length()));
    assert.ok(normal.length() > .999 && normal.length() < 1.001);
  }
  const body = placeStraw(physics, [0, 2, 0]);
  advance(physics, .7);
  assert.ok(body.position.y > 1.2, `Cone contact height ${body.position.y}`);
  assert.ok(physics.getStats().collisions > 0);
  assertBodyFinite(body);
  physics.dispose();
});

test('a purely rotating blade pushes straw with angular contact velocity while paused poses stay still', () => {
  const physics = createHayPhysics();
  const blade = box('mill:rotating-blade', [0, .8, 0], [.08, 1, .3], identityQuaternion, true);
  physics.syncScenery([blade]);
  const body = placeStraw(physics, [.2, .38, 0]);
  advance(physics, 5);
  assert.equal(body.sleepState, 2);
  const initialX = body.position.x;
  for (let frame = 1; frame <= 45; frame += 1) {
    blade.quaternion = rotation([0, 0, 1], frame * .015);
    physics.syncScenery([blade], 1 / 60);
    const collider = physics.getSceneryBodies()[0];
    assert.ok(collider.velocity.length() < 1e-10);
    assert.ok(Math.abs(collider.angularVelocity.z - .9) < 1e-8);
    physics.step(1 / 60);
  }
  assert.ok(body.position.x > initialX + .08, `Rotating blade push ${body.position.x - initialX}`);
  physics.syncScenery([blade], 0);
  const collider = physics.getSceneryBodies()[0];
  assert.equal(collider.angularVelocity.length(), 0);
  assert.equal(collider.velocity.length(), 0);
  const pausedPosition = collider.position.toArray();
  const pausedRotation = collider.quaternion.toArray();
  physics.step(1 / 60);
  assert.deepEqual(collider.position.toArray(), pausedPosition);
  assert.deepEqual(collider.quaternion.toArray(), pausedRotation);
  assertBodyFinite(body);
  physics.dispose();
});
