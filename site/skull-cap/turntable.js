/* The generated knit material wraps real cap geometry, rotating about its y axis. */
const view = document.querySelector('[data-cap-view]');
if (view) {
  const load = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      load.disconnect();
      init().catch(() => { view.dataset.state = 'still'; });
    }
  }, {rootMargin: '250px'});
  load.observe(view);
}

async function init() {
  const T = await import('./vendor/three.module.min.js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.querySelector('[data-cap-pause]');
  const canvas = view.querySelector('canvas');
  const renderer = new T.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, 1.85, 5.2);
  camera.lookAt(0, 0.74, 0);
  scene.add(new T.HemisphereLight(0xffffff, 0x66645f, 3));
  const key = new T.DirectionalLight(0xfffcf6, 3.7);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const fill = new T.DirectionalLight(0xe9efff, 1.5);
  fill.position.set(4, 2, -3);
  scene.add(fill);

  const knit = await new T.TextureLoader().loadAsync('/assets/thinking-cap/charcoal-knit.webp');
  knit.wrapS = knit.wrapT = T.RepeatWrapping;
  knit.repeat.set(3.5, 1.2);
  knit.colorSpace = T.SRGBColorSpace;
  knit.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bump = knit.clone();
  bump.colorSpace = T.NoColorSpace;
  const cloth = new T.MeshPhysicalMaterial({color: 0x848484, map: knit, bumpMap: bump,
    bumpScale: 0.016, roughness: 1, metalness: 0, sheen: 0.8, sheenColor: new T.Color(0x777777),
    sheenRoughness: 0.9, side: T.DoubleSide});
  // Brush-applied matte pigment follows the cloth in object space as it turns.
  // Keep the original knit bump: the finish adds color without filling its loops.
  const finishedCloth = cloth.clone();
  finishedCloth.onBeforeCompile = shader => {
    shader.uniforms.capPigment = {value: new T.Color(0x777777)};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCapClothPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCapClothPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCapClothPosition;
        uniform vec3 capPigment;
        float capGrain(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float capNoise(vec3 p) {
          vec3 cell = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(capGrain(cell), capGrain(cell + vec3(1,0,0)), f.x),
                mix(capGrain(cell + vec3(0,1,0)), capGrain(cell + vec3(1,1,0)), f.x), f.y),
            mix(mix(capGrain(cell + vec3(0,0,1)), capGrain(cell + vec3(1,0,1)), f.x),
                mix(capGrain(cell + vec3(0,1,1)), capGrain(cell + vec3(1,1,1)), f.x), f.y), f.z);
        }
      `)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 brushPoint = vCapClothPosition * vec3(2.3, 2.8, 2.3) + vec3(3.2, 1.9, 7.5);
        float cloud = 0.58 * capNoise(brushPoint)
                    + 0.28 * capNoise(brushPoint * 2.13 + 4.7)
                    + 0.14 * capNoise(brushPoint * 4.31 + 8.2);
        float ridge = smoothstep(0.10, 0.33, texture2D(bumpMap, vBumpMapUv).r);
        float coverage = mix(0.025, 0.38, smoothstep(0.30, 0.70, cloud));
        coverage *= mix(0.45, 1.0, ridge);
        coverage *= mix(0.82, 1.12, capNoise(brushPoint * 28.0));
        coverage *= smoothstep(0.01, 0.06, vCapClothPosition.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, capPigment, coverage);
      `);
  };
  finishedCloth.customProgramCacheKey = () => 'cap-brushed-pigment-v1';
  const thread = new T.MeshStandardMaterial({color: 0xe3d8c2, roughness: 1});
  const seamThread = new T.MeshStandardMaterial({color: 0x333333, roughness: 1});
  const cap = new T.Group();
  cap.rotation.y = 0.35;
  scene.add(cap);
  const tau = Math.PI * 2;
  const random = seed => {
    const value = Math.sin(seed * 12.9898 + 4.1414) * 43758.5453;
    return value - Math.floor(value);
  };
  const angleDistance = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function surface(a, t, lift = 0) {
    const crown = Math.max(0, t - 0.18) / 0.82;
    const base = Math.pow(Math.max(0, 1 - Math.pow(crown, 2.2)), 1 / 2.2);
    const body = Math.sin(t * Math.PI);
    const seamPhase = Math.sin(2 * (a - Math.PI / 4));
    const seam = 0.022 * Math.exp(-Math.pow(seamPhase / 0.065, 2)) * body;
    // A shallow join with soft fabric lips, as the pressed seams in the tutorial.
    const seamLips = 0.008 * Math.exp(-Math.pow((Math.abs(seamPhase) - 0.08) / 0.055, 2)) * body;
    const panels = 0.016 * Math.cos(4 * a + 0.12) * Math.pow(body, 1.2);
    const ripple = (0.011 * Math.sin(a * 9 + t * 14) + 0.007 * Math.cos(a * 4)) * Math.pow(1 - t, 2);
    // Shallow unequal folds interrupt the smooth dome, like soft sewn knit.
    const frontFold = Math.exp(-Math.pow(angleDistance(a, 0.58) / 0.17, 2));
    const backFold = Math.exp(-Math.pow(angleDistance(a, 3.55) / 0.21, 2));
    const folds = (0.046 * frontFold + 0.036 * backFold) * Math.exp(-Math.pow((t - 0.64) / 0.27, 2)) * body;
    const r = base * (0.982 + 0.018 * body) - seam + seamLips - folds + panels + ripple + lift;
    const hemWave = (0.011 * Math.sin(a * 3 + 0.4) + 0.006 * Math.cos(a * 7)) * Math.pow(1 - t, 3);
    const uneven = (0.016 * Math.sin(a * 3 + 0.4) + 0.009 * Math.cos(a * 5)) * body;
    const crownDip = 0.042 * Math.exp(-Math.pow(base / 0.25, 2));
    return new T.Vector3(r * Math.sin(a) + 0.065 * Math.pow(t, 3),
      t * 1.5 - crownDip + hemWave + uneven,
      r * Math.cos(a) * 0.84 - 0.035 * Math.pow(t, 3));
  }

  const positions = [], uvs = [], indices = [];
  const slices = 160, rings = 100;
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= slices; i++) {
      const p = surface(i / slices * tau, j / rings);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / slices, j / rings);
      if (j < rings && i < slices) {
        const n = j * (slices + 1) + i;
        indices.push(n, n + 1, n + slices + 1, n + 1, n + slices + 2, n + slices + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  cap.add(new T.Mesh(geometry, finishedCloth));

  // A narrow soft edge, rather than a turned-up ribbed cuff.
  const hem = [];
  for (let i = 0; i <= 200; i++) hem.push(surface(i / 200 * tau, 0.004));
  cord(hem, 0.012, cloth, 200);
  const inside = new T.Mesh(geometry, cloth.clone());
  inside.scale.set(0.982, 0.985, 0.982);
  inside.position.y = 0.012;
  cap.add(inside);

  function cord(points, radius, material = thread, segments = 80) {
    const path = new T.CatmullRomCurve3(points);
    const mesh = new T.Mesh(new T.TubeGeometry(path, segments, radius, 5, false), material);
    cap.add(mesh);
  }
  for (let k = 0; k < 4; k++) {
    const points = [];
    for (let i = 0; i <= 65; i++) points.push(surface(Math.PI / 4 + k * Math.PI / 2, i / 65 * 0.998, 0.001));
    cord(points, 0.0018, seamThread, 70);
  }

  // Larger, uneven machine-darned barbs; each crossed stitch has its own angle.
  const repeats = 14, bandT = 0.13;
  const bandCenter = a => bandT + Math.sin(a * 3 + 0.6) * 0.005 + Math.sin(a * 7) * 0.003;
  for (let strand = -1; strand <= 1; strand += 2) {
    const points = [];
    for (let i = 0; i <= 560; i++) {
      const a = i / 560 * tau;
      const wave = Math.sin(a * repeats + 0.3) * 0.005 + Math.sin(a * 19) * 0.002;
      const spread = 0.006 + 0.005 * (1 - Math.cos(a * repeats + 0.3)) / 2;
      points.push(surface(a, bandCenter(a) + wave + strand * spread, 0.005));
    }
    cord(points, 0.0027, thread, 560);
  }
  for (let k = 0; k < repeats; k++) {
    const a = k * tau / repeats + (random(k + 4) - 0.5) * 0.05;
    const center = bandCenter(a);
    // Alternate loose and tight clusters while keeping each wrap densely stitched.
    const widthPhase = (k * 0.61803398875 + random(k + 81) * 0.14) % 1;
    const width = 0.026 + widthPhase * 0.104;
    const wraps = Math.max(5, Math.round(width / 0.0065) + 1);
    for (let wrap = 0; wrap < wraps; wrap++) {
      const points = [];
      const seed = k * 23 + wrap * 3;
      const offset = (wrap / (wraps - 1) - 0.5) * width;
      const height = 0.034 + random(seed + 12) * 0.024;
      const lean = (random(seed + 32) - 0.5) * 0.023;
      for (let j = 0; j <= 14; j++) {
        const s = j / 14;
        const wobble = 0.002 * Math.sin(s * Math.PI * 3 + seed) * Math.sin(s * Math.PI);
        points.push(surface(a + offset + lean * (s - 0.5) + wobble,
          center + (s - 0.5) * height + (random(seed + 3) - 0.5) * 0.01,
          0.006 + 0.003 * Math.sin(s * Math.PI)));
      }
      cord(points, 0.0028, thread, 14);
    }
    for (const side of [-1, 1]) {
      for (const slope of [-1, 1]) {
        const seed = k * 31 + side * 7 + slope * 3;
        const reach = 0.11 + random(seed + 7) * 0.055;
        const span = 0.049 + random(seed + 24) * 0.037;
        const offset = side * (width * 0.5 + 0.016 + random(seed + 52) * 0.012);
        const vertical = (random(seed + 14) - 0.5) * 0.022;
        const points = [];
        for (let j = 0; j <= 10; j++) {
          const s = j / 10 - 0.5;
          const wobble = Math.sin((s + 0.5) * Math.PI) * 0.002 * Math.sin(seed + s * 8);
          points.push(surface(a + offset + s * span + wobble,
            center + vertical + slope * s * reach,
            0.005 + 0.003 * Math.sin((s + 0.5) * Math.PI)));
        }
        cord(points, 0.0024 + random(seed + 93) * 0.0005, thread, 12);
      }
    }
  }

  let running = !reduced.matches, visible = false, dragging = false, previous = 0, frame = 0;
  function label() {
    button.textContent = running ? button.dataset.pause : button.dataset.play;
    button.setAttribute('aria-pressed', String(!running));
  }
  function draw() { renderer.render(scene, camera); }
  function tick(now) {
    frame = 0;
    if (running && visible && !document.hidden && !dragging) {
      cap.rotation.y += Math.min((now - previous) / 1000, 0.05) * tau / 42;
      draw();
    }
    previous = now;
    schedule();
  }
  function schedule() {
    if (!frame && running && visible && !document.hidden && !dragging) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const {width, height} = view.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }
  new ResizeObserver(resize).observe(view);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    previous = performance.now();
    schedule();
  }, {threshold: 0.05}).observe(view);
  document.addEventListener('visibilitychange', () => { previous = performance.now(); schedule(); });
  reduced.addEventListener('change', () => { running = !reduced.matches; label(); schedule(); });
  button.addEventListener('click', () => { running = !running; label(); previous = performance.now(); schedule(); });
  let lastX = 0;
  view.addEventListener('pointerdown', event => {
    dragging = true; lastX = event.clientX; view.setPointerCapture(event.pointerId);
    view.classList.add('is-dragging');
  });
  view.addEventListener('pointermove', event => {
    if (!dragging) return;
    cap.rotation.y += (event.clientX - lastX) * 0.012;
    lastX = event.clientX; draw();
  });
  function release() { dragging = false; view.classList.remove('is-dragging'); previous = performance.now(); schedule(); }
  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', release);
  view.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); cap.rotation.y += event.key === 'ArrowRight' ? 0.18 : -0.18; draw();
    }
  });
  canvas.addEventListener('webglcontextlost', () => { view.classList.remove('has-model'); button.hidden = true; running = false; });
  resize(); label(); button.hidden = false;
  view.dataset.state = 'ready';
  view.classList.add('has-model');
}
