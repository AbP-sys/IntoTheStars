import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AU_KM, SHIP_LENGTH_AU } from "/data/solar-system.js";

export function addSpacecraft({ scene, bodies }) {
  const ship = new THREE.Group();
  ship.name = "Illustrative third-person spacecraft";

  const earth = bodies.get("earth");
  ship.position.copy(earth.position).add(new THREE.Vector3(-70000 / AU_KM, 0, 0));
  ship.rotation.order = "YXZ";
  ship.rotation.set(0, -Math.PI / 2, 0, "YXZ");
  scene.add(ship);

  const loader = new GLTFLoader();
  loader.load(
    "/assets/star-fighter.glb",
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const leftEngine = model.getObjectByName("EngineLeft");
      const rightEngine = model.getObjectByName("EngineRight");
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = SHIP_LENGTH_AU / maxDimension;
      model.scale.multiplyScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.sub(center);
      ship.add(model);
      addEngineEffect(leftEngine);
      addEngineEffect(rightEngine);
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

export function addEngineEffect(engine) {
  const effect = new THREE.Group();
  const plumeLength = 2.5;
  const plumeGeometry = new THREE.ConeGeometry(0.28, plumeLength, 32, 1, false);
  plumeGeometry.rotateX(Math.PI / 2);

  const plumeMaterial = new THREE.MeshBasicMaterial({
    color: 0x168cff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
  plume.position.z = plumeLength / 2;
  effect.add(plume);

  const coreGeometry = new THREE.ConeGeometry(0.12, 1.7, 24);
  coreGeometry.rotateX(Math.PI / 2);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x9deaff,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.z = 0.85;
  effect.add(core);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x55bbff, blending: THREE.AdditiveBlending })
  );
  effect.add(glow);
  engine.add(effect);
  return effect;
}