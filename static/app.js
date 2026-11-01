import { createBodyFactsPanel } from "/ui/body-facts.js";
import { createExplorerInterface } from "/ui/explorer-interface.js";
import { createFlightNavigation } from "/flight/navigation.js";
import { createFlightController } from "/flight/flight-controller.js";
import { createSolarSystemScene } from "/scene/solar-system-scene.js";

const sceneRoot = document.querySelector("#scene");
const loadingState = document.querySelector("#loading");
const errorState = document.querySelector("#error-state");
const sceneLabels = [...document.querySelectorAll("[data-scene-label]")];
const bodies = new Map();
const destinations = new Map();
let sceneRuntime;
let flightController;
let explorerInterface;
let nearbyUpdateTime = 0;

try {
  initializeExplorer();
  requestAnimationFrame(animate);
} catch (error) {
  console.error("Unable to initialize the 3D scene", error);
  errorState.hidden = false;
  loadingState.classList.add("is-gone");
}

function initializeExplorer() {
  sceneRuntime = createSolarSystemScene(sceneRoot, bodies, destinations, handleTextureError);
  const navigation = createFlightNavigation(bodies, sceneRuntime.ship);
  const bodyFacts = createBodyFactsPanel();
  flightController = createFlightController({
    ship: sceneRuntime.ship,
    startPosition: sceneRuntime.startPosition,
    destinations,
    navigation
  });
  explorerInterface = createExplorerInterface({
    root: sceneRoot,
    destinations,
    sceneLabels,
    flightController,
    bodyFacts
  });
  explorerInterface.updateSceneLabels(sceneRuntime.camera, sceneRuntime.ship);
  window.addEventListener("resize", () => explorerInterface.updateSceneLabels(sceneRuntime.camera, sceneRuntime.ship));
}

function animate(time) {
  requestAnimationFrame(animate);
  const flightSnapshot = flightController.update(time);
  explorerInterface.renderFlightFrame(flightSnapshot);
  sceneRuntime.updateCamera();
  if (time - nearbyUpdateTime >= 160) {
    nearbyUpdateTime = time;
    explorerInterface.updateSceneLabels(sceneRuntime.camera, sceneRuntime.ship);
  }
  sceneRuntime.renderer.render(sceneRuntime.scene, sceneRuntime.camera);
}

function handleTextureError(error) {
  console.error("A NASA texture could not be loaded", error);
  errorState.hidden = false;
}

function revealScene() {
  loadingState.classList.add("is-gone");
}

setTimeout(revealScene, 900);