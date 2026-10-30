import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AU_KM, BODY_DATA, CAMERA_TRAIL_AU, SHIP_LENGTH_AU } from "/data/solar-system.js";

export function createSolarSystemScene(root, bodies, destinations, onTextureError) {
  const width = root.clientWidth;
  const height = root.clientHeight;
  root.replaceChildren();

  const context = {
    root,
    bodies,
    destinations,
    onTextureError,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(60, width / height, 0.00000001, 120),
    renderer: new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
  };
  context.scene.background = new THREE.Color("#03060c");
  context.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  context.renderer.setSize(width, height);
  context.renderer.outputColorSpace = THREE.SRGBColorSpace;
  context.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  context.renderer.toneMappingExposure = 1.18;
  root.append(context.renderer.domElement);

  addBackground(context);
  addLighting(context);
  addSolarSystem(context);
  addAsteroidBelts(context);
  context.ship = addSpacecraft(context);
  context.startPosition = context.ship.position.clone();
  addStars(context);
  updateCamera(context.camera, context.ship);

  window.addEventListener("resize", () => resizeScene(context));
  return {
    scene: context.scene,
    camera: context.camera,
    renderer: context.renderer,
    ship: context.ship,
    startPosition: context.startPosition,
    updateCamera: () => updateCamera(context.camera, context.ship)
  };
}

function addLighting({ scene }) {
  scene.add(new THREE.AmbientLight(0x91a7bb, 0.12));
  const sunlight = new THREE.PointLight(0xffe7c4, 2.4, 0, 2);
  sunlight.position.set(0, 0, 0);
  scene.add(sunlight);
}

function addBackground({ scene, onTextureError }) {
  const textureLoader = new THREE.TextureLoader();
  const applySkyTexture = (skyTexture) => {
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = skyTexture;
  };
  textureLoader.load(
    "/assets/milky-way-panorama-1.jpg",
    applySkyTexture,
    undefined,
    () => textureLoader.load("/assets/2k_stars_milky_way.jpg", applySkyTexture, undefined, onTextureError)
  );
}

function addSolarSystem(context) {
  const { scene, renderer, bodies, destinations, onTextureError } = context;
  for (const data of BODY_DATA) {
    const position = data.orbitKm === 0
      ? new THREE.Vector3()
      : new THREE.Vector3(Math.cos(data.phase), 0, Math.sin(data.phase)).multiplyScalar(data.orbitKm / AU_KM);
    const radiusAU = data.radiusKm / AU_KM;
    const texture = new THREE.TextureLoader().load(`/assets/${data.texture}`, undefined, undefined, onTextureError);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const material = data.id === "sun"
      ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radiusAU, 48, 32), material);
    mesh.position.copy(position);
    mesh.name = `${data.name} · true mean radius`;
    scene.add(mesh);

    const body = { ...data, position, radiusAU, mesh };
    bodies.set(body.id, body);
    destinations.set(body.id, body);
    if (data.orbitKm > 0) addOrbitLine(scene, data.orbitKm / AU_KM, 0x76909c, 0.08);
    if (data.id === "earth") addEarthAtmosphere(scene, bodies, radiusAU);
    if (data.id === "saturn") addSaturnRings(scene, onTextureError, position, radiusAU);
  }

  const earth = bodies.get("earth");
  const moonDistanceAU = 384400 / AU_KM;
  const moonPosition = earth.position.clone().add(new THREE.Vector3(moonDistanceAU, 0, 0));
  const moonTexture = new THREE.TextureLoader().load("/assets/moon-lroc-color.jpg", undefined, undefined, onTextureError);
  moonTexture.colorSpace = THREE.SRGBColorSpace;
  const moonRadiusAU = 1737.4 / AU_KM;
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(moonRadiusAU, 40, 28),
    new THREE.MeshStandardMaterial({ map: moonTexture, roughness: 1 })
  );
  moonMesh.position.copy(moonPosition);
  moonMesh.name = "Moon · mean orbital distance from Earth";
  scene.add(moonMesh);
  bodies.set("moon", {
    id: "moon", name: "Moon", radiusKm: 1737.4, orbitKm: 384400, radiusAU: moonRadiusAU,
    position: moonPosition, mesh: moonMesh, kind: "Natural satellite", source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html"
  });
  destinations.set("moon", bodies.get("moon"));
  addOrbitLine(scene, moonDistanceAU, 0x9ca9aa, 0.28, earth.position);
}

