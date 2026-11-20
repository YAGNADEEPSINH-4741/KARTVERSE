// ============================================================================
// KARTVERSE — AI Racing Line & Spline Navigation Path
// ============================================================================

import * as THREE from 'three';

export interface Waypoint {
  index: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  curvature: number; // Curvature intensity to plan braking/drifting
  roadWidth: number;
}

export class RacingPath {
  public curve: THREE.CatmullRomCurve3;
  public waypoints: Waypoint[] = [];
  public totalLength: number;
  public segmentCount = 200;

  constructor(curve: THREE.CatmullRomCurve3, roadWidth = 16.0) {
    this.curve = curve;
    this.totalLength = curve.getLength();
    this.generateWaypoints(roadWidth);
  }

  private generateWaypoints(roadWidth: number): void {
    this.waypoints = [];
    const step = 1 / this.segmentCount;

    for (let i = 0; i < this.segmentCount; i++) {
      const t = i * step;
      const tNext = ((i + 1) % this.segmentCount) * step;
      const tPrev = ((i - 1 + this.segmentCount) % this.segmentCount) * step;

      const pos = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();

      const tangentPrev = this.curve.getTangentAt(tPrev).normalize();
      const tangentNext = this.curve.getTangentAt(tNext).normalize();

      // Measure angle change between tangent vectors to gauge curvature
      const angleDelta = tangentPrev.angleTo(tangentNext);
      const curvature = Math.sin(angleDelta);

      this.waypoints.push({
        index: i,
        position: pos,
        tangent,
        curvature,
        roadWidth
      });
    }
  }

  // Find nearest waypoint index to a given 3D position
  public getClosestWaypointIndex(position: THREE.Vector3): number {
    let bestDistSq = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < this.waypoints.length; i++) {
      const distSq = position.distanceToSquared(this.waypoints[i].position);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  // Look ahead along the path curve for steering target
  public getTargetPosition(currentPos: THREE.Vector3, lookAheadUnits = 4, lateralOffset = 0, closestIdx = this.getClosestWaypointIndex(currentPos)): THREE.Vector3 {
    const targetIdx = (closestIdx + lookAheadUnits) % this.waypoints.length;
    const wp = this.waypoints[targetIdx];

    const up = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(wp.tangent, up).normalize();

    // Offset across lane (e.g. inside apex on sharp turns)
    const target = wp.position.clone().addScaledVector(binormal, lateralOffset);
    return target;
  }
}

