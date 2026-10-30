import * as THREE from "three";
import { createBodyFactsPanel } from "/ui/body-facts.js";
import { createFlightNavigation, findVisibleDestinations } from "/flight/navigation.js";
import { createSolarSystemScene } from "/scene/solar-system-scene.js";
import {
  AU_KM,
  DEFAULT_SPEED_PERCENT,
  DEFAULT_TIME_WARP,
  LIGHT_SPEED_KM_S,
  MAX_SPEED_PERCENT,
  MIN_SPEED_PERCENT,
  SHIP_LENGTH_AU
} from "/data/solar-system.js";

const sceneRoot = document.querySelector("#scene");
const distanceValue = document.querySelector("#distance-value");
const progressValue = document.querySelector("#progress-value");
const progressFill = document.querySelector("#progress-fill");
const progressBar = document.querySelector(".progress-track");
const journeyState = document.querySelector("#journey-state");
const journeyEnd = document.querySelector("#journey-end");
const destinationSelect = document.querySelector("#destination-select");
const courseButton = document.querySelector("#course-button");
const targetName = document.querySelector("#target-name");
const targetDistanceLabel = document.querySelector("#target-distance-label");
const targetDistance = document.querySelector("#target-distance");
const loadingState = document.querySelector("#loading");
const errorState = document.querySelector("#error-state");
const sceneLabels = [...document.querySelectorAll("[data-scene-label]")];
const speedSlider = document.querySelector("#speed-slider");
const speedValue = document.querySelector("#speed-value");
const speedKmhValue = document.querySelector("#speed-kmh-value");
const timeWarpButtons = [...document.querySelectorAll("[data-warp]")];
const bodyFacts = createBodyFactsPanel();
const activeKeys = new Set();
const bodies = new Map();
const destinations = new Map();

let scene;
let camera;
let renderer;
let ship;
let flightNavigation;
let updateSolarSystemCamera;
let selectedTarget = null;
let autopilot = false;
let hasArrived = false;
let autopilotWaypoints = [];
let autopilotWaypointIndex = 0;
let previousTime = 0;
let displayTimer = 0;
let nearbyUpdateTime = 0;
let speedPercent = DEFAULT_SPEED_PERCENT;
let timeWarp = DEFAULT_TIME_WARP;
let routeStartDistanceAU = 1;
let yaw = -Math.PI / 2;
let pitch = -0.02;
const startPosition = new THREE.Vector3(0, 0, 0);

try {
  initializeScene();
  connectInterface();
  updateNearbyDestinations();
  window.addEventListener("resize", updateNearbyDestinations);
  requestAnimationFrame(animate);
} catch (error) {
  console.error("Unable to initialize the 3D scene", error);
  errorState.hidden = false;
  loadingState.classList.add("is-gone");
}

function initializeScene() {
  const solarSystem = createSolarSystemScene(sceneRoot, bodies, destinations, handleTextureError);
  scene = solarSystem.scene;
  camera = solarSystem.camera;
  renderer = solarSystem.renderer;
  ship = solarSystem.ship;
  startPosition.copy(solarSystem.startPosition);
  flightNavigation = createFlightNavigation(bodies, ship);
  updateSolarSystemCamera = solarSystem.updateCamera;
}