function addEarthAtmosphere(scene, bodies, radiusAU) {
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radiusAU * 1.035, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying float vRim;
        void main() {
          vec3 normalView = normalize(normalMatrix * normal);
          vec3 positionView = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vRim = pow(1.0 - max(dot(normalView, normalize(-positionView)), 0.0), 2.7);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vRim;
        void main() {
          gl_FragColor = vec4(0.27, 0.72, 0.91, vRim * 0.52);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    })
  );
  atmosphere.position.copy(bodies.get("earth").position);
  atmosphere.name = "Illustrative atmospheric rim";
  scene.add(atmosphere);
}

function addOrbitLine(scene, radiusAU, color, opacity, center = new THREE.Vector3()) {
  const points = [];
  for (let index = 0; index <= 256; index += 1) {
    const angle = (index / 256) * Math.PI * 2;
    points.push(new THREE.Vector3(center.x + Math.cos(angle) * radiusAU, center.y, center.z + Math.sin(angle) * radiusAU));
  }
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false })
  );
  line.name = "Schematic circular mean-distance guide; not an ephemeris";
  scene.add(line);
}

function addSaturnRings(scene, onTextureError, position, radiusAU) {
  const ringTexture = new THREE.TextureLoader().load("/assets/2k_saturn_ring_alpha.png", undefined, undefined, onTextureError);
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(radiusAU * 1.25, radiusAU * 2.25, 96),
    new THREE.MeshStandardMaterial({ map: ringTexture, alphaMap: ringTexture, color: 0xe7d5b6, side: THREE.DoubleSide, transparent: true, depthWrite: false, roughness: 1 })
  );
  rings.rotation.x = -Math.PI / 2;
  rings.position.copy(position);
  rings.name = "Saturn rings · dimensions illustrative";
  scene.add(rings);
}

function addAsteroidBelts(context) {
  const asteroidBelt = addParticleBelt(context, 2.06, 3.27, 7000, 0.08, 15821, 0xb9a58f, "Asteroid belt", "asteroidBelt");
  const kuiperBelt = addParticleBelt(context, 30, 50, 3400, 0.45, 27183, 0x93aab6, "Kuiper Belt", "kuiperBelt");
  context.destinations.set(asteroidBelt.id, asteroidBelt);
  context.destinations.set(kuiperBelt.id, kuiperBelt);
}

function addParticleBelt(context, innerAU, outerAU, count, thicknessAU, initialSeed, color, name, id) {
  let seed = initialSeed;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = name === "Kuiper Belt"
    ? [new THREE.Color(0x567985), new THREE.Color(0x9bb9c2), new THREE.Color(0xc8d7dc)]
    : [new THREE.Color(0x746958), new THREE.Color(0xb8a184), new THREE.Color(0xd8c6a9)];
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = innerAU + Math.sqrt(random()) * (outerAU - innerAU);
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = (random() - 0.5) * thicknessAU;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
    palette[Math.floor(random() * palette.length)].toArray(colors, index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const particleTexture = createBeltParticleTexture(id === "kuiperBelt", initialSeed);
  const particles = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ map: particleTexture, color, vertexColors: true, size: 4, sizeAttenuation: false, transparent: true, alphaTest: 0.08, opacity: 0.86, depthWrite: false })
  );
  particles.name = `${name} · schematic particle distribution`;
  context.scene.add(particles);

  const samples = [];
  for (const radius of [innerAU, (innerAU + outerAU) / 2, outerAU]) {
    for (let index = 0; index < 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2;
      for (const height of [-thicknessAU / 2, 0, thicknessAU / 2]) {
        samples.push(new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius));
      }
    }
  }
  return {
    id,
    name,
    isRegion: true,
    innerAU,
    outerAU,
    thicknessAU,
    approachRangeAU: Math.max(0.005, Math.min(0.1, thicknessAU * 0.5, (outerAU - innerAU) * 0.02)),
    samples,
    kind: "Schematic belt region"
  };
}

