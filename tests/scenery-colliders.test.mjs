import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createSceneryColliderRegistry } from '../scenery-colliders.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const box = (width, height, depth) => new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));

test('nested crate bands use the rendered parent position, rotation and pulse scale', () => {
  const registry = createSceneryColliderRegistry();
  const crate = box(.5, .5, .5);
  crate.position.set(3.72, 1.04, 3.38);
  crate.rotation.y = Math.PI / 2;
  crate.scale.setScalar(1.06);
  const band = box(.52, .07, .53);
  band.position.set(.1, .1, 0);
  crate.add(band);
  registry.add('crates', crate);
  const descriptors = registry.collect();
  assert.equal(descriptors.length, 2);
  const body = descriptors.find(part => part.id === crate.uuid);
  const trim = descriptors.find(part => part.id === band.uuid);
  near(body.size[0], .53);
  near(trim.position[0], 3.72);
  near(trim.position[1], 1.146);
  near(trim.position[2], 3.274);
  near(trim.size[0], .5512);
  near(trim.quaternion[1], Math.SQRT1_2);
  assert.equal(trim.objectId, 'crates');
});

test('sloped roofs retain their local angle under a transformed barn', () => {
  const registry = createSceneryColliderRegistry(), barn = new THREE.Group();
  barn.position.set(3.9, .28, -3.35);
  const roof = box(1.95, .18, 1.15);
  roof.position.set(0, 1.63, -.35);
  roof.rotation.x = -.6;
  barn.add(roof);registry.add('barn', barn);
  const [part] = registry.collect();
  near(part.position[1], 1.91);
  near(part.position[2], -3.7);
  near(part.quaternion[0], Math.sin(-.3));
  near(part.quaternion[3], Math.cos(-.3));
  [1.95, .18, 1.15].forEach((expected, index) => near(part.size[index], expected));
});

test('tower, cone and hub preserve their actual shape dimensions', () => {
  const registry = createSceneryColliderRegistry(), mill = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(.29, .49, 2.25, 7));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.5, .55, 7));
  const hub = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8));
  mill.add(tower, cap, hub);registry.add('windmill', mill);
  const parts = registry.collect();
  assert.equal(parts[0].type, 'cylinder');
  assert.equal(parts[0].radiusTop, .29);assert.equal(parts[0].radiusBottom, .49);
  assert.equal(parts[1].radiusTop, 0);assert.equal(parts[1].radiusBottom, .5);
  assert.equal(parts[1].height, .55);
  assert.equal(parts[0].segments, 7);assert.equal(parts[1].segments, 7);
  assert.equal(parts[2].type, 'sphere');assert.equal(parts[2].radius, .17);
});

test('moving parts update without stale poses and hidden ancestors remove collision and ray targets', () => {
  const registry = createSceneryColliderRegistry(), parent = new THREE.Group(), drone = new THREE.Group();
  drone.add(box(.42, .18, .34));parent.add(drone);registry.add('drone', drone, true);
  const [first] = registry.collect();
  drone.position.x = 2;drone.rotation.y = .7;
  const [next] = registry.collect();
  assert.equal(next.id, first.id);assert.equal(next.moving, true);
  near(next.position[0], 2);near(next.quaternion[1], Math.sin(.35));
  assert.deepEqual(first.position, [0, 0, 0], 'Snapshots do not change after collection');
  parent.visible = false;
  assert.deepEqual(registry.getMeshes(), []);
  assert.deepEqual(registry.collect(), []);
  parent.visible = true;assert.equal(registry.collect().length, 1);
  drone.children[0].visible = false;
  assert.deepEqual(registry.collect(), []);
});

test('collision ray targets include solid children and omit decorative helper geometry', () => {
  const registry = createSceneryColliderRegistry(), object = new THREE.Group();
  const solid = box(1, 1, 1), helper = new THREE.Mesh(new THREE.RingGeometry(.82, 1));
  object.add(solid, helper);registry.add('farm', object);
  assert.equal(registry.collect().length, 1);
  assert.deepEqual(registry.getMeshes(), [solid]);
});