function connectInterface() {
  speedSlider.min = String(MIN_SPEED_PERCENT);
  speedSlider.max = String(MAX_SPEED_PERCENT);
  speedSlider.value = String(DEFAULT_SPEED_PERCENT);
  destinationSelect.addEventListener("change", () => selectDestination(destinationSelect.value));
  courseButton.addEventListener("click", () => {
    autopilot = !autopilot;
    hasArrived = false;
    courseButton.innerHTML = autopilot ? 'CANCEL AUTOPILOT <span aria-hidden="true">×</span>' : 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
    if (autopilot) {
      routeStartDistanceAU = ship.position.distanceTo(flightNavigation.destinationPosition(selectedTarget));
      autopilotWaypoints = flightNavigation.buildAutopilotWaypoints(selectedTarget);
      autopilotWaypointIndex = 0;
    }
  });

  for (const button of timeWarpButtons) {
    button.addEventListener("click", () => {
      timeWarp = Number(button.dataset.warp);
      for (const option of timeWarpButtons) option.setAttribute("aria-pressed", String(option === button));
    });
  }

  for (const button of sceneLabels) {
    button.addEventListener("click", () => {
      const bodyId = button.dataset.destinationId;
      if (!bodyId) return;
      destinationSelect.value = bodyId;
      selectDestination(bodyId);
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      activeKeys.add(key);
      if (autopilot) {
        autopilot = false;
        autopilotWaypoints = [];
        courseButton.innerHTML = 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
      }
    }
    if (key === "r" && !event.repeat) resetJourney();
  });

  window.addEventListener("keyup", (event) => activeKeys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => activeKeys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) activeKeys.clear();
  });
  let pointerPosition = null;
  sceneRoot.addEventListener("pointerdown", (event) => {
    pointerPosition = { x: event.clientX, y: event.clientY };
    sceneRoot.setPointerCapture(event.pointerId);
  });
  sceneRoot.addEventListener("pointermove", (event) => {
    if (!pointerPosition) return;
    const deltaX = event.clientX - pointerPosition.x;
    const deltaY = event.clientY - pointerPosition.y;
    yaw -= deltaX * 0.004;
    pitch = THREE.MathUtils.clamp(pitch - deltaY * 0.004, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    pointerPosition = { x: event.clientX, y: event.clientY };
    autopilot = false;
    hasArrived = false;
    courseButton.innerHTML = 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
  });
  sceneRoot.addEventListener("pointerup", () => { pointerPosition = null; });
  sceneRoot.addEventListener("pointercancel", () => { pointerPosition = null; });
  document.querySelector("#reset-view").addEventListener("click", resetJourney);
  speedSlider.addEventListener("input", () => {
    speedPercent = Number(speedSlider.value);
    renderSpeed();
  });
  renderSpeed();
  selectDestination(destinationSelect.value);

  const creditsPanel = document.querySelector("#credits-panel");
  const creditsToggle = document.querySelector("#credits-toggle");
  const closeCredits = () => {
    creditsPanel.hidden = true;
    creditsToggle.setAttribute("aria-expanded", "false");
    creditsToggle.querySelector("span").textContent = "+";
  };
  creditsToggle.addEventListener("click", () => {
    creditsPanel.hidden = !creditsPanel.hidden;
    creditsToggle.setAttribute("aria-expanded", String(!creditsPanel.hidden));
    creditsToggle.querySelector("span").textContent = creditsPanel.hidden ? "+" : "−";
  });
  document.querySelector("#credits-close").addEventListener("click", closeCredits);
}

function selectDestination(bodyId) {
  selectedTarget = destinations.get(bodyId);
  if (!selectedTarget) return;
  autopilot = false;
  hasArrived = false;
  autopilotWaypoints = [];
  courseButton.innerHTML = 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
  setFadingText(targetName, selectedTarget.name);
  setFadingText(targetDistanceLabel, selectedTarget.isRegion ? "SCHEMATIC EXTENT" : "MEAN ORBIT");
  setFadingText(targetDistance, selectedTarget.id === "sun"
    ? "SYSTEM CENTER"
    : selectedTarget.isRegion
      ? `${selectedTarget.innerAU.toFixed(2)}–${selectedTarget.outerAU.toFixed(2)} AU FROM SUN · SCHEMATIC EXTENT`
    : selectedTarget.id === "moon"
      ? "384,400 KM FROM EARTH"
        : `${(selectedTarget.orbitKm / 1000000).toFixed(1)} MILLION KM FROM SUN`);
  setFadingText(journeyEnd, selectedTarget.name.toUpperCase());
  progressBar.setAttribute("aria-label", `Distance traveled toward ${selectedTarget.name}`);
  routeStartDistanceAU = ship.position.distanceTo(flightNavigation.destinationPosition(selectedTarget));
  bodyFacts.hide();
  hasArrived = false;
  journeyState.textContent = `READY · CRUISE ${speedPercent}% c`;
}

function setFadingText(element, value) {
  if (element.textContent === value) return;
  element.classList.add("is-changing");
  element.textContent = value;
  requestAnimationFrame(() => element.classList.remove("is-changing"));
}

