import * as THREE from "three";
import { AU_KM, MIN_ARRIVAL_RANGE_KM, SHIP_LENGTH_AU } from "/data/solar-system.js";

export function createFlightNavigation(bodies, ship) {
  function destinationPosition(destination, fromPosition = ship.position) {
    if (!destination.isRegion) return destination.position;
    return regionPosition(destination, fromPosition);
  }

  function arrivalRangeAU(body) {
    if (body.isRegion) return body.approachRangeAU / 2;
    return Math.max(MIN_ARRIVAL_RANGE_KM, body.radiusKm * 3) / AU_KM;
  }

  function buildAutopilotWaypoints(target) {
    const start = ship.position.clone();
    const targetPosition = destinationPosition(target, start);
    const destinationDirection = targetPosition.clone().sub(start).normalize();
    const endpoint = targetPosition.clone().addScaledVector(destinationDirection, -arrivalRangeAU(target));
    const route = endpoint.clone().sub(start);
    const routeDistance = route.length();
    if (routeDistance === 0) return [endpoint];
    const routeDirection = route.normalize();
    const obstacles = [];

    for (const body of bodies.values()) {
      if (body.id === target.id) continue;
      const offset = body.position.clone().sub(start);
      const alongRoute = offset.dot(routeDirection);
      if (alongRoute <= 0 || alongRoute >= routeDistance) continue;
      const closestPoint = start.clone().addScaledVector(routeDirection, alongRoute);
      const safeRadius = body.radiusAU + Math.max(SHIP_LENGTH_AU * 2, 20000 / AU_KM);
      if (closestPoint.distanceTo(body.position) >= safeRadius) continue;

      let detourDirection = new THREE.Vector3().crossVectors(routeDirection, new THREE.Vector3(0, 1, 0));
      if (detourDirection.lengthSq() < 0.000001) {
        detourDirection.crossVectors(routeDirection, new THREE.Vector3(0, 0, 1));
      }
      detourDirection.normalize();
      const detourRadius = safeRadius * 1.8;
      obstacles.push({
        alongRoute,
        entry: closestPoint.clone().addScaledVector(routeDirection, -safeRadius * 1.4).addScaledVector(detourDirection, detourRadius),
        exit: closestPoint.clone().addScaledVector(routeDirection, safeRadius * 1.4).addScaledVector(detourDirection, detourRadius)
      });
    }

    obstacles.sort((first, second) => first.alongRoute - second.alongRoute);
    return [...obstacles.flatMap((obstacle) => [obstacle.entry, obstacle.exit]), endpoint];
  }

  function avoidBodyCollision(direction, requestedDistance) {
    let allowedDistance = requestedDistance;
    for (const body of bodies.values()) {
      const safeRadius = body.radiusAU + SHIP_LENGTH_AU * 0.6;
      const offset = ship.position.clone().sub(body.position);
      const projected = offset.dot(direction);
      const constant = offset.lengthSq() - safeRadius ** 2;
      if (constant <= 0 && projected < 0) return 0;
      if (projected >= 0) continue;
      const discriminant = projected ** 2 - constant;
      if (discriminant < 0) continue;
      const intersection = -projected - Math.sqrt(discriminant);
      if (intersection >= 0 && intersection < allowedDistance) allowedDistance = intersection;
    }
    return allowedDistance;
  }

  return { destinationPosition, arrivalRangeAU, buildAutopilotWaypoints, avoidBodyCollision };
}

export function findVisibleDestinations(camera, ship, destinations, limit, viewport) {
  camera.updateMatrixWorld();
  const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(viewProjection);
  const visible = [];

  for (const destination of destinations.values()) {
    let distance = Infinity;
    let inView = false;
    let anchor = destination.position;
    if (destination.isRegion) {
      const nearestRegionPoint = regionPosition(destination, ship.position);
      distance = ship.position.distanceTo(nearestRegionPoint);
      let nearestVisibleSampleDistance = Infinity;
      for (const sample of destination.samples) {
        if (!frustum.containsPoint(sample)) continue;
        const sampleDistance = ship.position.distanceTo(sample);
        if (sampleDistance >= nearestVisibleSampleDistance) continue;
        nearestVisibleSampleDistance = sampleDistance;
        anchor = sample;
        inView = true;
      }
    } else {
      inView = frustum.intersectsSphere(new THREE.Sphere(destination.position, Math.max(destination.radiusAU, SHIP_LENGTH_AU * 0.1)));
      distance = Math.max(0, ship.position.distanceTo(destination.position) - destination.radiusAU);
    }
    if (!inView) continue;
    const projected = anchor.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) continue;
    const screenX = (projected.x * 0.5 + 0.5) * viewport.width;
    const screenY = (-projected.y * 0.5 + 0.5) * viewport.height;
    const depth = Math.max(camera.position.distanceTo(anchor), camera.near);
    const screenRadius = destination.isRegion
      ? 0
      : destination.radiusAU * viewport.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth);
    visible.push({ destination, distance, screenX, screenY, screenRadius });
  }

  return visible.sort((first, second) => first.distance - second.distance).slice(0, limit);
}

function regionPosition(destination, fromPosition) {
  const radialDistance = Math.hypot(fromPosition.x, fromPosition.z);
  const angle = radialDistance > 0 ? Math.atan2(fromPosition.z, fromPosition.x) : 0;
  const radius = THREE.MathUtils.clamp(radialDistance, destination.innerAU, destination.outerAU);
  const height = THREE.MathUtils.clamp(fromPosition.y, -destination.thicknessAU / 2, destination.thicknessAU / 2);
  return new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
}