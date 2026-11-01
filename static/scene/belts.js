import * as THREE from "three";

export function addAsteroidBelts(context) {
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

  return {
    id,
    name,
    isRegion: true,
    innerAU,
    outerAU,
    thicknessAU,
    approachRangeAU: Math.max(0.005, Math.min(0.1, thicknessAU * 0.5, (outerAU - innerAU) * 0.02)),
    samples: createRegionSamples(innerAU, outerAU, thicknessAU),
    kind: "Schematic belt region"
  };
}

function createRegionSamples(innerAU, outerAU, thicknessAU) {
  const samples = [];
  for (const radius of [innerAU, (innerAU + outerAU) / 2, outerAU]) {
    for (let index = 0; index < 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2;
      for (const height of [-thicknessAU / 2, 0, thicknessAU / 2]) {
        samples.push(new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius));
      }
    }
  }
  return samples;
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