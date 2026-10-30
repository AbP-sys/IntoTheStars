export const AU_KM = 149597870.7;
export const LIGHT_SPEED_KM_S = 299792.458;
export const MIN_SPEED_PERCENT = 1;
export const MAX_SPEED_PERCENT = 99;
export const DEFAULT_SPEED_PERCENT = 70;
export const DEFAULT_TIME_WARP = 1;
export const MIN_ARRIVAL_RANGE_KM = 30000;
export const CAMERA_TRAIL_AU = 0.00005;
export const SHIP_LENGTH_AU = 1100 / AU_KM;

export const BODY_DATA = [
  { id: "sun", name: "Sun", radiusKm: 695700, orbitKm: 0, texture: "2k_sun.jpg", kind: "G-type main-sequence star", phase: 0, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html" },
  { id: "mercury", name: "Mercury", radiusKm: 2439.4, orbitKm: 57900000, texture: "2k_mercury.jpg", kind: "Terrestrial planet", phase: 0.7, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html" },
  { id: "venus", name: "Venus", radiusKm: 6051.8, orbitKm: 108200000, texture: "2k_venus_atmosphere.jpg", kind: "Terrestrial planet", phase: 2.1, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html" },
  { id: "earth", name: "Earth", radiusKm: 6371, orbitKm: 149600000, texture: "earth-blue-marble.jpg", kind: "Terrestrial planet", phase: 0, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html" },
  { id: "mars", name: "Mars", radiusKm: 3389.5, orbitKm: 228000000, texture: "2k_mars.jpg", kind: "Terrestrial planet", phase: 4.7, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" },
  { id: "jupiter", name: "Jupiter", radiusKm: 69911, orbitKm: 778500000, texture: "2k_jupiter.jpg", kind: "Gas giant", phase: 2.8, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html" },
  { id: "saturn", name: "Saturn", radiusKm: 58232, orbitKm: 1432000000, texture: "2k_saturn.jpg", kind: "Gas giant", phase: 5.4, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html" },
  { id: "uranus", name: "Uranus", radiusKm: 25362, orbitKm: 2867000000, texture: "2k_uranus.jpg", kind: "Ice giant", phase: 1.2, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html" },
  { id: "neptune", name: "Neptune", radiusKm: 24622, orbitKm: 4515000000, texture: "2k_neptune.jpg", kind: "Ice giant", phase: 3.8, source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html" }
];