function setShipHeading(direction) {
  const normalized = direction.clone().normalize();
  yaw = Math.atan2(-normalized.x, -normalized.z);
  pitch = Math.asin(THREE.MathUtils.clamp(normalized.y, -1, 1));
  ship.rotation.order = "YXZ";
  ship.rotation.set(pitch, yaw, 0, "YXZ");
}

function updateFlight(deltaSeconds) {
  const turnSpeed = 0.82 * deltaSeconds;
  if (activeKeys.has("arrowleft")) yaw += turnSpeed;
  if (activeKeys.has("arrowright")) yaw -= turnSpeed;
  if (activeKeys.has("arrowup")) pitch = Math.min(pitch + turnSpeed, Math.PI / 2 - 0.02);
  if (activeKeys.has("arrowdown")) pitch = Math.max(pitch - turnSpeed, -Math.PI / 2 + 0.02);
  ship.rotation.order = "YXZ";
  ship.rotation.set(pitch, yaw, 0, "YXZ");

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ship.quaternion).normalize();
  const movement = new THREE.Vector3();
  if (activeKeys.has("w")) movement.add(forward);
  if (activeKeys.has("s")) movement.sub(forward);
  if (activeKeys.has("d")) movement.add(right);
  if (activeKeys.has("a")) movement.sub(right);

  const distancePerSecondAU = (LIGHT_SPEED_KM_S * speedPercent / 100 / AU_KM) * timeWarp;
  if (autopilot && selectedTarget) {
    const waypoint = autopilotWaypoints[autopilotWaypointIndex];
    const offset = waypoint.clone().sub(ship.position);
    const distance = offset.length();
    const waypointTolerance = Math.max(1000 / AU_KM, SHIP_LENGTH_AU);
    if (distance <= waypointTolerance) {
      if (autopilotWaypointIndex < autopilotWaypoints.length - 1) {
        autopilotWaypointIndex += 1;
      } else {
        autopilot = false;
        hasArrived = true;
        courseButton.innerHTML = 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
        journeyState.textContent = `ARRIVED · ${selectedTarget.name.toUpperCase()}`;
      }
    } else {
      setShipHeading(offset);
      const direction = offset.normalize();
      const requestedDistance = Math.min(distancePerSecondAU * deltaSeconds, distance);
      ship.position.addScaledVector(direction, flightNavigation.avoidBodyCollision(direction, requestedDistance));
    }
  } else if (movement.lengthSq() > 0) {
    const direction = movement.normalize();
    const requestedDistance = distancePerSecondAU * deltaSeconds;
    const allowedDistance = flightNavigation.avoidBodyCollision(direction, requestedDistance);
    ship.position.addScaledVector(direction, allowedDistance);
  }

  const rangeAU = ship.position.distanceTo(flightNavigation.destinationPosition(selectedTarget));
  const rangeKm = rangeAU * AU_KM;
  const progressDistanceAU = Math.max(routeStartDistanceAU - flightNavigation.arrivalRangeAU(selectedTarget), 0);
  const progress = progressDistanceAU > 0
    ? THREE.MathUtils.clamp(((routeStartDistanceAU - rangeAU) / progressDistanceAU) * 100, 0, 100)
    : rangeAU <= flightNavigation.arrivalRangeAU(selectedTarget) ? 100 : 0;
  const frameCount = Math.floor(performance.now() / 120);
  if (frameCount !== displayTimer) {
    displayTimer = frameCount;
    distanceValue.innerHTML = rangeAU < 0.02
      ? `${Math.round(rangeKm).toLocaleString("en-US")} <span>KM</span>`
      : `${rangeAU.toFixed(2)} <span>AU</span>`;
    progressValue.textContent = progress.toFixed(1);
    progressFill.style.width = `${progress}%`;
    progressBar.setAttribute("aria-valuenow", progress.toFixed(1));
    if (autopilot) journeyState.textContent = `AUTOPILOT · ${timeWarp.toLocaleString("en-US")}× SIM TIME`;
    else if (hasArrived) journeyState.textContent = `ARRIVED · ${selectedTarget.name.toUpperCase()}`;
    else if (progress > 0 && progress < 100) journeyState.textContent = `IN FLIGHT · ${progress.toFixed(1)}% COMPLETE`;
    let approachingDestination = null;
    let closestApproachAU = Infinity;
    for (const destination of destinations.values()) {
      const approachDistanceAU = ship.position.distanceTo(flightNavigation.destinationPosition(destination));
      const nearRangeAU = destination.isRegion
        ? destination.approachRangeAU
        : Math.max(100000 / AU_KM, destination.radiusAU * 30);
      if (approachDistanceAU <= nearRangeAU && approachDistanceAU < closestApproachAU) {
        approachingDestination = destination;
        closestApproachAU = approachDistanceAU;
      }
    }
    if (approachingDestination && bodyFacts.currentBodyId !== approachingDestination.id) bodyFacts.show(approachingDestination);
    else if (!approachingDestination && bodyFacts.currentBodyId) bodyFacts.hide();
  }
}

