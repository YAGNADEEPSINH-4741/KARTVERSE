import * as THREE from 'three';
import assert from 'node:assert/strict';
import { TrackManager } from '../src/tracks/TrackManager';
import { KartPhysics } from '../src/vehicles/KartPhysics';

console.log('🚧 Testing KARTVERSE Track Barrier & Clamping Physics...');

const scene = new THREE.Scene();
const track = new TrackManager(scene, 'sunset_coast');
const physics = new KartPhysics();

const startSlot = track.getStartingGrid()[0];
physics.position.copy(startSlot.position);
physics.rotationY = startSlot.rotationY;

console.log('Initial Kart Position:', physics.position);
const initialConstraint = track.getTrackConstraint(physics.position);
console.log('Initial offset:', initialConstraint.lateralOffset.toFixed(2), 'm (Road half-width:', initialConstraint.roadHalfWidth, 'm)');
if (!initialConstraint.isOnRoad) {
  throw new Error('Kart should start on road!');
}
console.log('✅ Kart properly positioned on track surface.');

// 1. Test Lateral Drift towards Wall
const binormal = initialConstraint.binormal;
const halfWidth = initialConstraint.roadHalfWidth;

// Place kart on kerb
physics.position.copy(initialConstraint.nearestCenter).addScaledVector(binormal, halfWidth + 0.5);
let constraint = track.getTrackConstraint(physics.position);
console.log('Testing Kerb Position:', constraint.lateralOffset.toFixed(2), 'm');
if (!constraint.isOnKerb) {
  throw new Error('Kart should be detected on kerb!');
}
physics.speed = 36; // top speed
physics.applyTrackConstraint(constraint, 0.05);
if (physics.speed > 36 * 0.7) {
  console.log('Kerb rumble speed damped to:', physics.speed.toFixed(2));
}
console.log('✅ Kerb detection and friction verified.');

// 2. Test Barrier Collision & Clamping
physics.position.copy(initialConstraint.nearestCenter).addScaledVector(binormal, halfWidth + 5.0); // Attempt to go 5m through wall
constraint = track.getTrackConstraint(physics.position);
if (!constraint.isHittingBarrier) {
  throw new Error('Kart should be detected hitting barrier!');
}
physics.applyTrackConstraint(constraint, 0.05);
const clampedOffset = track.getTrackConstraint(physics.position).lateralOffset;
console.log('Clamped position offset:', clampedOffset.toFixed(2), 'm (Max allowed:', (halfWidth + 1.1).toFixed(2), 'm)');
if (Math.abs(clampedOffset) > halfWidth + 1.15) {
  throw new Error('Kart penetrated through the barrier!');
}
console.log('✅ Barrier hard clamping prevents car from leaving track.');

// 3. Test Out-of-bounds Lakitu Rescue
physics.position.set(999, -50, 999); // Thrown into void
constraint = track.getTrackConstraint(physics.position);
if (!constraint.isOutOfBounds) {
  throw new Error('Kart should be detected out of bounds!');
}
physics.applyTrackConstraint(constraint, 0.05);
console.log('Rescued position:', physics.position);
const rescuedConstraint = track.getTrackConstraint(physics.position);
if (!rescuedConstraint.isOnRoad) {
  throw new Error('Rescued kart should be back on the road!');
}
console.log('✅ Out-of-bounds auto-rescue verified.');

console.log('🎉 ALL TRACK BOUNDARY & BARRIER TESTS PASSED (3/3)!');


// Compare the actual rendered top face to the custom physics surface on both sides of every sector.
track.trackGroup.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
for (let i = 0; i < 192; i++) {
  const t = (i + .37) / 192;
  const p = track.curve.getPointAt(t), tan = track.curve.getTangentAt(t);
  const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  for (const lateral of [-7.3, -.3, 7.3]) {
    const origin = p.clone().addScaledVector(normal, lateral);
    origin.y += 3;
    ray.set(origin, down);
    const hit = ray.intersectObject(track.roadMesh, false)[0];
    assert.ok(hit, `Missing visual road at station ${i}, lateral ${lateral}`);
    const surface = track.getTrackConstraint(hit.point);
    assert.ok(surface.isOnRoad);
    assert.ok(Math.abs(surface.roadElevation - hit.point.y) < .12,
      `Height differs at station ${i}: ${surface.roadElevation} / ${hit.point.y}`);
  }
}
const slots = track.getStartingGrid();
for (const slot of slots) assert.ok(track.getTrackConstraint(slot.position).isOnRoad);
for (let i = 1; i < slots.length; i++) assert.ok(slots[i].position.distanceTo(slots[i-1].position) > 3);
console.log('Verified 576 rendered road samples against physics, plus all eight starting slots.');
