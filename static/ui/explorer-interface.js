import * as THREE from "three";
import { findVisibleDestinations } from "/flight/navigation.js";
import { DEFAULT_SPEED_PERCENT, LIGHT_SPEED_KM_S, MAX_SPEED_PERCENT, MIN_SPEED_PERCENT } from "/data/solar-system.js";

export function createExplorerInterface({ root, destinations, sceneLabels, flightController, bodyFacts }) {
  const elements = {
    distance: document.querySelector("#distance-value"),
    progress: document.querySelector("#progress-value"),
    progressFill: document.querySelector("#progress-fill"),
    progressBar: document.querySelector(".progress-track"),
    journeyState: document.querySelector("#journey-state"),
    journeyEnd: document.querySelector("#journey-end"),
    destinationSelect: document.querySelector("#destination-select"),
    courseButton: document.querySelector("#course-button"),
    targetName: document.querySelector("#target-name"),
    targetDistanceLabel: document.querySelector("#target-distance-label"),
    targetDistance: document.querySelector("#target-distance"),
    speedSlider: document.querySelector("#speed-slider"),
    speedValue: document.querySelector("#speed-value"),
    speedKmhValue: document.querySelector("#speed-kmh-value"),
    timeWarpButtons: [...document.querySelectorAll("[data-warp]")]
  };

  let pointerPosition = null;
  connectControls();
  renderSpeed();
  selectDestination(elements.destinationSelect.value);

  function connectControls() {
    elements.speedSlider.min = String(MIN_SPEED_PERCENT);
    elements.speedSlider.max = String(MAX_SPEED_PERCENT);
    elements.speedSlider.value = String(DEFAULT_SPEED_PERCENT);
    elements.destinationSelect.addEventListener("change", () => selectDestination(elements.destinationSelect.value));
    elements.courseButton.addEventListener("click", () => {
      const active = flightController.toggleAutopilot();
      renderCourseButton(active);
    });

    for (const button of elements.timeWarpButtons) {
      button.addEventListener("click", () => {
        flightController.setTimeWarp(button.dataset.warp);
        for (const option of elements.timeWarpButtons) option.setAttribute("aria-pressed", String(option === button));
      });
    }

    for (const button of sceneLabels) {
      button.addEventListener("click", () => selectDestination(button.dataset.destinationId));
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", (event) => flightController.releaseKey(event.key.toLowerCase()));
    window.addEventListener("blur", () => flightController.clearInput());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) flightController.clearInput();
    });

    root.addEventListener("pointerdown", (event) => {
      pointerPosition = { x: event.clientX, y: event.clientY };
      root.setPointerCapture(event.pointerId);
    });
    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerup", () => { pointerPosition = null; });
    root.addEventListener("pointercancel", () => { pointerPosition = null; });

    document.querySelector("#reset-view").addEventListener("click", resetJourney);
    elements.speedSlider.addEventListener("input", () => {
      flightController.setSpeed(elements.speedSlider.value);
      renderSpeed();
    });
    connectCreditsPanel();
  }

  function selectDestination(bodyId) {
    const target = flightController.selectDestination(bodyId);
    if (!target) return null;
    elements.destinationSelect.value = target.id;
    renderCourseButton(false);
    setFadingText(elements.targetName, target.name);
    setFadingText(elements.targetDistanceLabel, target.isRegion ? "SCHEMATIC EXTENT" : "MEAN ORBIT");
    setFadingText(elements.targetDistance, getDestinationDescription(target));
    setFadingText(elements.journeyEnd, target.name.toUpperCase());
    elements.progressBar.setAttribute("aria-label", `Distance traveled toward ${target.name}`);
    elements.journeyState.textContent = `READY · CRUISE ${flightController.speedPercent}% c`;
    bodyFacts.hide();
    return target;
  }

  function getDestinationDescription(target) {
    if (target.id === "sun") return "SYSTEM CENTER";
    if (target.isRegion) return `${target.innerAU.toFixed(2)}–${target.outerAU.toFixed(2)} AU FROM SUN · SCHEMATIC EXTENT`;
    if (target.id === "moon") return "384,400 KM FROM EARTH";
    return `${(target.orbitKm / 1000000).toFixed(1)} MILLION KM FROM SUN`;
  }

  function handleKeyDown(event) {
    if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      if (flightController.pressKey(key)) renderCourseButton(false);
    }
    if (key === "r" && !event.repeat) resetJourney();
  }

  function handlePointerMove(event) {
    if (!pointerPosition) return;
    const deltaX = event.clientX - pointerPosition.x;
    const deltaY = event.clientY - pointerPosition.y;
    pointerPosition = { x: event.clientX, y: event.clientY };
    flightController.look(deltaX, deltaY);
    renderCourseButton(false);
  }

  function resetJourney() {
    const target = flightController.reset();
    if (target) elements.journeyState.textContent = `READY · CRUISE ${flightController.speedPercent}% c`;
    renderCourseButton(false);
    bodyFacts.hide();
  }

  function renderCourseButton(active) {
    elements.courseButton.innerHTML = active
      ? 'CANCEL AUTOPILOT <span aria-hidden="true">×</span>'
      : 'ENGAGE COURSE <span aria-hidden="true">↗</span>';
  }

  function renderSpeed() {
    const speedKmPerSecond = LIGHT_SPEED_KM_S * flightController.speedPercent / 100;
    elements.speedValue.textContent = `${flightController.speedPercent}% c`;
    elements.speedKmhValue.textContent = `${Math.round(speedKmPerSecond).toLocaleString("en-US")} km/s`;
  }

  function renderFlightFrame(snapshot) {
    if (!snapshot.shouldRender || !snapshot.selectedTarget) return;
    elements.distance.innerHTML = snapshot.rangeAU < 0.02
      ? `${Math.round(snapshot.rangeKm).toLocaleString("en-US")} <span>KM</span>`
      : `${snapshot.rangeAU.toFixed(2)} <span>AU</span>`;
    elements.progress.textContent = snapshot.progress.toFixed(1);
    elements.progressFill.style.width = `${snapshot.progress}%`;
    elements.progressBar.setAttribute("aria-valuenow", snapshot.progress.toFixed(1));
    if (snapshot.statusText) elements.journeyState.textContent = snapshot.statusText;
    if (snapshot.approachingDestination) {
      if (bodyFacts.currentBodyId !== snapshot.approachingDestination.id) bodyFacts.show(snapshot.approachingDestination);
    } else if (bodyFacts.currentBodyId) {
      bodyFacts.hide();
    }
  }

  function updateSceneLabels(camera, ship) {
    const visible = findVisibleDestinations(camera, ship, destinations, sceneLabels.length, {
      width: root.clientWidth,
      height: root.clientHeight
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
      const clampedLeft = THREE.MathUtils.clamp(left, 8, root.clientWidth - labelWidth - 8);
      const maxTop = Math.max(8, root.clientHeight - labelHeight - 8);
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

  function connectCreditsPanel() {
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

  return { renderFlightFrame, updateSceneLabels };
}

function setFadingText(element, value) {
  if (element.textContent === value) return;
  element.classList.add("is-changing");
  element.textContent = value;
  requestAnimationFrame(() => element.classList.remove("is-changing"));
}