// ============================================================================
// KARTVERSE — High-Fidelity 3D Arcade Kart Model Factory
// Inspired by AAA Arcade Racers: Jet Thrusters, High-Aero Spoilers,
// Visible Racer Character with Goggles, Chrome Rims & Neon Underglow
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type BodySection = [z: number, halfWidth: number, top: number];

interface BodyStyle {
  hood: BodySection[];
  podHeight: number;
  wingHeight: number;
  wingWidth: number;
  wingDepth: number;
}

// All body kits fit the same axle spacing and wheel envelope.
const BODY_STYLES: Record<string, BodyStyle> = {
  speed_demon: { hood: [[0.20, 0.44, 0.67], [0.65, 0.37, 0.60], [1.17, 0.25, 0.43], [1.52, 0.19, 0.35]], podHeight: 0.45, wingHeight: 0.98, wingWidth: 1.75, wingDepth: 0.32 },
  cyber_glider: { hood: [[0.20, 0.43, 0.58], [0.54, 0.55, 0.55], [1.06, 0.40, 0.47], [1.48, 0.15, 0.34]], podHeight: 0.38, wingHeight: 0.80, wingWidth: 1.88, wingDepth: 0.41 },
  vortex_striker: { hood: [[0.20, 0.55, 0.73], [0.66, 0.57, 0.72], [1.18, 0.56, 0.59], [1.42, 0.46, 0.53]], podHeight: 0.59, wingHeight: 1.07, wingWidth: 1.49, wingDepth: 0.50 },
  quantum_leap: { hood: [[0.20, 0.35, 0.66], [0.58, 0.33, 0.58], [1.07, 0.24, 0.39], [1.46, 0.21, 0.32]], podHeight: 0.51, wingHeight: 0.85, wingWidth: 1.69, wingDepth: 0.48 },
  hyper_drift: { hood: [[0.20, 0.52, 0.66], [0.40, 0.56, 0.61], [1.04, 0.57, 0.52], [1.42, 0.54, 0.46]], podHeight: 0.47, wingHeight: 0.70, wingWidth: 1.82, wingDepth: 0.29 },
  shadow_phantom: { hood: [[0.20, 0.47, 0.68], [0.48, 0.63, 0.65], [1.01, 0.44, 0.49], [1.54, 0.055, 0.32]], podHeight: 0.40, wingHeight: 0.86, wingWidth: 1.57, wingDepth: 0.50 }
};

// Loft chamfered cross sections along the kart's forward axis.
function bodywork(sections: BodySection[], bottom: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  sections.forEach(([z, width, top], index) => {
    const bevel = Math.min(0.09, width * 0.25, (top - bottom) * 0.34);
    const section = [
      [-width + bevel, bottom], [width - bevel, bottom], [width, bottom + bevel],
      [width, top - bevel], [width - bevel, top], [-width + bevel, top],
      [-width, top - bevel], [-width, bottom + bevel]
    ];
    section.forEach(([x, y]) => vertices.push(x, y, z));
    const start = index * 8;
    if (index > 0) {
      for (let edge = 0; edge < 8; edge++) {
        const a = start - 8 + edge;
        const b = start - 8 + (edge + 1) % 8;
        indices.push(a, b, b + 8, a, b + 8, a + 8);
      }
    }
    if (index === 0 || index === sections.length - 1) {
      for (let edge = 1; edge < 7; edge++) {
        if (index === 0) indices.push(start, start + edge + 1, start + edge);
        else indices.push(start, start + edge, start + edge + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Fixed parts share draw calls. Steering, rolling wheels and animated effects
// keep their own transforms so local and networked animation still work.
function batchBody(root: THREE.Group, movingParts: Set<THREE.Object3D>) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.updateMatrixWorld(true);
  for (const part of [...root.children]) {
    if (movingParts.has(part)) continue;
    part.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
      geometry.deleteAttribute('uv'); // All chassis materials use a solid color.
      if (!geometry.index) {
        geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, index) => index));
      }
      child.geometry.dispose();
      const group = buckets.get(child.material) ?? [];
      group.push(geometry);
      buckets.set(child.material, group);
    });
    root.remove(part);
  }
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries);
    root.add(new THREE.Mesh(merged, material));
    geometries.forEach(geometry => geometry.dispose());
  }
}

