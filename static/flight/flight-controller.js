import * as THREE from "three";
import {
  AU_KM,
  DEFAULT_SPEED_PERCENT,
  DEFAULT_TIME_WARP,
  LIGHT_SPEED_KM_S,
  MAX_SPEED_PERCENT,
  MIN_SPEED_PERCENT,
  SHIP_LENGTH_AU
} from "/data/solar-system.js";

const APPROACH_REFRESH_MS = 120;
const MAX_FRAME_SECONDS = 0.05;
const TURN_RATE = 0.82;

export function createFlightController({ ship, startPosition, destinations, navigation }) {
  const activeKeys = new Set();
  let selectedTarget = null;
  let autopilot = false;
  let hasArrived = false;
  let waypoints = [];
  let waypointIndex = 0;
  let previousTime = 0;
  let lastDisplayFrame = -1;
  let speedPercent = DEFAULT_SPEED_PERCENT;
  let timeWarp = DEFAULT_TIME_WARP;
  let routeStartDistanceAU = 1;
  let yaw = -Math.PI / 2;
  let pitch = -0.02;
  let approachingDestination = null;

  function applyHeading(direction) {
    const normalized = direction.clone().normalize();
    yaw = Math.atan2(-normalized.x, -normalized.z);
    pitch = Math.asin(THREE.MathUtils.clamp(normalized.y, -1, 1));
    ship.rotation.order = "YXZ";
    ship.rotation.set(pitch, yaw, 0, "YXZ");
  }

  function selectDestination(bodyId) {
    selectedTarget = destinations.get(bodyId) ?? null;
    if (!selectedTarget) return null;
    cancelAutopilot();
    hasArrived = false;
    routeStartDistanceAU = ship.position.distanceTo(navigation.destinationPosition(selectedTarget));
    return selectedTarget;
  }

  function toggleAutopilot() {
    if (!selectedTarget) return false;
    if (autopilot) {
      cancelAutopilot();
      return false;
    }
    hasArrived = false;
    autopilot = true;
    routeStartDistanceAU = ship.position.distanceTo(navigation.destinationPosition(selectedTarget));
    waypoints = navigation.buildAutopilotWaypoints(selectedTarget);
    waypointIndex = 0;
    return true;
  }

  function cancelAutopilot() {
    autopilot = false;
    waypoints = [];
    waypointIndex = 0;
  }

  function pressKey(key) {
    activeKeys.add(key);
    if (!autopilot) return false;
    cancelAutopilot();
    return true;
  }

  function look(deltaX, deltaY) {
    yaw -= deltaX * 0.004;
    pitch = THREE.MathUtils.clamp(pitch - deltaY * 0.004, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    cancelAutopilot();
    hasArrived = false;
  }

  function setSpeed(percent) {
    speedPercent = THREE.MathUtils.clamp(Number(percent), MIN_SPEED_PERCENT, MAX_SPEED_PERCENT);
    return speedPercent;
  }

  function setTimeWarp(multiplier) {
    timeWarp = Number(multiplier);
    return timeWarp;
  }

  function reset() {
    ship.position.copy(startPosition);
    applyHeading(new THREE.Vector3(1, 0, 0));
    previousTime = 0;
    lastDisplayFrame = -1;
    cancelAutopilot();
    hasArrived = false;
    activeKeys.clear();
    approachingDestination = null;
    routeStartDistanceAU = selectedTarget
      ? ship.position.distanceTo(navigation.destinationPosition(selectedTarget))
      : 0;
    return selectedTarget;
  }

  function update(time) {
    const deltaSeconds = previousTime === 0 ? 0 : Math.min((time - previousTime) / 1000, MAX_FRAME_SECONDS);
    previousTime = time;
    const turnSpeed = TURN_RATE * deltaSeconds;
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
    if (autopilot && selectedTarget) updateAutopilot(deltaSeconds, distancePerSecondAU);
    else if (movement.lengthSq() > 0) {
      const direction = movement.normalize();
      const requestedDistance = distancePerSecondAU * deltaSeconds;
      ship.position.addScaledVector(direction, navigation.avoidBodyCollision(direction, requestedDistance));
    }

    if (!selectedTarget) return { shouldRender: false };

    const targetPosition = navigation.destinationPosition(selectedTarget);
    const rangeAU = ship.position.distanceTo(targetPosition);
    const rangeKm = rangeAU * AU_KM;
    const arrivalRange = navigation.arrivalRangeAU(selectedTarget);
    const progressDistanceAU = Math.max(routeStartDistanceAU - arrivalRange, 0);
    const progress = progressDistanceAU > 0
      ? THREE.MathUtils.clamp(((routeStartDistanceAU - rangeAU) / progressDistanceAU) * 100, 0, 100)
      : rangeAU <= arrivalRange ? 100 : 0;
    const frame = Math.floor(time / APPROACH_REFRESH_MS);
    const shouldRender = frame !== lastDisplayFrame;
    if (shouldRender) {
      lastDisplayFrame = frame;
      approachingDestination = findApproachingDestination();
    }

    return {
      shouldRender,
      selectedTarget,
      rangeAU,
      rangeKm,
      progress,
      statusText: getStatusText(progress),
      approachingDestination
    };
  }

  function updateAutopilot(deltaSeconds, distancePerSecondAU) {
    const waypoint = waypoints[waypointIndex];
    if (!waypoint) {
      cancelAutopilot();
      return;
    }
    const offset = waypoint.clone().sub(ship.position);
    const distance = offset.length();
    const waypointTolerance = Math.max(1000 / AU_KM, SHIP_LENGTH_AU);
    if (distance <= waypointTolerance) {
      if (waypointIndex < waypoints.length - 1) {
        waypointIndex += 1;
      } else {
        cancelAutopilot();
        hasArrived = true;
      }
      return;
    }
    applyHeading(offset);
    const direction = offset.normalize();
    const requestedDistance = Math.min(distancePerSecondAU * deltaSeconds, distance);
    ship.position.addScaledVector(direction, navigation.avoidBodyCollision(direction, requestedDistance));
  }

  function findApproachingDestination() {
    let closestDestination = null;
    let closestRangeAU = Infinity;
    for (const destination of destinations.values()) {
      const rangeAU = ship.position.distanceTo(navigation.destinationPosition(destination));
      const approachRangeAU = destination.isRegion
        ? destination.approachRangeAU
        : Math.max(100000 / AU_KM, destination.radiusAU * 30);
      if (rangeAU > approachRangeAU || rangeAU >= closestRangeAU) continue;
      closestDestination = destination;
      closestRangeAU = rangeAU;
    }
    return closestDestination;
  }

  function getStatusText(progress) {
    if (autopilot) return `AUTOPILOT · ${timeWarp.toLocaleString("en-US")}× SIM TIME`;
    if (hasArrived) return `ARRIVED · ${selectedTarget.name.toUpperCase()}`;
    if (progress > 0 && progress < 100) return `IN FLIGHT · ${progress.toFixed(1)}% COMPLETE`;
    return null;
  }

  return {
    selectDestination,
    toggleAutopilot,
    cancelAutopilot,
    pressKey,
    releaseKey: (key) => activeKeys.delete(key),
    clearInput: () => activeKeys.clear(),
    look,
    setSpeed,
    setTimeWarp,
    reset,
    update,
    get speedPercent() { return speedPercent; },
    get selectedTarget() { return selectedTarget; }
  };
}