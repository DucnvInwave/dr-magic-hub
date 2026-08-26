const container = document.querySelector("[data-three-orbit]");
const stage = container?.querySelector("[data-three-stage]");
const coreTextureUrl = new URL("./assets/icon.png", import.meta.url);
let THREE;

if (container && stage) {
  import("./three-runtime.js")
    .then(({ default: threeRuntime }) => {
      THREE = threeRuntime;
      initializeOrbitScene(container, stage);
    })
    .catch((error) => {
      console.warn("Three.js could not be loaded; using the CSS fallback.", error);
    });
}

function initializeOrbitScene(containerElement, stageElement) {
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    console.warn("Three.js scene is unavailable; using the CSS fallback.", error);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const root = new THREE.Group();
  const core = new THREE.Group();
  const orbiters = [];
  const clickTargets = [];
  const raycaster = new THREE.Raycaster();
  const raycastPointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animationFrame = 0;
  let elapsedTime = 0;
  let lastFrameTime = performance.now();
  let isVisible = true;
  let isDisposed = false;
  let hoveredSatellite = null;

  camera.position.set(0, 0.12, 10);
  renderer.setClearColor(0x000000, 0);
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute("aria-hidden", "true");
  stageElement.append(renderer.domElement);

  scene.add(root);
  root.rotation.set(-0.12, -0.08, -0.08);
  root.add(core);

  addLighting(scene);
  const globe = addCore(core, renderer.capabilities.getMaxAnisotropy());
  addOrbit(root, orbiters, clickTargets, {
    radius: 2.38,
    tilt: new THREE.Euler(1.05, 0.18, -0.35),
    speed: 0.11,
    satellites: [
      { label: "OPS", color: 0x5df2ad, angle: 1.1, target: "van-hanh" },
      { label: "WORK", color: 0x6e91ff, angle: 4.2, target: "cong-viec" }
    ]
  });
  addOrbit(root, orbiters, clickTargets, {
    radius: 2.72,
    tilt: new THREE.Euler(0.76, -0.38, 0.32),
    speed: -0.08,
    satellites: [
      { label: "GD", color: 0xff775f, angle: 0.25, target: "game-designer" },
      { label: "DEV", color: 0x38e8f5, angle: 2.35, target: "developer" },
      { label: "ART", color: 0xff55c8, angle: 4.45, target: "artist" }
    ]
  });
  addOrbit(root, orbiters, clickTargets, {
    radius: 3.02,
    tilt: new THREE.Euler(1.25, 0.32, -0.66),
    ringColor: 0xffe04b,
    speed: 0.09,
    satellites: [
      { label: "QC", color: 0xffe04b, angle: 3.15, target: "qc" }
    ]
  });
  addParticles(root);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(containerElement);

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible) {
      startAnimation();
    } else {
      stopAnimation();
    }
  }, { rootMargin: "15%" });
  visibilityObserver.observe(containerElement);

  containerElement.addEventListener("pointermove", handlePointerMove);
  containerElement.addEventListener("pointerleave", resetPointer);
  renderer.domElement.addEventListener("click", handleSatelliteClick);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", dispose, { once: true });
  reducedMotion.addEventListener("change", handleMotionPreference);
  renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);

  resize();
  renderFrame(0);
  containerElement.classList.add("is-three-ready");
  startAnimation();

  function resize() {
    const { width, height } = stageElement.getBoundingClientRect();
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    renderer.setSize(safeWidth, safeHeight, false);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    renderFrame(0);
  }

  function handlePointerMove(event) {
    const bounds = containerElement.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;

    if (!reducedMotion.matches) {
      pointerTarget.set(normalizedX, normalizedY);
    }
    setHoveredSatellite(findSatelliteAtPointer(event));
  }

  function resetPointer() {
    pointerTarget.set(0, 0);
    setHoveredSatellite(null);
  }

  function handleSatelliteClick(event) {
    const satellite = findSatelliteAtPointer(event);
    if (satellite?.userData.targetSlug) {
      navigateToSection(satellite.userData.targetSlug);
    }
  }

  function findSatelliteAtPointer(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    raycastPointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
    );
    raycaster.setFromCamera(raycastPointer, camera);
    const intersection = raycaster.intersectObjects(clickTargets, false)[0];
    return intersection?.object.userData.satelliteRoot || null;
  }

  function setHoveredSatellite(satellite) {
    if (hoveredSatellite === satellite) {
      return;
    }
    if (hoveredSatellite) {
      hoveredSatellite.scale.setScalar(1);
    }
    hoveredSatellite = satellite;
    if (hoveredSatellite) {
      hoveredSatellite.scale.setScalar(1.14);
    }
    renderer.domElement.classList.toggle("is-satellite-hovered", Boolean(hoveredSatellite));
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopAnimation();
    } else if (isVisible) {
      startAnimation();
    }
  }

  function handleMotionPreference() {
    pointerTarget.set(0, 0);
    if (reducedMotion.matches) {
      stopAnimation();
      renderFrame(0);
    } else if (isVisible && !document.hidden) {
      startAnimation();
    }
  }

  function handleContextLost(event) {
    event.preventDefault();
    stopAnimation();
    containerElement.classList.remove("is-three-ready");
  }

  function startAnimation() {
    if (animationFrame || reducedMotion.matches || document.hidden || !isVisible || isDisposed) {
      return;
    }
    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function animate(frameTime) {
    animationFrame = 0;
    const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
    lastFrameTime = frameTime;
    elapsedTime += delta;
    renderFrame(delta);
    startAnimation();
  }

  function renderFrame(delta) {
    pointerCurrent.lerp(pointerTarget, 1 - Math.exp(-delta * 4.5));
    root.rotation.x = -0.12 - pointerCurrent.y * 0.16;
    root.rotation.y = -0.08 + pointerCurrent.x * 0.22;
    core.position.y = reducedMotion.matches ? 0 : Math.sin(elapsedTime * 0.8) * 0.07;
    core.rotation.z = reducedMotion.matches ? -0.035 : -0.035 + Math.sin(elapsedTime * 0.45) * 0.025;
    globe.rotation.y += delta * 0.2;

    orbiters.forEach(({ pivot, satellites, speed }) => {
      pivot.rotation.z += delta * speed;
      satellites.forEach((satellite, index) => {
        satellite.rotation.y += delta * (index % 2 === 0 ? 0.42 : -0.36);
      });
    });

    renderer.render(scene, camera);
  }

  function dispose() {
    isDisposed = true;
    stopAnimation();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    containerElement.removeEventListener("pointermove", handlePointerMove);
    containerElement.removeEventListener("pointerleave", resetPointer);
    renderer.domElement.removeEventListener("click", handleSatelliteClick);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.removeEventListener("change", handleMotionPreference);
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach(disposeMaterial);
      } else if (object.material) {
        disposeMaterial(object.material);
      }
    });
    renderer.dispose();
  }
}

function addLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xaadfff, 0x130b29, 2.3));

  const cyanLight = new THREE.PointLight(0x38e8f5, 34, 12, 2);
  cyanLight.position.set(-3.6, 2.6, 4.2);
  scene.add(cyanLight);

  const warmLight = new THREE.PointLight(0xffb94b, 28, 11, 2);
  warmLight.position.set(3.4, -2.4, 3.6);
  scene.add(warmLight);
}

function addCore(core, maxAnisotropy) {
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 72, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x160642,
      emissiveIntensity: 0.24,
      metalness: 0.08,
      roughness: 0.38
    })
  );
  globe.rotation.set(0.08, -0.4, -0.12);
  core.add(globe);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.28, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0x38e8f5, transparent: true, opacity: 0.075 })
  );
  core.add(atmosphere);

  const latitudeGrid = new THREE.Mesh(
    new THREE.SphereGeometry(1.205, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xbaf8ff, transparent: true, opacity: 0.11, wireframe: true })
  );
  core.add(latitudeGrid);

  const equator = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.012, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0xffe04b, transparent: true, opacity: 0.62 })
  );
  equator.rotation.x = Math.PI / 2.25;
  equator.rotation.y = -0.16;
  core.add(equator);

  new THREE.TextureLoader().load(
    coreTextureUrl.href,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.set(2, 1);
      texture.offset.x = 0.25;
      globe.material.map = texture;
      globe.material.emissiveMap = texture;
      globe.material.emissive.setHex(0xffffff);
      globe.material.emissiveIntensity = 0.16;
      globe.material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn("Could not load the Three.js globe texture.", error)
  );

  return globe;
}

