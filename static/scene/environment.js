import * as THREE from "three";
import { CAMERA_TRAIL_AU } from "/data/solar-system.js";

export function addEnvironment({ scene, onTextureError }) {
  addBackground(scene, onTextureError);
  addLighting(scene);
  addStars(scene);
}

export function updateCamera(camera, ship) {
  const offset = new THREE.Vector3(0, CAMERA_TRAIL_AU * 0.22, CAMERA_TRAIL_AU).applyQuaternion(ship.quaternion);
  camera.position.copy(ship.position).add(offset);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
  camera.lookAt(ship.position.clone().addScaledVector(forward, CAMERA_TRAIL_AU * 0.8));
}

export function resizeScene({ root, renderer, camera }) {
  const width = root.clientWidth;
  const height = root.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function addLighting(scene) {
  scene.add(new THREE.AmbientLight(0x91a7bb, 0.12));
  const sunlight = new THREE.PointLight(0xffe7c4, 2.4, 0, 2);
  sunlight.position.set(0, 0, 0);
  scene.add(sunlight);
}

function addBackground(scene, onTextureError) {
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

function addStars(scene) {
  let seed = 17361;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const positions = new Float32Array(1600 * 3);

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
    new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, color: 0xc5d5dc, transparent: true, opacity: 0.62, depthWrite: false })
  );
  stars.name = "Procedural supplemental stars; illustrative, not catalog positions";
  scene.add(stars);
}