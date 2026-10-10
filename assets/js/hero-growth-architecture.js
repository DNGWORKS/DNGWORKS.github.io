/**
 * DNGWORKS — Growth Architecture hero scene
 * ---------------------------------------------------------------------------
 * Subject: seven glass plates and a satin spine. They arrive scattered,
 * align into one measured stack, then tilt forward and fan open. That is the
 * practice's claim in one object: diagnose, connect, grow. The drafted cobalt
 * edges match the keyline language used across the rest of the site, so the
 * silhouette is recognisable even in a still frame.
 *
 * Contract this module honours:
 *  - The poster is the first paint and is only faded out after a frame has
 *    verifiably rendered. On WebGL failure, context loss or timeout the
 *    poster comes back. The hero is never blank.
 *  - Scroll drives three readable stages while the hero is still on screen.
 *  - Renderer pauses off-screen, device pixel ratio is capped, every GPU
 *    resource is released on teardown and on context loss.
 *  - prefers-reduced-motion renders the composed final state once, no loop.
 */

import * as THREE from './vendor/three.module.js';

const FIRST_FRAME_TIMEOUT = 2600;
const PLATE_COUNT = 7;

/* Deterministic pseudo-random so the scattered state is art-directed and
   identical on every load — and matches the poster render exactly. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** Normalise v from [a,b] into [0,1]. */
const span = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

