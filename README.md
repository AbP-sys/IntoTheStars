# Into The Stars

A 3D space exploration game built for scientifically careful discovery, beginning at Solar System scale and designed to grow toward the Galaxy and beyond. Python's standard library serves the app; Three.js renders the browser scene. The Sun, eight planets, Moon, Asteroid Belt, and Kuiper Belt are selectable destinations.

## Run locally

```sh
/usr/bin/python server.py
```

Open http://127.0.0.1:8000. The browser needs internet access to load the pinned Three.js module and optional Google Fonts. Body textures and both Milky Way panoramas are bundled locally. The ESO panorama is preferred; if it fails to load, the Solar System Scope panorama is used.

WASD flies the third-person GLTF spacecraft, arrow keys steer, and dragging the scene changes heading (including touch drag). Choose a destination, select a body or belt visible in the camera view, and engage autopilot for an obstacle-avoiding course, or fly manually. Cruise speed is adjustable from 1% to 99% of light speed (default: 70%); simulation time compression is a separate control. The ship stops at a close-approach standoff, then displays numerical data and a randomly selected science and history claim with a source link. The reset button or `R` returns to the Earth departure point.

## Code structure

- `static/app.js` is the composition root: it initializes modules and coordinates the animation loop.
- `static/data/solar-system.js` owns units, simulation defaults, and body records; `static/data/planet-facts.js` owns sourced science and history claims.
- `static/flight/flight-controller.js` owns ship movement, speed/time-warp, autopilot, and flight state. It accepts scene objects and navigation operations and returns flight snapshots for presentation.
- `static/flight/navigation.js` owns destination projection, arrival ranges, waypoints, collision avoidance, and camera-frustum visibility.
- `static/ui/explorer-interface.js` binds DOM input and renders destination, journey, speed, and projected labels through the flight-controller API; `static/ui/body-facts.js` owns close-approach facts, source links, fades, and typing.
- `static/scene/solar-system-scene.js` composes the Three.js renderer and returns a scene runtime (`scene`, `camera`, `renderer`, `ship`, `startPosition`, and camera update operation).
- `static/scene/environment.js`, `celestial-bodies.js`, `belts.js`, and `spacecraft.js` separately own sky/lighting/stars/camera, body meshes/orbits, schematic belt regions, and the GLTF spacecraft/effects.
- `static/data/` remains the owner of astronomy records. Future scales and external data integrations should use explicit module contracts; add provider/API or persistence boundaries when an approved requirement calls for them, not as unused placeholders.

## Scale and interpretation

Scene coordinates use astronomical units (AU). Body radii and mean orbital distances use the same scale; planetary positions are fixed sample positions on circular coplanar guides, not date-specific ephemerides. Simulation time compression accelerates travel for usability; neither autopilot nor manual flight is a physical trajectory or relativistic simulation. The main asteroid belt and Kuiper Belt are schematic particle distributions with locally generated colors and geometry, not cataloged individual objects; their displayed thickness and density are illustrative. Belt navigation resolves to a projected point on the depicted region, not a fictional measured center object. The Milky Way panorama and supplemental point stars are separate illustrative sky layers, not measured star positions. Planet maps are equirectangular textures; they may contain filled data gaps or enhanced colors.

## Sources and attribution

- Earth texture: NASA Earth Observatory, [Blue Marble: Next Generation base map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/). Bundled image: `static/assets/earth-blue-marble.jpg` (5,400 × 2,700 JPEG). Credit: NASA Earth Observatory.
- Moon texture: NASA Goddard Scientific Visualization Studio, [LROC Colorized Moon](https://svs.gsfc.nasa.gov/4720/). Bundled image: `static/assets/moon-lroc-color.jpg` (2,048 × 1,024 JPEG). This is an aesthetic global mosaic compiled from LROC observations with lower-resolution polar fills; it is not a scientific-analysis map. Credit: NASA's Scientific Visualization Studio; visualization by Ernie Wright (USRA).
- Sun and planet maps, Saturn's ring alpha map, and fallback Milky Way sky panorama: Solar System Scope [Solar Textures](https://www.solarsystemscope.com/textures/), distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit Solar System Scope; maps and fallback panorama are bundled without modification. The panorama is scenery, not a catalog. Texture details and filenames are listed in [static/assets/ATTRIBUTION.md](static/assets/ATTRIBUTION.md).
- Preferred Milky Way panorama: `static/assets/milky-way-panorama-1.jpg`, from [ESO image eso0932a](https://www.eso.org/public/images/eso0932a/), credited **ESO/S. Brunier**, CC BY 4.0 under [ESO image-use terms](https://www.eso.org/public/copyright/). The bundled panorama is unmodified, illustrative sky photography, not a star catalog; procedural point stars remain a separate illustrative layer. See [static/assets/ATTRIBUTION.md](static/assets/ATTRIBUTION.md).
- Curated science and history claims are imported from `static/data/planet-facts.js`. Each claim's source is linked in the interface.
- Mean body radii: [NASA/JPL Planetary Physical Parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html). The displayed values are mean radii, not equatorial radii.
- Mean orbital distances (semi-major axes): [NASA GSFC Planetary Fact Sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/index.html) and its [fact-sheet notes](https://nssdc.gsfc.nasa.gov/planetary/factsheet/planetfact_notes.html). Orbital locations change; the app uses representative fixed positions.
- Moon fact-panel radius, mean Earth distance, and revolution period: [NASA GSFC NSSDCA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html). The period is revolution around Earth, not its synodic phase cycle.
- Belt context: NASA [Asteroids](https://science.nasa.gov/solar-system/asteroids/) and [Kuiper Belt](https://science.nasa.gov/solar-system/kuiper-belt/) pages. The rendered particles are illustrative, not individual measurements.
- NASA [image and media use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/). No NASA endorsement is implied. Review the source's asset-specific credits before redistributing this project.