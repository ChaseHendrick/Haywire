import * as CANNON from './vendor/cannon-es.js';

export const MAX_HAY_BODIES = 160;
const GROUND_Y = 0.35;
const FIXED_STEP = 1 / 60;
const HALF_STRAW = new CANNON.Vec3(0.022, 0.022, 0.16);
const MASS = 0.035;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

/** Loose hay is simulated independently of the persistent search economy. */
export function createHayPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0), allowSleep: true });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 12;
  world.solver.tolerance = 0.001;
  const strawMaterial = new CANNON.Material('loose hay');
  const terrainMaterial = new CANNON.Material('farm floor');
  world.addContactMaterial(new CANNON.ContactMaterial(strawMaterial, terrainMaterial, {
    friction: 0.58, restitution: 0.015, contactEquationStiffness: 1e7, contactEquationRelaxation: 4,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(strawMaterial, strawMaterial, {
    friction: 0.4, restitution: 0.025, contactEquationStiffness: 1e7, contactEquationRelaxation: 4,
  }));
  world.defaultContactMaterial.friction = 0.58;
  world.defaultContactMaterial.restitution = 0.015;

  const bodies = [];
  const terrain = [];
  let identity = null;
  let cols = 0;
  let rows = 0;
  let unit = 0.565;
  let elapsed = 0;
  let collisions = 0;
  let disposed = false;
  let randomState = 0x48415957;

  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }

  function staticBox(x, y, z, width, height, depth) {
    const body = new CANNON.Body({ mass: 0, material: terrainMaterial,
      position: new CANNON.Vec3(x, y, z),
      shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)) });
    world.addBody(body);
    return body;
  }

  const ground = new CANNON.Body({ mass: 0, material: terrainMaterial, shape: new CANNON.Plane() });
  ground.position.y = GROUND_Y;
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);
  // Low farm boundaries contain straw without changing the visible search board.
  staticBox(-6.55, 1.35, 0, 0.12, 2, 10.2);
  staticBox(6.55, 1.35, 0, 0.12, 2, 10.2);
  staticBox(0, 1.35, -5.05, 13.2, 2, 0.12);
  staticBox(0, 1.35, 5.05, 13.2, 2, 0.12);
  staticBox(3.9, 0.97, -3.35, 1.65, 1.38, 1.35);
  staticBox(3.72, 0.66, 3.38, 0.65, 0.62, 0.62);

  function removeLoose(body) {
    body.removeEventListener('collide', body.hayCollisionListener);
    world.removeBody(body);
  }

  function reset() {
    for (const body of bodies) removeLoose(body);
    bodies.length = 0;
    for (const tile of terrain) if (tile?.body) world.removeBody(tile.body);
    terrain.length = 0;
    identity = null;
    cols = 0;
    rows = 0;
    elapsed = 0;
    collisions = 0;
    // Reset the accumulator so a fresh field cannot inherit a partial frame.
    world.accumulator = 0;
    world.broadphase.dirty = true;
  }

  function syncField(state, requestedUnit = unit) {
    if (disposed || !state?.field) return;
    const field = state.field;
    const nextCols = Math.floor(finite(field.cols, 0));
    const nextRows = Math.floor(finite(field.rows, 0));
    if (nextCols < 1 || nextRows < 1 || nextCols * nextRows > 2000 || !Array.isArray(field.cells)) return;
    const nextUnit = clamp(finite(requestedUnit, 0.565), 0.05, 2);
    const nextIdentity = `${state.seed}:${field.generationSeed??state.seed}:${state.contractIndex}:${nextCols}:${nextRows}:${nextUnit}`;
    if (identity !== nextIdentity) {
      reset();
      identity = nextIdentity;
      cols = nextCols;
      rows = nextRows;
      unit = nextUnit;
      randomState = Number.isFinite(state.seed) ? state.seed >>> 0 : 0x48415957;
    }
    for (let index = 0; index < cols * rows; index += 1) {
      const cell = field.cells[index];
      const maxDepth = Math.max(0, finite(cell?.maxDepth, 0));
      const depth = Math.max(0, finite(cell?.depth, 0));
      const ratio = maxDepth > 0 ? clamp(depth / maxDepth, 0, 1) : 0;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = (col - (cols - 1) / 2) * unit;
      const z = (row - (rows - 1) / 2) * unit + 0.15;
      const mound = 1.12 - 0.4 * Math.hypot((col - cols / 2) / cols, (row - rows / 2) / rows);
      const top = ratio > 0.002 ? 0.36 + ratio * mound : GROUND_Y;
      const previous = terrain[index];
      if (previous && Math.abs(previous.top - top) < 0.000001) continue;
      if (previous?.body) world.removeBody(previous.body);
      const height = top - GROUND_Y;
      terrain[index] = { x, z, top, body: height > 0.005
        ? staticBox(x, GROUND_Y + height / 2, z, unit, height, unit) : null };
      // A resting straw must fall when its supporting pile is cleared.
      for (const body of bodies) {
        if (Math.abs(body.position.x - x) < unit / 2 + 0.2 && Math.abs(body.position.z - z) < unit / 2 + 0.2) body.wakeUp();
      }
    }
    world.broadphase.dirty = true;
  }

  function pileTop(x, z) {
    if (!cols || !rows) return GROUND_Y;
    const col = Math.round(x / unit + (cols - 1) / 2);
    const row = Math.round((z - 0.15) / unit + (rows - 1) / 2);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return GROUND_Y;
    return terrain[row * cols + col]?.top ?? GROUND_Y;
  }

  function emit(x, z, tool = 'rake', amount = 8, height = 1.4) {
    if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return;
    x = clamp(x, -6.1, 6.1);
    z = clamp(z, -4.6, 4.6);
    const count = Math.floor(clamp(finite(amount, 8), 0, MAX_HAY_BODIES));
    for (let index = 0; index < count; index += 1) {
      if (bodies.length >= MAX_HAY_BODIES) {
        // Even a fast sweep leaves its oldest settled pieces visible for three seconds.
        if (elapsed - bodies[0].hayBornAt < 3) break;
        removeLoose(bodies.shift());
      }
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * Math.min(0.28, unit * 0.48);
      const px = x + Math.cos(angle) * distance;
      const pz = z + Math.sin(angle) * distance;
      const py = Math.max(clamp(finite(height, 1.4), 0.4, 3), pileTop(px, pz) + 0.15) + random() * 0.09;
      const body = new CANNON.Body({ mass: MASS, material: strawMaterial,
        shape: new CANNON.Box(HALF_STRAW.clone()), position: new CANNON.Vec3(px, py, pz),
        linearDamping: 0.2, angularDamping: 0.46, allowSleep: true,
        sleepSpeedLimit: 0.24, sleepTimeLimit: 1.15 });
      body.quaternion.setFromEuler((random() - 0.5) * 0.6, random() * Math.PI * 2, (random() - 0.5) * 0.35);
      body.angularVelocity.set((random() - 0.5) * 3, (random() - 0.5) * 4, (random() - 0.5) * 3);
      body.hayBornAt = elapsed;
      body.hayRestTime = 0;
      body.hayCollisionListener = (event) => {
        // Count each new contact once rather than double-counting straw pairs.
        if (event.body.mass === 0 || body.id < event.body.id) collisions += 1;
      };
      body.addEventListener('collide', body.hayCollisionListener);
      world.addBody(body);
      bodies.push(body);
      let vx;
      let vy;
      let vz;
      if (tool === 'vacuum') {
        const dx = 4.65 - px;
        const dz = 1.95 - pz;
        const length = Math.max(0.01, Math.hypot(dx, dz));
        vx = dx / length * 1.65;
        vz = dz / length * 1.65;
        vy = 0.15;
        body.angularVelocity.y *= 2;
      } else if (tool === 'magnet') {
        vx = Math.cos(angle) * 0.28;
        vz = Math.sin(angle) * 0.28;
        vy = 0.08;
        body.angularVelocity.scale(0.45, body.angularVelocity);
      } else {
        vx = Math.cos(angle) * (0.65 + random() * 0.35);
        vz = Math.sin(angle) * (0.65 + random() * 0.35);
        vy = 0.2 + random() * 0.2;
      }
      body.applyImpulse(new CANNON.Vec3(vx * MASS, vy * MASS, vz * MASS), new CANNON.Vec3());
    }
  }

  function stir(x, z, tool = 'rake', radius = 0.8, dt = 0.08) {
    if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const reach = clamp(finite(radius, 0.8), 0.08, 3);
    const frame = clamp(finite(dt, 0.08), 0, 0.12);
    if (frame === 0) return;
    const nozzleY = Math.max(1.35, pileTop(x, z) + 0.4);
    for (const body of bodies) {
      const dx = body.position.x - x;
      const dz = body.position.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance > reach) continue;
      const angle = distance > 0.01 ? Math.atan2(dz, dx) : random() * Math.PI * 2;
      const ox = Math.cos(angle);
      const oz = Math.sin(angle);
      const strength = 0.35 + 0.65 * (1 - distance / reach);
      let ax;
      let ay;
      let az;
      if (tool === 'vacuum') {
        const beltLength = Math.max(0.01, Math.hypot(4.65 - body.position.x, 1.95 - body.position.z));
        ax = -ox * 6 + (4.65 - body.position.x) / beltLength * 1.2;
        az = -oz * 6 + (1.95 - body.position.z) / beltLength * 1.2;
        ay = clamp((nozzleY - body.position.y) * 4, -1.2, 4.2);
      } else if (tool === 'magnet') {
        ax = ox * 1.5;
        az = oz * 1.5;
        ay = 0.45;
      } else if (tool === 'cutter') {
        ax = -oz * 4 + ox * 0.6;
        az = ox * 4 + oz * 0.6;
        ay = 0.6;
      } else {
        ax = ox * 6;
        az = oz * 6;
        ay = 1.25;
      }
      body.wakeUp();
      body.hayRestTime = 0;
      const impulseScale = MASS * frame * strength;
      // A small off-center impulse produces real torque as well as translation.
      body.applyImpulse(new CANNON.Vec3(ax * impulseScale, ay * impulseScale, az * impulseScale),
        new CANNON.Vec3(0.007, 0, tool === 'magnet' ? 0.008 : 0.025));
    }
  }

  function step(dt) {
    if (disposed || !Number.isFinite(dt) || dt <= 0) return;
    const frame = Math.min(dt, 0.05);
    elapsed += frame;
    world.step(FIXED_STEP, frame, 3);
    const touching = new Set();
    for (const contact of world.contacts) {
      touching.add(contact.bi.id);
      touching.add(contact.bj.id);
    }
    // Bounds are a final guard against numerical tunneling after a long or overloaded frame.
    for (const body of bodies) {
      if (!Number.isFinite(body.position.x + body.position.y + body.position.z)) {
        body.position.set(0, GROUND_Y + 0.18, 0);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.quaternion.set(0, 0, 0, 1);
        body.wakeUp();
      }
      if (Math.abs(body.position.x) > 6.4 || Math.abs(body.position.z) > 4.9) {
        body.position.x = clamp(body.position.x, -6.4, 6.4);
        body.position.z = clamp(body.position.z, -4.9, 4.9);
        body.velocity.x *= -0.15;
        body.velocity.z *= -0.15;
        body.aabbNeedsUpdate = true;
      }
      if (body.position.y < GROUND_Y - 0.1) {
        body.position.y = GROUND_Y + 0.03;
        body.velocity.y = Math.max(0, body.velocity.y);
        body.aabbNeedsUpdate = true;
      }
      // Thin box contacts can retain tiny angular solver oscillations. Stabilize
      // only collision-supported bodies with low linear and endpoint speeds.
      if (body.sleepState !== CANNON.Body.SLEEPING && touching.has(body.id)
          && body.velocity.length() < 0.15 && body.angularVelocity.length() * 0.16 < 0.16) {
        body.hayRestTime += frame;
        if (body.hayRestTime >= 1.15) body.sleep();
      } else body.hayRestTime = 0;
    }
  }

  function getStats() {
    return { activeBodies: bodies.length,
      sleepingBodies: bodies.filter((body) => body.sleepState === CANNON.Body.SLEEPING).length,
      collisions, maxBodies: MAX_HAY_BODIES,
      samples: bodies.slice(0, 5).map((body) => ({
        position: { x: body.position.x, y: body.position.y, z: body.position.z },
        velocity: { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z },
      })) };
  }

  function dispose() {
    if (disposed) return;
    reset();
    for (const body of [...world.bodies]) world.removeBody(body);
    disposed = true;
  }

  return { syncField, emit, stir, step, getBodies: () => bodies.slice(), reset, getStats, dispose };
}
