import { DESTINATION_FACTS } from "/data/planet-facts.js";

export function createBodyFactsPanel() {
  const panel = document.querySelector("#body-facts");
  const title = document.querySelector("#facts-title");
  const factsList = document.querySelector("#facts-list");
  const scienceClaim = document.querySelector("#science-claim");
  const historyClaim = document.querySelector("#history-claim");
  const universe = document.querySelector(".universe");
  let hideTimer = 0;
  let typingTimers = [];
  let bodyId = null;

  function show(body) {
    window.clearTimeout(hideTimer);
    render(body);
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    universe.classList.add("has-body-facts");
    requestAnimationFrame(() => panel.classList.add("is-visible"));
    bodyId = body.id;
  }

  function hide() {
    if (panel.hidden && !bodyId) return;
    window.clearTimeout(hideTimer);
    clearTyping();
    panel.classList.remove("is-visible");
    panel.setAttribute("aria-hidden", "true");
    universe.classList.remove("has-body-facts");
    bodyId = null;
    hideTimer = window.setTimeout(() => {
      if (!bodyId) panel.hidden = true;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 20 : 460);
  }

  function render(body) {
    clearTyping();
    title.textContent = body.name;
    factsList.replaceChildren();
    const rows = body.isRegion
      ? [
          ["SCHEMATIC RADIAL EXTENT", `${body.innerAU.toFixed(2)}–${body.outerAU.toFixed(2)} AU from Sun`],
          ["SCHEMATIC THICKNESS", `±${(body.thicknessAU / 2).toFixed(2)} AU`],
          ["REPRESENTATION", "Illustrative particle distribution"]
        ]
      : [
          ["MEAN RADIUS", `${body.radiusKm.toLocaleString("en-US")} km`],
          [body.id === "sun" ? "SYSTEM POSITION" : body.id === "moon" ? "MEAN DISTANCE FROM EARTH" : "MEAN DISTANCE FROM SUN",
            body.id === "sun" ? "Center" : body.id === "moon" ? "384,400 km" : `${(body.orbitKm / 1000000).toLocaleString("en-US", { maximumFractionDigits: 1 })} million km`],
          ["CLASSIFICATION", body.kind]
        ];
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const definition = document.createElement("dd");
      term.textContent = label;
      definition.textContent = value;
      row.append(term, definition);
      factsList.append(row);
    }

    const curatedFacts = DESTINATION_FACTS[body.id];
    renderClaim(scienceClaim, chooseClaim(curatedFacts?.science), "science", body.name);
    renderClaim(historyClaim, chooseClaim(curatedFacts?.history), "history", body.name);
  }

  function renderClaim(container, claim, category, bodyName) {
    container.replaceChildren();
    if (!claim || typeof claim.text !== "string" || typeof claim.source !== "string") {
      container.textContent = "Curated claim unavailable.";
      return;
    }

    const textNode = document.createTextNode("");
    const sourceLink = document.createElement("a");
    sourceLink.href = claim.source;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.className = "claim-source";
    sourceLink.textContent = "SOURCE ↗";
    sourceLink.setAttribute("aria-label", `Source for ${category} claim about ${bodyName}`);
    container.append(textNode, document.createTextNode(" "), sourceLink);

    const characters = Array.from(claim.text);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      textNode.textContent = claim.text;
      return;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      textNode.textContent += characters[index];
      index += 1;
      if (index >= characters.length) {
        window.clearInterval(timer);
        typingTimers = typingTimers.filter((activeTimer) => activeTimer !== timer);
      }
    }, 18);
    typingTimers.push(timer);
  }

  function clearTyping() {
    for (const timer of typingTimers) window.clearInterval(timer);
    typingTimers = [];
  }

  return {
    show,
    hide,
    get currentBodyId() {
      return bodyId;
    }
  };
}

function chooseClaim(claims) {
  return Array.isArray(claims) && claims.length > 0
    ? claims[Math.floor(Math.random() * claims.length)]
    : null;
}