// ============================================================================
// KARTVERSE — Track Clearance & Boundary Validator
// Validates Road Corridor Clearance: (roadWidth / 2 + 6.0m) Strictly Free
// Enforces zero solid mountain/rock/tree intersections with the racing surface
// ============================================================================

import * as THREE from 'three';

export interface ClearanceViolation {
  sampleIndex: number;
  t: number;
  trackPosition: THREE.Vector3;
  obstacleName: string;
  obstaclePosition: THREE.Vector3;
  distance: number;
  requiredClearance: number;
}

export class TrackValidator {
  public static validateTrackCorridor(
    curve: THREE.CatmullRomCurve3,
    roadWidth: number,
    solidObstacles: { name: string; position: THREE.Vector3; radius: number; isTunnel?: boolean }[],
    samples = 500
  ): { passed: boolean; violations: ClearanceViolation[]; minClearanceFound: number } {
    const requiredMargin = 6.0; // 6 meters clearance beyond road edge
    const minRequiredDistance = roadWidth / 2 + requiredMargin; // e.g. 14.0 meters
    const violations: ClearanceViolation[] = [];
    let minClearanceFound = Infinity;

    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const trackPoint = curve.getPointAt(t);

      for (const obstacle of solidObstacles) {
        if (obstacle.isTunnel) continue; // Tunnels are permitted to enclose the road

        // Calculate 2D horizontal distance (X-Z plane) from track point to obstacle
        const dx = obstacle.position.x - trackPoint.x;
        const dz = obstacle.position.z - trackPoint.z;
        const centerDist = Math.sqrt(dx * dx + dz * dz);
        
        // Edge-to-center distance accounting for obstacle radius
        const surfaceDistance = centerDist - obstacle.radius;
        minClearanceFound = Math.min(minClearanceFound, surfaceDistance);

        if (surfaceDistance < minRequiredDistance) {
          violations.push({
            sampleIndex: i,
            t,
            trackPosition: trackPoint.clone(),
            obstacleName: obstacle.name,
            obstaclePosition: obstacle.position.clone(),
            distance: surfaceDistance,
            requiredClearance: minRequiredDistance
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      minClearanceFound
    };
  }
}