function roundedPlateShape(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

export default class GrowthArchitectureHero {
  constructor(stage, options = {}) {
    this.stage = stage;
    this.canvas = stage?.querySelector('[data-hero-canvas]');
    this.onStage = typeof options.onStage === 'function' ? options.onStage : null;
    this.debug = Boolean(options.debug);

    this.disposables = [];
    this.plates = [];
    this.connectors = [];
    this.frameCount = 0;
    this.scrollProgress = 0;
    this.renderedProgress = 0;
    this.pointer = { x: 0, y: 0 };
    this.pointerTarget = { x: 0, y: 0 };
    this.visible = true;
    this.running = false;
    this.destroyed = false;
    this.activeStage = -1;
    this.rafId = 0;
    this.startTime = 0;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tier = this.resolveTier();

    this.diagnostics = {
      moduleLoaded: true,
      webglSupported: null,
      contextCreated: false,
      plateCount: 0,
      renderFrameCount: 0,
      firstFrameAt: null,
      lastRenderAt: null,
      posterVisible: true,
      tier: this.tier,
      reducedMotion: this.reducedMotion,
      state: 'init',
      error: null,
    };

    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    this.tick = this.tick.bind(this);
  }

  /* ------------------------------------------------------------- lifecycle */

  init() {
    if (!this.stage || !this.canvas) return false;

    if (!this.supportsWebGL()) {
      this.setState('failed', 'webgl-unavailable');
      return false;
    }

    try {
      this.buildRenderer();
      this.buildScene();
      this.buildSubject();
      this.bind();
      this.layout();
    } catch (error) {
      this.diagnostics.error = String(error && error.message ? error.message : error);
      this.setState('failed', this.diagnostics.error);
      this.dispose();
      return false;
    }

    /* Reduced motion: one composed frame of the finished structure. No loop,
       no scroll binding, nothing moving — but never an empty canvas. */
    if (this.reducedMotion) {
      this.applyState(1, 0.78, 0);
      this.renderOnce();
      this.confirmFirstFrame('static');
      return true;
    }

    this.startTime = performance.now();
    this.start();

    /* If no frame lands inside the budget, keep the poster and stop paying
       for a renderer that is not producing anything. */
    this.firstFrameTimer = window.setTimeout(() => {
      if (this.frameCount === 0) {
        this.setState('failed', 'first-frame-timeout');
        this.stop();
      }
    }, FIRST_FRAME_TIMEOUT);

    return true;
  }

  supportsWebGL() {
    try {
      const probe = document.createElement('canvas');
      const ctx = probe.getContext('webgl2') || probe.getContext('webgl');
      const ok = Boolean(ctx);
      this.diagnostics.webglSupported = ok;
      if (ctx && ctx.getExtension) ctx.getExtension('WEBGL_lose_context')?.loseContext();
      return ok;
    } catch {
      this.diagnostics.webglSupported = false;
      return false;
    }
  }

  /** Coarse pointer, low core count or a small viewport all drop a tier. */
  resolveTier() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth < 840;
    const cores = navigator.hardwareConcurrency || 4;
    const lowMemory = (navigator.deviceMemory || 8) <= 4;
    if (coarse || narrow || cores <= 4 || lowMemory) return 'low';
    if (cores <= 8) return 'mid';
    return 'high';
  }

  maxPixelRatio() {
    return this.tier === 'low' ? 1.5 : this.tier === 'mid' ? 1.65 : 1.85;
  }

  /* ----------------------------------------------------------------- build */

  buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: this.tier !== 'low',
      powerPreference: this.tier === 'low' ? 'low-power' : 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setClearAlpha(0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio()));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.diagnostics.contextCreated = true;
  }

  /**
   * A studio environment, drawn on a canvas and converted to a reflection
   * probe. Without one, physical glass and satin metal render flat and the
   * structure reads as paper. This is far cheaper than shipping an HDR.
   */
  buildEnvironment() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const sky = ctx.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, '#ffffff');
    sky.addColorStop(0.42, '#dfeaff');
    sky.addColorStop(0.58, '#b9cdee');
    sky.addColorStop(1, '#8fa8cd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size, size);

    /* A bright soft-box high on the left and a cooler one behind right: the
       two highlights that give each plate a readable edge. */
    const box = ctx.createRadialGradient(size * 0.26, size * 0.2, 2, size * 0.26, size * 0.2, size * 0.34);
    box.addColorStop(0, 'rgba(255,255,255,1)');
    box.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = box;
    ctx.fillRect(0, 0, size, size);

    const cool = ctx.createRadialGradient(size * 0.82, size * 0.34, 2, size * 0.82, size * 0.34, size * 0.26);
    cool.addColorStop(0, 'rgba(188,214,255,0.95)');
    cool.addColorStop(1, 'rgba(188,214,255,0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const target = pmrem.fromEquirectangular(texture);
    this.scene.environment = target.texture;
    this.disposables.push(texture, target.texture);
    pmrem.dispose();
  }

  buildScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0.1, 0.55, 9.4);
    this.camera.lookAt(0, 0.1, 0);

    this.buildEnvironment();

    /* Bright studio set: a soft hemisphere fill, a key from the upper left,
       a cool rim from behind right, and a low bounce so the underside of
       each plate is never black. */
    this.scene.add(new THREE.HemisphereLight(0xeef5ff, 0xbacbe4, 0.7));

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-4.6, 6.8, 5.4);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x5f8cff, 1.9);
    rim.position.set(5.6, 1.8, -4.8);
    this.scene.add(rim);

    const bounce = new THREE.DirectionalLight(0xe8f4ff, 0.85);
    bounce.position.set(0.6, -4.6, 2.6);
    this.scene.add(bounce);

    const mintAccent = new THREE.PointLight(0x12bca4, 11, 14, 2);
    mintAccent.position.set(2.4, -1.2, 2.8);
    this.scene.add(mintAccent);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.buildGroundShadow();
  }

  /** A soft contact shadow, so the structure has weight instead of floating. */
  buildGroundShadow() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(23,61,167,0.30)');
    gradient.addColorStop(0.45, 'rgba(23,61,167,0.13)');
    gradient.addColorStop(1, 'rgba(23,61,167,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(9.5, 9.5);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    this.disposables.push(texture, geometry, material);

    this.shadow = new THREE.Mesh(geometry, material);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -3.3;
    this.shadow.renderOrder = 0;
    this.shadowMaterial = material;
    /* Added to the scene, not the group: the floor must stay level while
       the structure above it turns and tilts. */
    this.scene.add(this.shadow);
  }

  buildSubject() {
    const rand = seeded(20261009);

    /* Frosted acrylic rather than clear glass: a plate has to occlude what
       is behind it, or seven stacked panes saturate to flat white and the
       structure loses all depth. Tint descends from cobalt at the base to
       mint near the top, which is the brand's own gradient. */
    const glassColours = [0x6f96d8, 0x82a7de, 0x93b6e2, 0x8fc6cf, 0x74c3b4, 0x8fd3c6, 0xa9e0d4];
    const extrudeSegments = this.tier === 'low' ? 1 : 2;
    const curveSegments = this.tier === 'low' ? 4 : 8;

    /* --- plates --------------------------------------------------------- */
    for (let i = 0; i < PLATE_COUNT; i += 1) {
      const t = i / (PLATE_COUNT - 1);

      /* Widths taper towards the top so the silhouette reads as a structure
         rising, not a uniform stack of discs. */
      const w = lerp(3.5, 1.65, t) + (i === 2 ? 0.55 : 0);
      const h = lerp(2.35, 1.15, t);
      const depth = lerp(0.14, 0.085, t);

      const shape = roundedPlateShape(w, h, Math.min(w, h) * 0.17);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: depth * 0.3,
        bevelSize: depth * 0.34,
        bevelSegments: extrudeSegments,
        curveSegments,
        steps: 1,
      });
      geometry.center();
      this.disposables.push(geometry);

      const material = new THREE.MeshPhysicalMaterial({
        color: glassColours[i],
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.28,
        transparent: true,
        opacity: lerp(0.95, 0.88, t),
        depthWrite: true,
        side: THREE.DoubleSide,
        envMapIntensity: 0.55,
        specularIntensity: 1,
      });
      this.disposables.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 2 + i;

      /* Drafted outline: one clean path around the top face. Running
         EdgesGeometry over the solid returns the back face and every bevel
         seam as well, and the silhouette turns to wireframe noise. */
      const profile = shape.getPoints(curveSegments * 6);
      /* getPoints leaves the path open, so the first point is repeated to
         close the outline. */
      const closed = [...profile, profile[0]];
      const outline = new Float32Array(closed.length * 3);
      const faceZ = depth / 2 + depth * 0.34 + 0.004;
      for (let p = 0; p < closed.length; p += 1) {
        outline[p * 3] = closed[p].x;
        outline[p * 3 + 1] = closed[p].y;
        outline[p * 3 + 2] = faceZ;
      }
      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.BufferAttribute(outline, 3));
      this.disposables.push(edgeGeometry);

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: i % 3 === 1 ? 0x0e8f7d : 0x1b46c4,
        transparent: true,
        opacity: lerp(1, 0.72, t),
      });
      this.disposables.push(edgeMaterial);
      const edges = new THREE.Line(edgeGeometry, edgeMaterial);
      edges.renderOrder = 20 + i;
      mesh.add(edges);

      const group = new THREE.Group();
      group.add(mesh);
      this.root.add(group);

      /* Two poses per plate: where it sits while the problem is still
         undiagnosed, and where it belongs once the system is designed. */
      const scattered = {
        position: new THREE.Vector3(
          (rand() - 0.5) * 6.6,
          (rand() - 0.5) * 5.4,
          (rand() - 0.5) * 3.9
        ),
        rotation: new THREE.Euler(
          (rand() - 0.5) * 1.5,
          (rand() - 0.5) * 2.1,
          (rand() - 0.5) * 1.25
        ),
      };

      const aligned = {
        position: new THREE.Vector3(
          Math.sin(t * Math.PI * 1.15) * 0.42,
          lerp(-2.05, 2.25, t),
          Math.cos(t * Math.PI * 1.15) * 0.3
        ),
        rotation: new THREE.Euler(
          -1.2 + t * 0.1,
          t * 0.62,
          Math.sin(t * Math.PI) * 0.055
        ),
      };

      this.plates.push({ group, mesh, edges, material, edgeMaterial, scattered, aligned, t, index: i });
      this.diagnostics.plateCount = this.plates.length;
    }

    /* --- spine ---------------------------------------------------------- */
    const spineGeometry = new THREE.CylinderGeometry(
      0.075,
      0.075,
      5.2,
      this.tier === 'low' ? 10 : 24,
      1,
      false
    );
    this.disposables.push(spineGeometry);
    const spineMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9fb8da,
      roughness: 0.2,
      metalness: 1,
      clearcoat: 0.7,
      envMapIntensity: 1.9,
      transparent: true,
      opacity: 0,
    });
    this.disposables.push(spineMaterial);
    this.spine = new THREE.Mesh(spineGeometry, spineMaterial);
    this.spine.position.y = 0.1;
    this.spine.renderOrder = 1;
    this.root.add(this.spine);
    this.spineMaterial = spineMaterial;

    /* --- connectors and nodes: the relationships found during diagnosis,
           drawn with the same square node the page layout uses ----------- */
    const nodeGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.disposables.push(nodeGeometry);

    for (let i = 0; i < this.plates.length - 1; i += 1) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.disposables.push(geometry);
      const material = new THREE.LineBasicMaterial({
        color: 0x12bca4,
        transparent: true,
        opacity: 0,
      });
      this.disposables.push(material);
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 30;
      line.frustumCulled = false;
      this.root.add(line);

      const nodeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x12bca4,
        roughness: 0.22,
        metalness: 0.45,
        envMapIntensity: 1.4,
        transparent: true,
        opacity: 0,
      });
      this.disposables.push(nodeMaterial);
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.renderOrder = 31;
      this.root.add(node);

      this.connectors.push({ line, geometry, material, node, nodeMaterial, from: i, to: i + 1 });
    }
  }

  /* ---------------------------------------------------------------- layout */

  /**
   * Frame the subject by fitting its bounds to the stage rather than by
   * guessing a camera distance per breakpoint. The structure then fills a
   * wide desktop hero and a short mobile band equally well, and a resize
   * cannot leave it stranded in the middle of empty space.
   */
  layout() {
    if (!this.renderer || !this.camera) return;
    const w = this.stage.clientWidth || 1;
    const h = this.stage.clientHeight || 1;
    const aspect = w / h;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio()));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = aspect;

    /* Half-extents of the assembled structure, with a little breathing room.
       The widest plate is allowed to run past the frame on a narrow stage —
       a cropped structure reads better than a distant one. */
    /* A short mobile band gets a tighter fit, or the structure sits lost in
       the middle of it. */
    const halfHeight = aspect < 1.2 ? 3.05 : 3.55;
    const halfWidth = aspect < 1 ? 1.95 : 2.6;

    this.camera.fov = aspect < 0.85 ? 46 : 38;
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const forVertical = halfHeight / Math.tan(halfFov);
    const forHorizontal = halfWidth / (Math.tan(halfFov) * aspect);

    this.camera.position.set(0.1, 0.45, Math.max(forVertical, forHorizontal));
    this.camera.lookAt(0, 0.05, 0);
    this.camera.updateProjectionMatrix();
  }

  /* ----------------------------------------------------------------- state */

  /**
   * One function owns the whole scene state so a scroll frame, the entrance
   * and the reduced-motion still frame cannot drift apart.
   * @param {number} assembly  0 scattered → 1 aligned
   * @param {number} story     0 arrival → 1 fanned open
   * @param {number} elapsed   seconds since start, for the idle float
   */
  applyState(assembly, story, elapsed) {
    const connectAmount = span(story, 0.1, 0.44);
    const growAmount = span(story, 0.58, 1);

    for (const plate of this.plates) {
      /* Plates settle in sequence from the base up, so the structure reads
         as being built rather than snapping into place at once. */
      const stagger = plate.t * 0.26;
      const local = easeOutCubic(span(assembly, stagger, stagger + 0.74));

      const { scattered, aligned } = plate;
      const fan = growAmount * (plate.t * plate.t) * 1.25;
      const float = Math.sin(elapsed * 0.6 + plate.index * 0.85) * 0.045 * (1 - growAmount * 0.5);

      plate.group.position.set(
        lerp(scattered.position.x, aligned.position.x + fan * 0.72, local),
        lerp(scattered.position.y, aligned.position.y + fan * 0.46, local) + float,
        lerp(scattered.position.z, aligned.position.z + fan * 0.3, local)
      );
      plate.group.rotation.set(
        lerp(scattered.rotation.x, aligned.rotation.x + growAmount * 0.2, local),
        lerp(scattered.rotation.y, aligned.rotation.y + fan * 0.3, local),
        lerp(scattered.rotation.z, aligned.rotation.z - fan * 0.16, local)
      );

      const openness = 1 + growAmount * 0.14 * plate.t;
      plate.group.scale.setScalar(lerp(0.78, openness, local));
      plate.edgeMaterial.opacity = lerp(0.18, lerp(0.9, 0.5, plate.t), local);
    }

    /* Spine appears as the parts align: the system gaining an axis. */
    this.spineMaterial.opacity = easeInOutCubic(span(assembly, 0.45, 1)) * 0.78;
    this.spine.scale.y = lerp(0.45, 1 + growAmount * 0.12, easeOutCubic(assembly));

    /* Connectors are the relationships, so they only exist once aligned. */
    const linkOpacity = connectAmount * assembly;
    for (const connector of this.connectors) {
      const a = this.plates[connector.from].group.position;
      const b = this.plates[connector.to].group.position;
      const array = connector.geometry.attributes.position.array;
      array[0] = a.x; array[1] = a.y; array[2] = a.z;
      array[3] = b.x; array[4] = b.y; array[5] = b.z;
      connector.geometry.attributes.position.needsUpdate = true;
      connector.material.opacity = linkOpacity * 0.85;

      connector.node.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      connector.node.rotation.y = this.root.rotation.y * -0.5;
      connector.nodeMaterial.opacity = linkOpacity;
      connector.node.scale.setScalar(0.3 + linkOpacity * 0.7);
    }

    /* The contact shadow grows in with the structure and softens as the
       stack lifts forward in the last stage. */
    this.shadowMaterial.opacity = easeOutCubic(assembly) * (0.95 - growAmount * 0.45);
    this.shadow.scale.setScalar(lerp(0.6, 1, easeOutCubic(assembly)) * (1 + growAmount * 0.2));

    /* Camera-adjacent motion is kept small and legible: a slow turn, a
       forward tilt in the last stage, and a gentle pointer parallax. */
    this.root.rotation.y = -0.34 + story * 0.78 + this.pointer.x * 0.26 + elapsed * 0.028;
    this.root.rotation.x = -0.04 + growAmount * 0.2 - this.pointer.y * 0.16;
    this.root.position.y = -story * 0.34;
    this.root.scale.setScalar(lerp(0.96, 1.04, easeInOutCubic(story)));

    this.reportStage(story);
  }

  reportStage(story) {
    const index = story < 0.3 ? 0 : story < 0.64 ? 1 : 2;
    if (index !== this.activeStage) {
      this.activeStage = index;
      if (this.onStage) this.onStage(index);
    }
  }

  /* ------------------------------------------------------------------ loop */

  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  tick(now) {
    if (!this.running || this.destroyed) return;
    this.rafId = requestAnimationFrame(this.tick);
    if (!this.visible) return;

    const elapsed = (now - this.startTime) / 1000;
    const entrance = easeOutCubic(clamp(elapsed / 1.05, 0, 1));

    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.055;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.055;
    this.renderedProgress += (this.scrollProgress - this.renderedProgress) * 0.09;

    this.applyState(entrance, this.renderedProgress, elapsed);
    this.renderer.render(this.scene, this.camera);

    this.frameCount += 1;
    this.diagnostics.renderFrameCount = this.frameCount;
    this.diagnostics.lastRenderAt = now;

    /* Poster hand-off happens only after pixels have actually been drawn —
       two frames, so the first is not an empty clear. */
    if (this.frameCount === 2) this.confirmFirstFrame('live');
  }

  renderOnce() {
    this.renderer.render(this.scene, this.camera);
    this.frameCount += 1;
    this.diagnostics.renderFrameCount = this.frameCount;
    this.diagnostics.lastRenderAt = performance.now();
  }

  confirmFirstFrame(state) {
    if (this.firstFrameTimer) {
      clearTimeout(this.firstFrameTimer);
      this.firstFrameTimer = 0;
    }
    this.diagnostics.firstFrameAt = performance.now();
    this.setState(state);
  }

  setState(state, error) {
    this.diagnostics.state = state;
    this.diagnostics.posterVisible = state !== 'live';
    if (error) this.diagnostics.error = error;
    if (this.stage) this.stage.dataset.renderState = state;
  }

  /* ------------------------------------------------------------------ bind */

  bind() {
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleScroll();

    if (this.tier !== 'low') {
      this.stage.addEventListener('pointermove', this.handlePointerMove, { passive: true });
      this.stage.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
    }

    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            this.visible = entry.isIntersecting;
            /* Keep the loop alive until a first frame exists, otherwise a
               hero already scrolled past on load would never paint. */
            if (!this.visible && this.frameCount > 2) this.stop();
            else this.start();
          }
        },
        { rootMargin: '120px 0px' }
      );
      this.observer.observe(this.stage);
    }

    this.visibilityHandler = () => {
      if (document.hidden) this.stop();
      else this.start();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  handleScroll() {
    /* Mapped over 1.25 hero heights so all three stages are reached while
       the hero is still in view, not after it has left the screen. */
    const height = this.stage.clientHeight || window.innerHeight;
    const y = window.scrollY || window.pageYOffset || 0;
    this.scrollProgress = clamp(y / (height * 1.25), 0, 1);
  }

  handleResize() {
    if (this.resizeTimer) cancelAnimationFrame(this.resizeTimer);
    this.resizeTimer = requestAnimationFrame(() => {
      this.layout();
      this.handleScroll();
      if (this.reducedMotion) this.renderOnce();
    });
  }

  handlePointerMove(event) {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  }

  handlePointerLeave() {
    this.pointerTarget.x = 0;
    this.pointerTarget.y = 0;
  }

  handleContextLost(event) {
    event.preventDefault();
    this.stop();
    this.setState('failed', 'context-lost');
  }

  handleContextRestored() {
    try {
      this.renderer.resetState?.();
      this.layout();
      this.frameCount = 0;
      this.startTime = performance.now();
      this.setState('poster');
      this.start();
    } catch (error) {
      this.setState('failed', String(error && error.message));
    }
  }

  /* --------------------------------------------------------------- dispose */

  dispose() {
    this.destroyed = true;
    this.stop();

    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.observer?.disconnect();

    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }
    this.stage?.removeEventListener('pointermove', this.handlePointerMove);
    this.stage?.removeEventListener('pointerleave', this.handlePointerLeave);

    for (const item of this.disposables) item?.dispose?.();
    this.disposables.length = 0;
    this.plates.length = 0;
    this.connectors.length = 0;

    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.renderer = null;
    this.scene = null;
  }
}