export interface KartVisual {
  root: THREE.Group;
  group: THREE.Group; // alias for root
  bodyMesh: THREE.Mesh;
  wheels: THREE.Mesh[]; // [FL, FR, RL, RR]
  exhausts: THREE.Vector3[];
  driftSparks: THREE.Mesh[];
  boostFlames: THREE.Mesh[];
  shadowDisc: THREE.Mesh;
}

export class KartModelFactory {
  public static createKart(kartId: string, customColor = '#00d2ff'): KartVisual {
    const root = new THREE.Group();
    const wheels: THREE.Mesh[] = [];
    const exhausts: THREE.Vector3[] = [];

    const primaryColor = new THREE.Color(customColor);
    const style = Object.prototype.hasOwnProperty.call(BODY_STYLES, kartId) ? BODY_STYLES[kartId] : BODY_STYLES.speed_demon;

    // High-gloss automotive paint material with subtle self-fill to ensure kart never goes dark
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      metalness: 0.32,
      roughness: 0.30,
      emissive: primaryColor,
      emissiveIntensity: 0.09
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x0c1524,
      metalness: 0.8,
      roughness: 0.4
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.60,
      roughness: 0.29
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x090e17,
      roughness: 0.92,
      metalness: 0.1
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.15
    });

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xdb502a,
      metalness: 0.6,
      roughness: 0.3
    });

    const neonCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    const taillightMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b // High-visibility Amber Race Light
    });

    // ------------------------------------------------------------------------
    // 1. MAIN CHASSIS & AERODYNAMIC BODYWORK
    // ------------------------------------------------------------------------
    const mainBody = new THREE.Mesh(bodywork([[-1.17, 0.55, 0.47], [-0.88, 0.64, 0.54], [0.18, 0.59, 0.48], [1.27, 0.28, 0.30]], 0.21), carbonMat);
    root.add(mainBody);

    // Low-slung Front Splitter (Nosecone)
    const noseGeom = bodywork([[0.90, 0.54, 0.25], [1.23, 0.71, 0.26], [1.53, 0.65, 0.23]], 0.16);
    const nose = new THREE.Mesh(noseGeom, carbonMat);
    root.add(nose);

    // Front Aerodynamic Hood Scoop
    const hood = new THREE.Mesh(bodywork(style.hood, 0.27), bodyMat);
    root.add(hood);

    // A single warm ivory stripe follows the hood slope and stays visible at race distance.
    const stripe = new THREE.MeshStandardMaterial({ color: 0xffe6b7, roughness: 0.40 });
    const stripeVertices = style.hood.flatMap(([z, halfWidth, y]) => {
      const w = halfWidth * 0.16;
      return [-w, y + 0.003, z, w, y + 0.003, z];
    });
    const stripeGeometry = new THREE.BufferGeometry();
    stripeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stripeVertices, 3));
    stripeGeometry.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 4, 6, 5, 5, 6, 7]);
    stripeGeometry.computeVertexNormals();
    root.add(new THREE.Mesh(stripeGeometry, stripe));

    // Side Air Intake Pods
    [-0.68, 0.68].forEach(x => {
      const podGeom = bodywork([[-0.87, 0.12, style.podHeight], [-0.54, 0.18, style.podHeight + 0.08], [0.30, 0.17, style.podHeight + 0.06], [0.60, 0.13, style.podHeight - 0.02]], 0.24);
      const pod = new THREE.Mesh(podGeom, bodyMat);
      pod.position.x = x;
      root.add(pod);

      // Black intake vents on each pod
      const ventGeom = new THREE.BoxGeometry(0.20, 0.075, 0.02);
      const vent = new THREE.Mesh(ventGeom, carbonMat);
      vent.position.set(x, style.podHeight - 0.08, 0.61);
      root.add(vent);
    });

    // Rear Aero Diffuser with vertical fins
    const diffuserGeom = new THREE.BoxGeometry(1.3, 0.12, 0.45);
    const diffuser = new THREE.Mesh(diffuserGeom, carbonMat);
    diffuser.position.set(0, 0.22, -1.15);
    root.add(diffuser);

    [-0.45, -0.15, 0.15, 0.45].forEach(fx => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.4), carbonMat);
      fin.position.set(fx, 0.24, -1.15);
      root.add(fin);
    });

    // ------------------------------------------------------------------------
    // 2. HIGH-AERO SPORTS REAR WING (SPOILER) & ILLUMINATED 'K' LOGO
    // ------------------------------------------------------------------------
    // Elevated wing struts
    [-0.55, 0.55].forEach(sx => {
      const strutHeight = style.wingHeight - 0.42;
      const strutGeom = new THREE.BoxGeometry(0.06, strutHeight, 0.15);
      const strut = new THREE.Mesh(strutGeom, carbonMat);
      strut.position.set(sx, 0.42 + strutHeight / 2, -1.02);
      strut.rotation.x = -0.13;
      root.add(strut);
    });

    // Main spoiler blade
    const wingGeom = new THREE.BoxGeometry(style.wingWidth, 0.07, style.wingDepth);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(0, style.wingHeight, -1.06);
    wing.rotation.x = 0.10;
    root.add(wing);

    // Vertical wing endplates
    [-style.wingWidth / 2, style.wingWidth / 2].forEach(ex => {
      const endplateGeom = new THREE.BoxGeometry(0.05, 0.20, style.wingDepth + 0.06);
      const endplate = new THREE.Mesh(endplateGeom, carbonMat);
      endplate.position.set(ex, style.wingHeight, -1.06);
      root.add(endplate);
    });

    // Body-kit signatures stay inside the shared footprint.
    for (const side of [-1, 1]) {
      if (kartId === 'cyber_glider' || kartId === 'shadow_phantom') {
        const fin = new THREE.Mesh(bodywork([[-1.24, 0.04, 0.97], [-0.81, 0.06, 0.76], [-0.35, 0.05, 0.56]], 0.48), carbonMat);
        fin.position.x = side * 0.52;
        fin.rotation.z = side * (kartId === 'cyber_glider' ? -0.29 : 0.18);
        root.add(fin);
      }
      if (kartId === 'vortex_striker' || kartId === 'hyper_drift') {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.035), stripe);
        lamp.position.set(side * 0.34, style.hood[3][2] - 0.07, style.hood[3][0] + 0.01);
        root.add(lamp);
      }
      if (kartId === 'quantum_leap') {
        const arch = new THREE.Mesh(bodywork([[0.30, 0.10, 0.56], [0.77, 0.15, 0.71], [1.15, 0.14, 0.56], [1.47, 0.07, 0.39]], 0.29), bodyMat);
        arch.position.x = side * 0.50;
        root.add(arch);
      }
    }

    // Dual Rear LED Taillight strips
    [-0.52, 0.52].forEach(tx => {
      const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.05), taillightMat);
      taillight.position.set(tx, 0.45, -1.1);
      root.add(taillight);
    });

    // ------------------------------------------------------------------------
    // 3. VISIBLE RACER CHARACTER (Anime Hooded Pilot with Goggles)
    // ------------------------------------------------------------------------
    const driverGroup = new THREE.Group();
    driverGroup.position.set(0, 0.42, -0.15);

    // Racing Bucket Seat
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.75, 0.2), carbonMat);
    seatBack.position.set(0, 0.45, -0.22);
    seatBack.rotation.x = -0.15;
    driverGroup.add(seatBack);

    // Racer Torso (Red Hoodie)
    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0xb82722,
      roughness: 0.8
    });
    const torso = new THREE.Mesh(new RoundedBoxGeometry(0.49, 0.50, 0.38, 2, 0.11), hoodieMat);
    torso.position.set(0, 0.44, -0.05);
    torso.rotation.x = -0.11;
    driverGroup.add(torso);

    // Racer Arms reaching forward
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(side * 0.19, 0.58, 0.03);
      const wrist = new THREE.Vector3(side * 0.145, 0.55, 0.34);
      const direction = wrist.clone().sub(shoulder);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.087, direction.length() - 0.10, 3, 10), hoodieMat);
      arm.position.copy(shoulder).lerp(wrist, 0.5);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      driverGroup.add(arm);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.083, 10, 8), carbonMat);
      glove.position.copy(wrist);
      driverGroup.add(glove);
    }

    // The helmet and its wraparound shield share a center for a flush fit.
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x272c37, metalness: 0.4, roughness: 0.29 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), shellMat);
    head.position.set(0, 0.85, -0.03);
    head.scale.set(0.99, 1.03, 1.07);
    driverGroup.add(head);
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.265, 24, 7, 0.09, Math.PI - 0.18, 1.03, 0.74),
      new THREE.MeshStandardMaterial({ color: 0x247185, metalness: 0.63, roughness: 0.18 })
    );
    head.add(visor);
    const helmetStripe = new THREE.Mesh(
      new THREE.SphereGeometry(0.262, 3, 8, Math.PI / 2 - 0.13, 0.26, 0, 0.99),
      stripe
    );
    head.add(helmetStripe);

    // Racing Steering Wheel
    const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), chromeMat);
    wheelHub.position.set(0, 0.48, 0.28);
    wheelHub.rotation.x = -Math.PI / 3;
    driverGroup.add(wheelHub);

    const steeringRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.026, 8, 16),
      carbonMat
    );
    steeringRing.position.set(0, 0.58, 0.38);
    steeringRing.rotation.x = -Math.PI / 4;
    driverGroup.add(steeringRing);

    root.add(driverGroup);

    // ------------------------------------------------------------------------
    // 4. TWIN ROCKET JET THRUSTER EXHAUSTS & NITRO BOOST FLAMES
    // ------------------------------------------------------------------------
    const boostFlames: THREE.Mesh[] = [];

    [-0.32, 0.32].forEach(ex => {
      // Outer turbine shroud
      const exhaustShroud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.45, 16),
        chromeMat
      );
      exhaustShroud.rotation.x = Math.PI / 2;
      exhaustShroud.position.set(ex, 0.42, -1.05);
      root.add(exhaustShroud);

      // Inner glowing plasma burner ring
      const innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.15, 16),
        neonCyanMat
      );
      innerRing.rotation.y = Math.PI;
      innerRing.position.set(ex, 0.42, -1.28);
      root.add(innerRing);

      exhausts.push(new THREE.Vector3(ex, 0.42, -1.28));

      // Dual High-Energy Rocket Boost Exhaust Flames
      const flameGroup = new THREE.Group();
      flameGroup.position.set(ex, 0.42, -1.3);

      // Outer Cyan Plasma Flame
      const outerFlameGeom = new THREE.ConeGeometry(0.24, 1.45, 12);
      outerFlameGeom.rotateX(-Math.PI / 2);
      const outerFlameMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.92
      });
      const outerFlame = new THREE.Mesh(outerFlameGeom, outerFlameMat);
      flameGroup.add(outerFlame);

      // Inner White Core Heat Spike
      const innerFlameGeom = new THREE.ConeGeometry(0.11, 1.1, 8);
      innerFlameGeom.rotateX(-Math.PI / 2);
      const innerFlameMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98
      });
      const innerFlame = new THREE.Mesh(innerFlameGeom, innerFlameMat);
      flameGroup.add(innerFlame);

      flameGroup.visible = false;
      root.add(flameGroup);
      boostFlames.push(flameGroup as any);
    });

    // ------------------------------------------------------------------------
    // 5. FOUR HIGH-GRIP RACING WHEELS, CHROME RIMS & RED BRAKE CALIPERS
    // ------------------------------------------------------------------------
    const wheelPositions = [
      new THREE.Vector3(-0.78, 0.32, 0.78),   // Front Left
      new THREE.Vector3(0.78, 0.32, 0.78),    // Front Right
      new THREE.Vector3(-0.84, 0.35, -0.78),  // Rear Left (Wider stance)
      new THREE.Vector3(0.84, 0.35, -0.78)    // Rear Right
    ];

    wheelPositions.forEach((pos) => {
      const wGroup = new THREE.Group();
      wGroup.position.copy(pos);

      const r = pos.z > 0 ? 0.32 : 0.36; // Larger rear tires
      const wWidth = pos.z > 0 ? 0.28 : 0.34;

      // Tire rubber
      const halfWidth = wWidth / 2;
      const profile = [[0, -halfWidth], [r * 0.79, -halfWidth], [r * 0.96, -halfWidth * 0.88], [r, -halfWidth * 0.66], [r, halfWidth * 0.66], [r * 0.96, halfWidth * 0.88], [r * 0.79, halfWidth], [0, halfWidth]];
      const tireGeom = new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), 32);
      tireGeom.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeom, tireMat);
      wGroup.add(tire);

      // Rim hub (Polished Alloy with Glowing Cyan Rim Ring)
      const rimGeom = new THREE.CylinderGeometry(r * 0.64, r * 0.64, wWidth + 0.012, 24);
      rimGeom.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeom, carbonMat);
      tire.add(rim);
      const faceX = Math.sign(pos.x) * (halfWidth + 0.018);
      const hoop = new THREE.TorusGeometry(r * 0.59, r * 0.050, 5, 24).rotateY(Math.PI / 2).translate(faceX, 0, 0);
      const spokes = Array.from({ length: 5 }, (_, i) =>
        new THREE.BoxGeometry(0.024, r * 0.48, r * 0.108)
          .translate(0, r * 0.36, 0).rotateX(i * 2 * Math.PI / 5).translate(faceX, 0, 0));
      const hub = new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.034, 10).rotateZ(Math.PI / 2).translate(faceX, 0, 0);
      const faceParts = [hoop, ...spokes, hub];
      tire.add(new THREE.Mesh(mergeGeometries(faceParts), chromeMat));
      faceParts.forEach(part => part.dispose());

      // Red Racing Brake Caliper
      const caliperGeom = new THREE.BoxGeometry(0.018, 0.08, 0.055);
      const caliper = new THREE.Mesh(caliperGeom, brakeMat);
      caliper.position.set(Math.sign(pos.x) * (halfWidth + 0.009), 0.034, -r * 0.37);
      wGroup.add(caliper);

      root.add(wGroup);
      wheels.push(wGroup as any);
    });

    // ------------------------------------------------------------------------
    // 6. DRIFT SPARKS (Mini-Turbo Charging Sparks near rear wheels)
    // ------------------------------------------------------------------------
    const driftSparks: THREE.Mesh[] = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 });
    [-0.92, 0.92].forEach((x) => {
      const sparkMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), sparkMat);
      sparkMesh.position.set(x, 0.2, -0.85);
      sparkMesh.visible = false;
      root.add(sparkMesh);
      driftSparks.push(sparkMesh);
    });

    // ------------------------------------------------------------------------
    // 7. CONTACT GROUND SHADOW DISC & NEON UNDERGLOW
    // ------------------------------------------------------------------------
    const shadowGeom = new THREE.PlaneGeometry(2.28, 3.12);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float r=length((vUv-0.5)*2.0); gl_FragColor=vec4(0.013,0.019,0.027,0.47*(1.0-smoothstep(0.35,1.0,r))); }',
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const shadowDisc = new THREE.Mesh(shadowGeom, shadowMat);
    shadowDisc.position.y = 0.03;
    root.add(shadowDisc);

    // Vibrant Neon Underglow
    const sillGeometry = new THREE.BoxGeometry(0.05, 0.035, 1.18);
    for (const side of [-1, 1]) {
      const sill = new THREE.Mesh(sillGeometry, rimMat);
      sill.position.set(side * 0.81, 0.245, -0.08);
      root.add(sill);
    }

    batchBody(root, new Set<THREE.Object3D>([hood, shadowDisc, ...wheels, ...driftSparks, ...boostFlames]));

    // Enable shadows for kart geometry
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child !== shadowDisc) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return {
      root,
      group: root,
      bodyMesh: hood,
      wheels,
      exhausts,
      driftSparks,
      boostFlames,
      shadowDisc
    };
  }
}
