// ============================================================================
// KARTVERSE — High-Fidelity 3D Arcade Kart Model Factory
// Inspired by AAA Arcade Racers: Jet Thrusters, High-Aero Spoilers,
// Visible Racer Character with Goggles, Chrome Rims & Neon Underglow
// ============================================================================

import * as THREE from 'three';

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
  public static createKart(kartId: string, customColor = '#ff0055'): KartVisual {
    const root = new THREE.Group();
    const wheels: THREE.Mesh[] = [];
    const exhausts: THREE.Vector3[] = [];

    const primaryColor = new THREE.Color(customColor);

    // High-gloss automotive paint material with subtle self-fill to ensure kart never goes dark
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      metalness: 0.75,
      roughness: 0.16,
      emissive: primaryColor,
      emissiveIntensity: 0.22
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x11141a,
      metalness: 0.8,
      roughness: 0.4
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.95,
      roughness: 0.1
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a20,
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
      color: 0xff1744,
      metalness: 0.6,
      roughness: 0.3
    });

    const neonCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    const taillightMat = new THREE.MeshBasicMaterial({
      color: 0xff0033
    });

    // ------------------------------------------------------------------------
    // 1. MAIN CHASSIS & AERODYNAMIC BODYWORK
    // ------------------------------------------------------------------------
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.32, 2.3), bodyMat);
    mainBody.position.set(0, 0.36, 0.05);
    root.add(mainBody);

    // Low-slung Front Splitter (Nosecone)
    const noseGeom = new THREE.BoxGeometry(1.42, 0.12, 0.7);
    const nose = new THREE.Mesh(noseGeom, carbonMat);
    nose.position.set(0, 0.2, 1.25);
    root.add(nose);

    // Front Aerodynamic Hood Scoop
    const hoodGeom = new THREE.BoxGeometry(0.85, 0.14, 0.95);
    const hood = new THREE.Mesh(hoodGeom, bodyMat);
    hood.position.set(0, 0.46, 0.65);
    hood.rotation.x = 0.12;
    root.add(hood);

    // Side Air Intake Pods
    [-0.68, 0.68].forEach(x => {
      const podGeom = new THREE.BoxGeometry(0.32, 0.36, 1.45);
      const pod = new THREE.Mesh(podGeom, bodyMat);
      pod.position.set(x, 0.38, -0.05);
      root.add(pod);

      // Black intake vents on each pod
      const ventGeom = new THREE.BoxGeometry(0.33, 0.24, 0.15);
      const vent = new THREE.Mesh(ventGeom, carbonMat);
      vent.position.set(x, 0.38, 0.65);
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
      const strutGeom = new THREE.BoxGeometry(0.06, 0.65, 0.16);
      const strut = new THREE.Mesh(strutGeom, carbonMat);
      strut.position.set(sx, 0.72, -0.98);
      strut.rotation.x = -0.22;
      root.add(strut);
    });

    // Main spoiler blade
    const wingGeom = new THREE.BoxGeometry(1.78, 0.08, 0.42);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(0, 1.0, -1.06);
    root.add(wing);

    // Vertical wing endplates
    [-0.9, 0.9].forEach(ex => {
      const endplateGeom = new THREE.BoxGeometry(0.05, 0.34, 0.52);
      const endplate = new THREE.Mesh(endplateGeom, carbonMat);
      endplate.position.set(ex, 1.0, -1.06);
      root.add(endplate);
    });

    // Glowing Neon Center Badge on Spoiler Rear Face ('K' Plate)
    const logoPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.32, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x1e1035 })
    );
    logoPlate.position.set(0, 0.78, -1.08);
    root.add(logoPlate);

    const logoNeonK = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.22, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xd946ef }) // Glowing fuchsia 'K' badge
    );
    logoNeonK.position.set(0, 0.78, -1.1);
    root.add(logoNeonK);

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
      color: 0xef4444, // Red driver hoodie
      roughness: 0.8
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.34), hoodieMat);
    torso.position.set(0, 0.46, -0.05);
    driverGroup.add(torso);

    // Racer Arms reaching forward
    [-0.26, 0.26].forEach(ax => {
      const armGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8);
      armGeom.rotateX(Math.PI / 3);
      const arm = new THREE.Mesh(armGeom, hoodieMat);
      arm.position.set(ax, 0.42, 0.16);
      driverGroup.add(arm);
    });

    // Racer Head / Helmet / Spiky Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1924, roughness: 0.9 });
    const headGeom = new THREE.SphereGeometry(0.22, 12, 12);
    const head = new THREE.Mesh(headGeom, hairMat);
    head.position.set(0, 0.82, -0.04);
    head.scale.set(1.0, 1.05, 1.0);
    driverGroup.add(head);

    // Red Hoodie Hood resting behind neck
    const hoodCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), hoodieMat);
    hoodCap.position.set(0, 0.76, -0.14);
    hoodCap.scale.set(1.05, 0.9, 0.9);
    driverGroup.add(hoodCap);

    // Racing Goggles with Glowing Cyan Visor
    const goggleFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.12),
      carbonMat
    );
    goggleFrame.position.set(0, 0.83, 0.12);
    driverGroup.add(goggleFrame);

    const goggleLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.09, 0.06),
      neonCyanMat
    );
    goggleLens.position.set(0, 0.83, 0.17);
    driverGroup.add(goggleLens);

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

    wheelPositions.forEach((pos, idx) => {
      const wGroup = new THREE.Group();
      wGroup.position.copy(pos);

      const r = pos.z > 0 ? 0.32 : 0.36; // Larger rear tires
      const wWidth = pos.z > 0 ? 0.28 : 0.34;

      // Tire rubber
      const tireGeom = new THREE.CylinderGeometry(r, r, wWidth, 20);
      tireGeom.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeom, tireMat);
      wGroup.add(tire);

      // Rim hub (Polished Alloy with Glowing Cyan Rim Ring)
      const rimGeom = new THREE.CylinderGeometry(r * 0.65, r * 0.65, wWidth + 0.02, 12);
      rimGeom.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeom, rimMat);
      wGroup.add(rim);

      // Red Racing Brake Caliper
      const caliperGeom = new THREE.BoxGeometry(0.09, 0.16, 0.14);
      const caliper = new THREE.Mesh(caliperGeom, brakeMat);
      caliper.position.set(pos.x > 0 ? -0.1 : 0.1, 0.1, 0);
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
    const shadowGeom = new THREE.CircleGeometry(1.45, 18);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const shadowDisc = new THREE.Mesh(shadowGeom, shadowMat);
    shadowDisc.position.y = 0.03;
    root.add(shadowDisc);

    // Vibrant Neon Underglow
    const underglow = new THREE.PointLight(primaryColor, 18, 5.5);
    underglow.position.set(0, 0.18, 0);
    root.add(underglow);

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
      bodyMesh: mainBody,
      wheels,
      exhausts,
      driftSparks,
      boostFlames,
      shadowDisc
    };
  }
}
