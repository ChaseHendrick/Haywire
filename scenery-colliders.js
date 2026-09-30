import * as THREE from './vendor/three.module.js';

/** Derive solid farm parts from the same geometry and transforms that are drawn. */
export function createSceneryColliderRegistry() {
  const roots = [];
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let meshes = [];

  function add(objectId, object, moving = false) {
    roots.push({ objectId, object, moving });
    return object;
  }

  function visible(object) {
    for (let current = object; current; current = current.parent) {
      if (!current.visible) return false;
    }
    return true;
  }

  function collect() {
    const descriptors = [];
    meshes = [];
    for (const root of roots) {
      if (!visible(root.object)) continue;
      root.object.updateWorldMatrix(true, true);
      root.object.traverseVisible((mesh) => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry;
        const parameters = geometry?.parameters;
        if (!parameters) return;
        mesh.matrixWorld.decompose(position, quaternion, scale);
        const sx = Math.abs(scale.x), sy = Math.abs(scale.y), sz = Math.abs(scale.z);
        const descriptor = {
          id: mesh.uuid, objectId: root.objectId, moving: root.moving,
          position: position.toArray(), quaternion: quaternion.toArray(),
        };
        if (geometry.type === 'BoxGeometry') {
          descriptor.type = 'box';
          descriptor.size = [parameters.width * sx, parameters.height * sy, parameters.depth * sz];
        } else if (geometry.type === 'CylinderGeometry' || geometry.type === 'ConeGeometry') {
          descriptor.type = 'cylinder';
          descriptor.radiusTop = (parameters.radiusTop ?? 0) * Math.max(sx, sz);
          descriptor.radiusBottom = (parameters.radiusBottom ?? parameters.radius) * Math.max(sx, sz);
          descriptor.height = parameters.height * sy;
          descriptor.segments = parameters.radialSegments;
        } else if (geometry.type === 'SphereGeometry') {
          descriptor.type = 'sphere';
          descriptor.radius = parameters.radius * Math.max(sx, sy, sz);
        } else return;
        descriptors.push(descriptor);
        meshes.push(mesh);
      });
    }
    return descriptors;
  }

  return { add, collect, getMeshes: () => meshes.filter(visible) };
}