function updateCamera() {
  updateSolarSystemCamera();
}

function updateNearbyDestinations() {
  const visible = findVisibleDestinations(camera, ship, destinations, sceneLabels.length, {
    width: sceneRoot.clientWidth,
    height: sceneRoot.clientHeight
  });
  const placedLabels = [];
  for (let index = 0; index < sceneLabels.length; index += 1) {
    const button = sceneLabels[index];
    const entry = visible[index];
    const shouldHide = !entry;
    if (button.hidden !== shouldHide) button.hidden = shouldHide;
    if (!entry) continue;
    const { destination, screenX, screenY, screenRadius } = entry;
    if (button.dataset.destinationId !== destination.id) {
      button.dataset.destinationId = destination.id;
      button.classList.add("is-changing");
      button.textContent = destination.name;
      button.setAttribute("aria-label", `Select ${destination.name} destination`);
      requestAnimationFrame(() => button.classList.remove("is-changing"));
    }
    const labelWidth = button.offsetWidth;
    const labelHeight = button.offsetHeight;
    const left = screenX + screenRadius + 10;
    const unclampedTop = screenY - screenRadius - labelHeight - 4;
    const clampedLeft = THREE.MathUtils.clamp(left, 8, sceneRoot.clientWidth - labelWidth - 8);
    const maxTop = Math.max(8, sceneRoot.clientHeight - labelHeight - 8);
    const baseTop = THREE.MathUtils.clamp(unclampedTop, 8, maxTop);
    let top = baseTop;
    for (let attempt = 0; attempt < sceneLabels.length; attempt += 1) {
      const collides = placedLabels.some((placed) =>
        clampedLeft < placed.right && clampedLeft + labelWidth > placed.left &&
        top < placed.bottom && top + labelHeight > placed.top
      );
      if (!collides) break;
      top = baseTop + (attempt + 1) * (labelHeight + 4);
      if (top > maxTop) top = Math.max(8, baseTop - (attempt + 1) * (labelHeight + 4));
    }
    button.style.left = `${clampedLeft}px`;
    button.style.top = `${top}px`;
    placedLabels.push({ left: clampedLeft, top, right: clampedLeft + labelWidth, bottom: top + labelHeight });
  }
}

function renderSpeed() {
  const speedKmPerSecond = LIGHT_SPEED_KM_S * speedPercent / 100;
  speedValue.textContent = `${speedPercent}% c`;
  speedKmhValue.textContent = `${Math.round(speedKmPerSecond).toLocaleString("en-US")} km/s`;
}

function animate(time) {
  requestAnimationFrame(animate);
  const deltaSeconds = previousTime === 0 ? 0 : Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  updateFlight(deltaSeconds);
  updateCamera();
  if (time - nearbyUpdateTime >= 160) {
    nearbyUpdateTime = time;
    updateNearbyDestinations();
  }
  renderer.render(scene, camera);
}

function handleTextureError(error) {
  console.error("A NASA texture could not be loaded", error);
  errorState.hidden = false;
}

function resetJourney() {
  ship.position.copy(startPosition);
  setShipHeading(new THREE.Vector3(1, 0, 0));
  previousTime = 0;
  autopilot = false;
  hasArrived = false;
  autopilotWaypoints = [];
  activeKeys.clear();
  courseButton.innerHTML = 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
  routeStartDistanceAU = ship.position.distanceTo(flightNavigation.destinationPosition(selectedTarget));
  journeyState.textContent = `READY · CRUISE ${speedPercent}% c`;
  bodyFacts.hide();
}

function revealScene() {
  loadingState.classList.add("is-gone");
}

setTimeout(revealScene, 900);