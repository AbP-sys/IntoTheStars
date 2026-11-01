import * as THREE from "three";
import { addSolarSystemBodies } from "/scene/celestial-bodies.js";
import { addAsteroidBelts } from "/scene/belts.js";
import { addSpacecraft } from "/scene/spacecraft.js";
import { addEnvironment, resizeScene, updateCamera } from "/scene/environment.js";

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

  addEnvironment(context);
  addSolarSystemBodies(context);
  addAsteroidBelts(context);
  context.ship = addSpacecraft(context);
  context.startPosition = context.ship.position.clone();
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