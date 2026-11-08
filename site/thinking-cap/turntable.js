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
  camera.position.set(0, 2.05, 5.2);
  camera.lookAt(0, 0.82, 0);
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
  const thread = new T.MeshStandardMaterial({color: 0xe3d8c2, roughness: 1});
  const seamThread = new T.MeshStandardMaterial({color: 0x202020, roughness: 1});
  const cap = new T.Group();
  cap.rotation.y = 0.35;
  scene.add(cap);
  const tau = Math.PI * 2;

  function surface(a, t, lift = 0) {
    const crown = Math.max(0, t - 0.22) / 0.78;
    const base = Math.sqrt(Math.max(0, 1 - crown * crown));
    const seam = 0.009 * Math.exp(-Math.pow(Math.sin(2 * (a - Math.PI / 4)) / 0.035, 2)) * Math.sin(t * Math.PI);
    const ripple = (0.008 * Math.sin(a * 9 + t * 14) + 0.004 * Math.cos(a * 4)) * Math.pow(1 - t, 3);
    const r = base * (0.982 + 0.018 * Math.sin(t * Math.PI)) - seam + ripple + lift;
    return new T.Vector3(r * Math.sin(a), t * 1.66 + 0.004 * Math.cos(a * 2) * (1 - t), r * Math.cos(a) * 0.92);
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
  cap.add(new T.Mesh(geometry, cloth));

  // A narrow soft edge, rather than a turned-up ribbed cuff.
  const hem = new T.Mesh(new T.TorusGeometry(0.984, 0.012, 8, 160), cloth);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.92;
  hem.position.y = 0.006;
  cap.add(hem);
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
    cord(points, 0.0025, seamThread, 70);
  }

  // Parallel wandering strands, dense wraps and crossed thread barbs.
  const repeats = 14, bandT = 0.105;
  for (let strand = -1; strand <= 1; strand += 2) {
    const points = [];
    for (let i = 0; i <= 560; i++) {
      const a = i / 560 * tau;
      const wave = Math.sin(a * repeats) * 0.006 + Math.sin(a * repeats * 2) * 0.002;
      const spread = 0.004 + 0.005 * (1 - Math.cos(a * repeats)) / 2;
      points.push(surface(a, bandT + wave + strand * spread, 0.005));
    }
    cord(points, 0.0027, thread, 560);
  }
  for (let k = 0; k < repeats; k++) {
    const a = k * tau / repeats;
    for (let wrap = -2; wrap <= 2; wrap++) {
      const points = [];
      for (let j = 0; j <= 14; j++) {
        const s = j / 14;
        points.push(surface(a + wrap * 0.006 + 0.004 * Math.sin(s * Math.PI), bandT - 0.014 + 0.028 * s, 0.006 + 0.003 * Math.sin(s * Math.PI)));
      }
      cord(points, 0.0028, thread, 14);
    }
    for (const side of [-1, 1]) {
      for (const slope of [-1, 1]) {
        const points = [];
        for (let j = 0; j <= 10; j++) {
          const s = j / 10 - 0.5;
          points.push(surface(a + side * 0.026 + s * 0.027, bandT + slope * s * 0.067, 0.005 + 0.003 * Math.sin((s + 0.5) * Math.PI)));
        }
        cord(points, 0.0025, thread, 12);
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