function createBeltParticleTexture(icy, initialSeed) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;

  let seed = initialSeed;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  context.beginPath();
  context.arc(32, 32, 30, 0, Math.PI * 2);
  context.clip();
  const surface = context.createRadialGradient(21, 17, 3, 32, 32, 43);
  surface.addColorStop(0, icy ? "#e6f0ed" : "#d8c8ad");
  surface.addColorStop(0.58, icy ? "#839da0" : "#927e63");
  surface.addColorStop(1, icy ? "#263c43" : "#3e352c");
  context.fillStyle = surface;
  context.fillRect(0, 0, 64, 64);

  for (let index = 0; index < 11; index += 1) {
    const x = 7 + random() * 50;
    const y = 7 + random() * 50;
    const radius = 1.2 + random() * 4.2;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = icy ? "rgba(19, 39, 45, 0.24)" : "rgba(37, 29, 22, 0.3)";
    context.fill();
    context.beginPath();
    context.arc(x - radius * 0.18, y - radius * 0.2, radius * 0.72, Math.PI, Math.PI * 1.85);
    context.strokeStyle = icy ? "rgba(232, 247, 241, 0.5)" : "rgba(230, 211, 176, 0.42)";
    context.lineWidth = 0.8;
    context.stroke();
  }

  for (let index = 0; index < 180; index += 1) {
    const radius = 0.25 + random() * 0.8;
    context.beginPath();
    context.arc(random() * 64, random() * 64, radius, 0, Math.PI * 2);
    context.fillStyle = icy ? "rgba(235, 246, 239, 0.22)" : "rgba(238, 221, 193, 0.2)";
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


function addSpacecraft({ scene, bodies }) {
  const ship = new THREE.Group();
  ship.name = "Illustrative third-person spacecraft";

  const earth = bodies.get("earth");

  // Preserve existing positioning
  ship.position.copy(earth.position).add(
    new THREE.Vector3(-70000 / AU_KM, 0, 0)
  );

  ship.rotation.order = "YXZ";
  ship.rotation.set(0, -Math.PI / 2, 0, "YXZ");

  scene.add(ship);

  const loader = new GLTFLoader();

  loader.load(
    "/assets/spaceship-light.glb",

    (gltf) => {
      const model = gltf.scene;
        
      // Calculate original model dimensions
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());

      const maxDimension = Math.max(size.x, size.y, size.z);

      // Scale model to your desired spacecraft length
      const scale = SHIP_LENGTH_AU / maxDimension;
      model.scale.multiplyScalar(scale);

      // Center the model around its origin
      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());

      model.position.sub(center);
      model.rotation.set(0, -Math.PI / 2, 0);

      // Add model to spacecraft container
      ship.add(model);

      console.log("Spaceship loaded:", {
        dimensions: size,
        scale,
        position: ship.position
      });
    },

    undefined,

    (error) => {
      console.error("Failed to load spaceship GLB:", error);
    }
  );

  return ship;
}


function addStars({ scene }) {
  let seed = 17361;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const positions = new Float32Array(1600 * 3);
  const palette = [new THREE.Color(0xc5d5dc), new THREE.Color(0xf1d9bb), new THREE.Color(0x91bdc7)];

  for (let index = 0; index < 1600; index += 1) {
    const radius = 95 + random() * 15;
    const vertical = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    positions[index * 3] = radius * horizontal * Math.cos(angle);
    positions[index * 3 + 1] = radius * vertical;
    positions[index * 3 + 2] = radius * horizontal * Math.sin(angle);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, color: palette[0], transparent: true, opacity: 0.62, depthWrite: false })
  );
  stars.name = "Procedural supplemental stars; illustrative, not catalog positions";
  scene.add(stars);
}

function updateCamera(camera, ship) {
  const offset = new THREE.Vector3(0, CAMERA_TRAIL_AU * 0.22, CAMERA_TRAIL_AU).applyQuaternion(ship.quaternion);
  camera.position.copy(ship.position).add(offset);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
  camera.lookAt(ship.position.clone().addScaledVector(forward, CAMERA_TRAIL_AU * 0.8));
}

function resizeScene({ root, renderer, camera }) {
  const width = root.clientWidth;
  const height = root.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}