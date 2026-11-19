import * as THREE from 'three';
import type { TrackConfig } from './TrackData';

const up = new THREE.Vector3(0, 1, 0);
const seaLevel = -2.8;
const tau = Math.PI * 2;
const noise = (n: number) => THREE.MathUtils.euclideanModulo(Math.sin(n * 127.1 + 37.9) * 43758.5453, 1);

function centeredMesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** The terrain, road furniture and structures all measure from the playable centerline. */
export function buildSunsetIsland(group: THREE.Group, curve: THREE.CatmullRomCurve3, config: TrackConfig) {
  const half = config.roadWidth / 2;
  const length = curve.getLength();
  const frame = (u: number) => {
    const t = THREE.MathUtils.euclideanModulo(u, 1);
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    return { point, tangent, side: new THREE.Vector3().crossVectors(tangent, up).normalize() };
  };
  // Convert authored landmark control points to their arc-length positions on this curve.
  const lengths = curve.getLengths();
  const station = (index: number) => lengths[Math.round(index / config.points.length * curve.arcLengthDivisions)] / length;
  const bridgeStart = station(16), bridgeEnd = station(19);
  const tunnelStart = station(13), tunnelEnd = station(14.7);
  const onBridge = (t: number) => t > bridgeStart && t < bridgeEnd;
  const samples = Array.from({ length: 512 }, (_, i) => frame(i / 512).point);
  function groundAt(x: number, z: number) {
    let distance = Infinity, closest = 0;
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < distance) { distance = d; closest = i; }
    }
    const t = closest / samples.length;
    const radius = Math.sqrt(distance);
    const shoreWidth = 31 + 7 * Math.sin(t * tau * 7) + 5 * Math.cos(t * tau * 11);
    const bridgeOpen = Math.min(t - bridgeStart, bridgeEnd - t) * length;
    const drop = THREE.MathUtils.smoothstep(radius, half + 4, shoreWidth + half);
    const rock = Math.sin(x * .11 + z * .07) * Math.sin(z * .14);
    const elevation = samples[closest].y - .7 + rock * THREE.MathUtils.smoothstep(radius, half + 3, half + 15) * 2.3;
    const land = THREE.MathUtils.lerp(elevation, seaLevel - 2.6, drop);
    return land - 22 * THREE.MathUtils.smoothstep(bridgeOpen, -12, 22);
  }

  const terrain = new THREE.PlaneGeometry(516, 524, 172, 175);
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(100, 0, 62);
  const positions = terrain.getAttribute('position');
  const terrainColors: number[] = [];
  const sand = new THREE.Color(0xe7bd8c), grass = new THREE.Color(0x718751);
  const cliff = new THREE.Color(0x8f796a), foam = new THREE.Color(0xaed5b0), c = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const y = groundAt(x, z);
    positions.setY(i, y);
    c.copy(sand).lerp(grass, THREE.MathUtils.smoothstep(y + 1.3 * Math.sin(z * .12), 1, 8));
    if (y > 7) c.lerp(cliff, Math.max(0, Math.sin(.04 * x - .09 * z)) * .7);
    if (y < -2) c.lerp(foam, THREE.MathUtils.smoothstep(-y, 2, 4));
    c.multiplyScalar(.94 + .1 * noise(i));
    terrainColors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrain.computeVertexNormals();
  group.add(centeredMesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

  // A sun disc and thin, wind-stretched clouds are painted in direction space.
  const sunDirection = config.sunPosition.clone().normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 18), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { sun: { value: sunDirection } },
    vertexShader: 'varying vec3 v; void main(){v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec3 v; uniform vec3 sun;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float clouds(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec3 d=normalize(v); float h=max(d.y,0.), glow=max(dot(d,sun),0.);
        vec3 color=mix(vec3(1.,.56,.36),vec3(.35,.52,.69),smoothstep(.01,.43,h));
        color=mix(color,vec3(.12,.33,.49),smoothstep(.43,1.,h));
        vec2 uv=d.xz/max(.06,h)*vec2(1.,3.);
        float bands=clouds(uv)*.64+clouds(uv*2.1)*.36;
        color=mix(color,vec3(1.,.75,.61),smoothstep(.56,.76,bands)*smoothstep(.02,.16,h)*.47);
        color+=vec3(.45,.23,.06)*pow(glow,28.);
        color=mix(color,vec3(1.6,1.22,.70),smoothstep(.99922,.99934,glow));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  const waterMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, sun: { value: sunDirection } },
    vertexShader: 'varying vec3 world; void main(){world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `
      varying vec3 world; uniform float time; uniform vec3 sun;
      void main(){
        vec2 p=world.xz; vec3 eye=normalize(cameraPosition-world);
        float wave=sin(p.x*.16+p.y*.22+time*.9)+.55*sin(p.y*.46-p.x*.08-time*.7);
        float fade=exp(-distance(cameraPosition,world)*.005);
        vec3 sea=mix(vec3(.13,.44,.47),vec3(.017,.48,.49),fade);
        vec3 n=normalize(vec3(.04*cos(p.x*.16+p.y*.22+time*.9),1.,.09*wave));
        float shine=pow(max(dot(reflect(-sun,n),eye),0.),48.);
        sea+=vec3(.9,.55,.27)*shine;
        sea+=vec3(.11,.22,.18)*smoothstep(1.18,1.46,wave)*fade;
        gl_FragColor=vec4(sea,1.);
        #include <colorspace_fragment>
      }`
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), waterMat);
  ocean.position.y = seaLevel;
  group.add(ocean);

  // Batch repeated objects by shape and spatial tile, allowing frustum culling in bends.
  const batches = new Map<string, { geometry: THREE.BufferGeometry; matrices: THREE.Matrix4[]; colors: THREE.Color[] }>();
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    round: new THREE.CylinderGeometry(1, 1, 1, 10),
    taper: new THREE.CylinderGeometry(.76, 1, 1, 10),
    canopy: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
    stone: new THREE.IcosahedronGeometry(1, 0),
    boulder: new THREE.IcosahedronGeometry(1, 1),
    leaf: leafGeometry(),
    sail: sailGeometry()
  };
  const obj = new THREE.Object3D();
  const add = (shape: keyof typeof geometries, pos: THREE.Vector3, scale: number[], color: number, yaw = 0, rotation?: THREE.Quaternion) => {
    const key = shape + '/' + Math.floor(pos.x / 110) + '/' + Math.floor(pos.z / 110);
    const batch = batches.get(key) || { geometry: geometries[shape], matrices: [], colors: [] };
    obj.position.copy(pos); obj.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) obj.quaternion.copy(rotation); else obj.rotation.set(0, yaw, 0);
    obj.updateMatrix();
    batch.matrices.push(obj.matrix.clone()); batch.colors.push(new THREE.Color(color));
    batches.set(key, batch);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const stem = (a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, shape: 'round' | 'box' | 'taper' = 'round') => {
    const dir = b.clone().sub(a);
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    add(shape, a.clone().lerp(b, .5), [r, dir.length(), r], color, 0, rotation);
  };
  const offset = (t: number, across: number, height = 0) => {
    const f = frame(t);
    return f.point.addScaledVector(f.side, across).addScaledVector(up, height);
  };

  // Vary shore silhouettes and separate distant ridges with atmospheric color.
  for (let i = 0; i < 24; i++) {
    const a = i * tau / 24 + .1 * noise(i);
    const d = 395 + noise(i + 201) * 220;
    const x = 90 + Math.sin(a) * d, z = 50 + Math.cos(a) * d;
    const w = 24 + noise(i + 66) * 85, h = w * (.4 + .48 * noise(i + 89));
    add('boulder', v(x, -h * .27, z), [w, h, w * .78], d < 460 ? 0x748e85 : 0xac929a, a);
    add('stone', v(x - w * .36, -h * .3, z + 8), [w, h * 1.15, w * .64], d < 460 ? 0x718b86 : 0xb5989b, a);
  }
  const palm = (base: THREE.Vector3, height: number, yaw: number) => {
    const wind = v(Math.cos(yaw) * height * .18, 0, Math.sin(yaw) * height * .18);
    const mid = base.clone().addScaledVector(up, height * .52).addScaledVector(wind, .22);
    const crown = base.clone().addScaledVector(up, height).add(wind);
    stem(base, mid, height * .036, 0x866951, 'taper');
    stem(mid, crown, height * .029, 0xa18463, 'taper');
    for (let j = 0; j < 10; j++) {
      const angle = yaw + j * 2.4;
      const span = height * (j % 2 ? .51 : .64);
      add('leaf', crown, [span, span * (.78 + .22 * Math.cos(j)), span], [0x317952, 0x487f46, 0x51925c][j % 3], angle);
    }
  };

  for (let i = 0; i < 170; i++) {
    const t = (i + noise(i)) / 170;
    if (onBridge(t) || (t > tunnelStart && t < tunnelEnd)) continue;
    const side = i % 3 ? 1 : -1;
    const p = offset(t, side * (half + 9 + 24 * noise(i + 4)));
    const y = groundAt(p.x, p.z);
    if (y < seaLevel + .6 || samples.some(s => (s.x - p.x) ** 2 + (s.z - p.z) ** 2 < (half + 8) ** 2)) continue;
    p.y = y - .2;
    if (i % 4) palm(p, 5.4 + noise(i + 26) * 5, i * 2.4);
    else {
      add('stone', p, [3.2, 2.1, 2.5], 0x9a8574, i);
      add('boulder', p.clone().add(v(1.5, .75, 0)), [2.4, 1.7, 2.1], 0x538353, i * 2);
    }
  }

  // Raised bridge. Both pylons, stays and low deck follow the exact road frame.
  for (let i = 0; i <= 12; i++) {
    const t = THREE.MathUtils.lerp(bridgeStart, bridgeEnd, i / 12);
    const center = frame(t);
    const yaw = Math.atan2(center.tangent.x, center.tangent.z);
    const span = (bridgeEnd - bridgeStart) * length / 12;
    const deckRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.asin(center.tangent.y), yaw, 0, 'YXZ'));
    add('box', offset(t, 0, -1.25), [config.roadWidth + 2.4, 1.1, span + 1], 0x647779, yaw, deckRotation);
    if (i !== 3 && i !== 9) continue;
    for (const side of [-1, 1]) {
      const foot = offset(t, side * (half + 2.4)); foot.y = seaLevel - 1;
      const head = offset(t, side * (half + 4), 22);
      stem(foot, head, 1.25, 0xd8d3bf, 'box');
      add('box', head, [1.5, 1.1, 1.5], 0xf37648, yaw);
      for (const dir of [-1, 1]) for (let k = 1; k <= 4; k++) {
        const end = offset(t + dir * k * 7 / length, side * (half + 1.65), .5);
        stem(head.clone().addScaledVector(up, -k * .55), end, .095, 0xe9d8bb);
      }
    }
  }
  // Mountain gallery: continuous, curved shell with a guaranteed clear bore.
  const tunnelVertices: number[] = [], tunnelIndices: number[] = [];
  const ring = [[-half - 5,-1],[-half - 4,4],[-half - 1,8],[-half + 2,9],[half - 2,9],[half + 1,8],[half + 4,4],[half + 5,-1]];
  for (let i = 0; i <= 32; i++) {
    const t = THREE.MathUtils.lerp(tunnelStart, tunnelEnd, i / 32);
    for (let j = 0; j < ring.length; j++) {
      const point = offset(t, ring[j][0], ring[j][1]);
      tunnelVertices.push(point.x, point.y, point.z);
      if (i > 0 && j > 0) {
        const n = i * ring.length + j;
        tunnelIndices.push(n-ring.length-1, n-1, n, n-ring.length-1, n, n-ring.length);
      }
    }
    if (i % 4 === 0) {
      for (let j = 1; j < ring.length; j++) {
        stem(offset(t, ...ringPoint(j-1)), offset(t, ...ringPoint(j)), .28, i % 32 ? 0x8e8c82 : 0xe38a56, 'box');
      }
      for (const side of [-1,1]) {
        add('round', offset(t, side * (half-.5), 7.9), [.40,.15,.40], 0xffd390);
        add('boulder', offset(t, side * (half + 10), 2.5), [5,7,6], 0x8f8072, i);
      }
    }
  }
  function ringPoint(i: number): [number, number] {return [ring[i][0], ring[i][1]];}
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(tunnelVertices, 3));
  shell.setIndex(tunnelIndices); shell.computeVertexNormals();
  group.add(centeredMesh(shell, new THREE.MeshStandardMaterial({color: 0x756b64, side: THREE.DoubleSide, roughness: 1})));

  // Small quay buildings with shaded verandas, grid flags and sailboats.
  for (let i = 0; i < 8; i++) {
    const t = (i * 8 + 7) / length;
    const p = offset(t, half + 8 + (i % 2) * 3);
    p.y = groundAt(p.x, p.z);
    const yaw = Math.atan2(frame(t).tangent.x,frame(t).tangent.z);
    add('box', p.clone().addScaledVector(up,2), [6,4,6], i % 3 === 0 ? 0xe2b99a : 0xedd9b8, yaw);
    add('canopy', p.clone().addScaledVector(up,4.65), [5.9,2.2,5.8], i % 3 ? 0xb35f45 : 0x496d74, yaw);
    const front = half + 4.9 + (i % 2) * 3;
    const facade = (s: number, across: number, y: number) => offset(t + s / length, across).setY(p.y + y);
    for (const side of [-1, 1]) {
      add('box', facade(side * 1.7, front, 2.35), [.15,1.2,1.15],0x46676c,yaw);
      add('box', facade(side * 1.7, front - .12, 1.68), [.32,.15,1.4],0xdfb99b,yaw);
      add('box', facade(side * 2, front - 1.45, 1.15), [.12,2.3,.12],0xedcba6,yaw);
    }
    add('box', facade(0, front, 1.2), [.15,2.4,1.15],0x8c6756,yaw);
    add('box', facade(0, front - .8, 2.5), [1.85,.18,5.2],i%2?0xe4ad78:0x557e80,yaw);
  }
  for (let i = 0; i < 15; i++) {
    const t = (i * 8 - 38) / length;
    const p = offset(t,-half-2.9);
    const top = p.clone().addScaledVector(up,4.7);
    stem(p,top,.065,0xd4c6ad);
    add('sail',top.clone().addScaledVector(up,-1.8),[.95,1.9,1],i%3 ? 0xec7443 : 0xf0dcc0,.43);
  }

  // The harbor straight alternates tall palms with low shade canopies. Roadside
  // structures stay below the horizon through the braking approach.
  for (let i = 0; i < 13; i++) {
    const t = (i * 10 - 25) / length;
    for (const side of [-1, 1]) {
      if (side > 0 && i > 2 && i < 10) continue; // keep the village frontage clear
      const p = offset(t, side * (half + 5.6 + noise(i + 12) * 2));
      p.y = groundAt(p.x, p.z);
      palm(p, 5.9 + 2.6 * noise(i + 14), i * 2.6);
    }
    if (i % 3 !== 0) continue;
    const base = offset(t, -half - 15);
    base.y = groundAt(base.x, base.z);
    if (base.y < seaLevel + .5) continue;
    const top = base.clone().addScaledVector(up, 2.7);
    stem(base,top,.075,0xa4835e);
    add('canopy',top,[2.9,1.05,2.9],i%2?0xdb8757:0xf4d2a2,.35);
    add('box',base.clone().add(v(1.1,.35,.2)),[.9,.4,2.05],0xc0a182,.2);
  }

  // A lighthouse on a separate rock islet marks the entry to the harbor.
  const light = v(51,-1,102);
  add('boulder',light,[19,5,15],0xbca180,3);
  add('taper',light.clone().add(v(0,9,0)),[2.5,14,2.5],0xf6deba);
  add('taper',light.clone().add(v(0,11,0)),[2.16,2.8,2.16],0xd56040);
  add('round',light.clone().add(v(0,16.3,0)),[2.85,.65,2.85],0x354655);
  add('round',light.clone().add(v(0,17.5,0)),[1.68,2.4,1.68],0xf8c477);
  add('canopy',light.clone().add(v(0,19.1,0)),[2.9,1.5,2.9],0xc75d40);
  for (let i=0;i<7;i++){
    const x=-47-noise(i)*66,z=18+noise(i+30)*91;
    const keel=v(x,seaLevel+.38,z),yaw=noise(i+4)*tau;
    add('boulder',keel,[1.15,.75,3.15],i%2?0xebcfad:0x31596a,yaw);
    stem(keel,keel.clone().addScaledVector(up,6),.055,0x725e50);
    add('sail',keel.clone().addScaledVector(up,.85),[2.3,5.1,1],i%3?0xffe3b5:0xe88457,yaw);
  }

  // Turn direction is read from curve curvature in the driver's view.
  for (const knot of [3, 5, 8, 10, 13, 21, 23]) {
    const t = station(knot), before = frame(t - .012), after = frame(t + .012);
    const bend = Math.sign(after.tangent.dot(before.side));
    for (let i = -1; i <= 1; i++) {
      const u = t + i * 4.3 / length, f = frame(u);
      const center = offset(u, -bend * (half + 2), 2);
      const yaw = Math.atan2(f.tangent.x, f.tangent.z);
      add('box', center, [2.3,1.25,.16],0x303c44,yaw);
      const face = center.clone().addScaledVector(f.tangent,-.11);
      const tip = face.clone().addScaledVector(f.side,bend * .45);
      for(const y of [-.42,.42]) {
        const end=face.clone().addScaledVector(f.side,-bend*.3).addScaledVector(up,y);
        stem(end,tip,.22,0xff994f,'box');
      }
    }
  }
  // A paint grid at gate zero and individual start boxes behind it.
  const start = frame(0);
  const yaw = Math.atan2(start.tangent.x,start.tangent.z);
  for (let i=0;i<18;i++) for (let row=0;row<2;row++){
    const center=offset((row-.5)*.72/length,((i+.5)/18-.5)*config.roadWidth,.045);
    add('box',center,[config.roadWidth/18,.035,.72],(i+row)%2?0xffefd2:0x292f34,yaw);
  }
  for(let i=0;i<8;i++){
    const t=1-(18+Math.floor(i/2)*6+(i%2)*1.75)/length, side=(i%2?1:-1)*2.5;
    const f=frame(t), a=Math.atan2(f.tangent.x,f.tangent.z);
    add('box',offset(t+1.5/length,side,.045),[2.4,.035,.15],0xe7ddc0,a);
    for(const s of [-1,1])add('box',offset(t+1.1/length,side+s*1.13,.045),[.15,.035,.75],0xe7ddc0,a);
  }

  const paint = new THREE.MeshStandardMaterial({roughness:.87,metalness:.05,side:THREE.DoubleSide,flatShading:true});
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry,paint,batch.matrices.length);
    batch.matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,batch.colors[i]);});
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return { sky, ocean, update(delta: number, viewer: THREE.Vector3) {
    waterMat.uniforms.time.value += delta;
    sky.position.copy(viewer);
  } };
}

// Each leaf has a raised spine, a drooping tip and a serrated edge.
function leafGeometry() {
  const vertices: number[]=[], indices: number[]=[];
  for(let i=0;i<=16;i++){
    const t=i/16, y=.17*Math.sin(t*Math.PI)-.24*t*t;
    const width=(.007+.13*Math.sin(Math.PI*t))*(i%2 ? .69 : 1);
    vertices.push(t,y-.025,width,t,y+.025,0,t,y-.03,-width);
    if(i){const n=i*3;indices.push(n-3,n,n-2,n-2,n,n+1,n-2,n+1,n-1,n-1,n+1,n+2);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function sailGeometry(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,.07,.06,.4,.43,.15,0,1,0],3));
  g.setIndex([0,1,2,0,2,3,2,1,3]);g.computeVertexNormals();
  return g;
}
