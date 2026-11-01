import * as THREE from "three";
import { AU_KM, BODY_DATA } from "/data/solar-system.js";

export function addSolarSystemBodies(context) {
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

  addMoon(context);
}

function addMoon({ scene, bodies, destinations, onTextureError }) {
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