function addOrbit(root, orbiters, clickTargets, definition) {
  const pivot = new THREE.Group();
  pivot.rotation.copy(definition.tilt);
  root.add(pivot);

  const ringGeometry = new THREE.TorusGeometry(definition.radius, 0.014, 8, 160);
  const ringMaterialOptions = { transparent: true, opacity: 0.4 };

  if (definition.satellites.length > 1) {
    applyOrbitGradient(ringGeometry, definition.satellites);
    ringMaterialOptions.vertexColors = true;
  } else {
    ringMaterialOptions.color = definition.ringColor || definition.satellites[0].color;
  }

  const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial(ringMaterialOptions));
  pivot.add(ring);

  const satellites = definition.satellites.map((satelliteDefinition) => {
    const satellite = createSatellite(
      satelliteDefinition.label,
      satelliteDefinition.color,
      satelliteDefinition.target,
      clickTargets
    );
    satellite.position.set(
      Math.cos(satelliteDefinition.angle) * definition.radius,
      Math.sin(satelliteDefinition.angle) * definition.radius,
      0
    );
    satellite.rotation.z = satelliteDefinition.angle;
    pivot.add(satellite);
    return satellite;
  });

  orbiters.push({ pivot, satellites, speed: definition.speed });
}

function applyOrbitGradient(geometry, satellites) {
  const colorStops = satellites
    .map(({ angle, color }) => ({ angle: normalizeAngle(angle), color: new THREE.Color(color) }))
    .sort((first, second) => first.angle - second.angle);
  const colors = [];
  const uv = geometry.getAttribute("uv");

  for (let index = 0; index < uv.count; index += 1) {
    const angle = normalizeAngle(uv.getX(index) * Math.PI * 2);
    const { from, to, progress } = findColorInterval(colorStops, angle);
    const color = from.color.clone().lerp(to.color, progress);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

function findColorInterval(stops, angle) {
  for (let index = 0; index < stops.length; index += 1) {
    const from = stops[index];
    const to = stops[(index + 1) % stops.length];
    const endAngle = index === stops.length - 1 ? to.angle + Math.PI * 2 : to.angle;
    const adjustedAngle = angle < from.angle ? angle + Math.PI * 2 : angle;

    if (adjustedAngle >= from.angle && adjustedAngle <= endAngle) {
      return {
        from,
        to,
        progress: (adjustedAngle - from.angle) / Math.max(0.0001, endAngle - from.angle)
      };
    }
  }

  return { from: stops[0], to: stops[0], progress: 0 };
}

function normalizeAngle(angle) {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function createSatellite(labelText, color, targetSlug, clickTargets) {
  const satellite = new THREE.Group();
  satellite.userData.targetSlug = targetSlug;
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.32,
    metalness: 0.46,
    roughness: 0.3
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x162d5e,
    emissive: 0x183f88,
    emissiveIntensity: 0.24,
    metalness: 0.55,
    roughness: 0.28
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), bodyMaterial);
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.035), panelMaterial);
  const rightPanel = leftPanel.clone();
  leftPanel.position.x = -0.34;
  rightPanel.position.x = 0.34;
  satellite.add(body, leftPanel, rightPanel);

  const label = createLabelSprite(labelText, color);
  label.position.set(0, 0.48, 0);
  satellite.add(label);

  satellite.traverse((object) => {
    if (object.isMesh || object.isSprite) {
      object.userData.satelliteRoot = satellite;
      clickTargets.push(object);
    }
  });
  return satellite;
}

function navigateToSection(slug) {
  let attempts = 0;

  function scrollWhenReady() {
    const target = document.getElementById(slug);
    if (target) {
      window.history.pushState(null, "", `#${slug}`);
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
      return;
    }

    attempts += 1;
    if (attempts < 120) {
      requestAnimationFrame(scrollWhenReady);
    }
  }

  scrollWhenReady();
}

function createLabelSprite(label, color) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 112;

  context.fillStyle = "rgba(5, 17, 32, 0.88)";
  roundedRect(context, 8, 8, 240, 96, 25);
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.stroke();
  context.fillStyle = "#f4f8f4";
  context.font = "700 42px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 128, 58);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.9, 0.39, 1);
  sprite.renderOrder = 4;
  return sprite;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function addParticles(root) {
  const positions = [];
  for (let index = 0; index < 90; index += 1) {
    const radius = 2.2 + Math.random() * 1.7;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi) * 0.58
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xbdeeff,
    size: 0.025,
    transparent: true,
    opacity: 0.58,
    sizeAttenuation: true
  }));
  root.add(particles);
}

function disposeMaterial(material) {
  Object.values(material).forEach((value) => {
    if (value?.isTexture) {
      value.dispose();
    }
  });
  material.dispose();
}
