import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

var canvas, renderer, currentToy = 0, animId, mouse = { x: 0, y: 0 };
var toys = [];
var sliderEl = null;

function initPlay() {
  canvas = document.getElementById('play-canvas');
  if (!canvas) return;
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  resize();

  canvas.addEventListener('mousemove', function(e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  });
  canvas.addEventListener('mouseleave', function() {
    mouse.x = 0; mouse.y = 0;
  });
  window.addEventListener('resize', resize);

  toys = [createBrickWall, createSunCity, createWaveGrid, createRelaxMesh, createLSystem, createSwarm];
  startToy(0);
}

function resize() {
  if (!canvas || !renderer) return;
  var w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
}

function startToy(index) {
  if (animId) cancelAnimationFrame(animId);
  if (toys[currentToy] && toys[currentToy].cleanup) toys[currentToy].cleanup();
  currentToy = index;
  var label = document.querySelector('.play-switch-label');
  var names = ['bricks', 'shadows', 'wave', 'mesh', 'l-system', 'swarm'];
  var next = (index + 1) % toys.length;
  if (label) label.textContent = names[next];
  if (sliderEl) { sliderEl.remove(); sliderEl = null; }
  toys[index]();
}

window.nextToy = function() {
  startToy((currentToy + 1) % toys.length);
};

var GRID_EXTENT = 250;

// === TOY 1: BRICK WALL (isometric, white fill + black outline, Y-axis rotation) ===
function createBrickWall() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 80;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 3000
  );
  cam.position.set(600, 600, 600);
  cam.lookAt(0, 0, 0);

  var bricks = [];
  var bw = 18, bh = 9, bd = 9, gap = 2;
  var cols = 60, rows = 60;
  var lineMat = new THREE.LineBasicMaterial({ color: '#000000' });
  var fillMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  for (var row = 0; row < rows; row++) {
    var offset = (row % 2) * (bw + gap) / 2;
    for (var col = 0; col < cols; col++) {
      var geo = new THREE.BoxGeometry(bw, bh, bd);
      var fill = new THREE.Mesh(geo, fillMat);
      var edges = new THREE.EdgesGeometry(geo);
      var outline = new THREE.LineSegments(edges, lineMat);

      var group = new THREE.Group();
      group.add(fill);
      group.add(outline);
      group.position.x = col * (bw + gap) + offset - (cols * (bw + gap)) / 2;
      group.position.y = row * (bh + gap) - (rows * (bh + gap)) / 2;
      group.position.z = 0;
      group.userData.baseX = group.position.x;
      group.userData.baseY = group.position.y;
      group.userData.col = col;
      group.userData.row = row;
      group.userData.rotY = 0;
      scene.add(group);
      bricks.push(group);
    }
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;

    var wallW = cols * (bw + gap);
    var wallH = rows * (bh + gap);
    var mx = mouse.x * wallW / 2;
    var my = mouse.y * wallH / 2;

    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      var dx = b.userData.baseX - mx;
      var dy = b.userData.baseY - my;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var radius = 60;
      var influence = Math.max(0, 1 - dist / radius);
      var targetRot = influence * Math.PI * 0.5;
      b.userData.rotY += (targetRot - b.userData.rotY) * 0.08;
      b.rotation.y = b.userData.rotY;
    }

    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createBrickWall.cleanup = function() { scene.clear(); bricks.length = 0; };
}

function convexHull(points) {
  points = points.slice().sort(function(a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var lower = [];
  for (var i = 0; i < points.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], points[i]) <= 0) lower.pop();
    lower.push(points[i]);
  }
  var upper = [];
  for (var i = points.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], points[i]) <= 0) upper.pop();
    upper.push(points[i]);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
function cross(o, a, b) { return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); }

// === TOY 2: SUN & CITY (top-down, all on one ground plane, renderOrder layering) ===
function createSunCity() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 250;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(0, 500, 0);
  cam.lookAt(0, 0, 0);

  var buildings = [];

  // City grid: varied overlapping volumes per block (massing model)
  var streetW = 8;
  var gridCount = 10;
  var blockW = 42, blockD = 42;
  var totalW = gridCount * (blockW + streetW);
  var offX = -totalW / 2, offZ = -totalW / 2;

  for (var bi = 0; bi < gridCount; bi++) {
    for (var bj = 0; bj < gridCount; bj++) {
      var bkCX = offX + bi * (blockW + streetW) + blockW / 2;
      var bkCZ = offZ + bj * (blockD + streetW) + blockD / 2;

      // Each block gets 2-5 overlapping volumes of varied size
      var numVols = 2 + Math.floor(Math.random() * 4);
      for (var v = 0; v < numVols; v++) {
        var sizeType = Math.random();
        var bw, bd;
        if (sizeType < 0.25) {
          bw = 5 + Math.random() * 10; bd = 5 + Math.random() * 10;
        } else if (sizeType < 0.5) {
          bw = 12 + Math.random() * 18; bd = 6 + Math.random() * 12;
        } else if (sizeType < 0.75) {
          bw = 20 + Math.random() * 18; bd = 4 + Math.random() * 7;
          if (Math.random() > 0.5) { var tmp = bw; bw = bd; bd = tmp; }
        } else {
          bw = 14 + Math.random() * 22; bd = 14 + Math.random() * 22;
        }

        var margin = 1;
        var maxOX = (blockW - bw) / 2 - margin;
        var maxOZ = (blockD - bd) / 2 - margin;
        if (maxOX < 0 || maxOZ < 0) continue;

        var bx = bkCX + (Math.random() - 0.5) * 2 * maxOX;
        var bz = bkCZ + (Math.random() - 0.5) * 2 * maxOZ;
        var bHeight = 10 + Math.random() * 90;

        buildings.push({ x: bx, z: bz, w: bw, d: bd, h: bHeight });
      }
    }
  }

  // Sort by height ascending: shortest first, tallest last (renders on top)
  buildings.sort(function(a, b) { return a.h - b.h; });

  // All geometry on ONE ground plane (y=0). Layering via renderOrder only.
  // depthTest disabled so renderOrder fully controls draw order.
  // Per building i (sorted shortest→tallest):
  //   renderOrder i*3     = shadow  (below its own building, above shorter buildings)
  //   renderOrder i*3 + 1 = fill    (white, covers own shadow footprint)
  //   renderOrder i*3 + 2 = outline (black edges on top)
  // A taller building's shadow (renderOrder j*3 where j>i) draws AFTER
  // a shorter building's outline (renderOrder i*3+2), so the shadow
  // appears as black ON the shorter building's white surface.

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000', depthTest: false });
  var fillMat = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false });
  var shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', depthTest: false });

  var shadowMeshes = [];

  for (var i = 0; i < buildings.length; i++) {
    var bld = buildings[i];

    // Fill (white plane on ground)
    var fillGeo = new THREE.PlaneGeometry(bld.w, bld.d);
    var fill = new THREE.Mesh(fillGeo, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(bld.x, 0, bld.z);
    fill.renderOrder = i * 3 + 1;
    scene.add(fill);

    // Outline (black edges on ground)
    var edgesGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(bld.w, bld.d));
    var outline = new THREE.LineSegments(edgesGeo, lineMat);
    outline.rotation.x = -Math.PI / 2;
    outline.position.set(bld.x, 0, bld.z);
    outline.renderOrder = i * 3 + 2;
    scene.add(outline);

    shadowMeshes.push({ mesh: null, order: i * 3 });
  }

  function updateShadows(azimuth, altitude) {
    var dirX = Math.cos(azimuth);
    var dirZ = Math.sin(azimuth);
    var tanAlt = Math.tan(altitude);
    if (tanAlt < 0.1) tanAlt = 0.1;

    for (var i = 0; i < buildings.length; i++) {
      if (shadowMeshes[i].mesh) {
        scene.remove(shadowMeshes[i].mesh);
        shadowMeshes[i].mesh.geometry.dispose();
        shadowMeshes[i].mesh = null;
      }

      var bld = buildings[i];
      var shadowLen = bld.h / tanAlt;
      if (shadowLen > 80) shadowLen = 80;
      var sx = dirX * shadowLen;
      var sz = dirZ * shadowLen;

      var hw = bld.w / 2, hd = bld.d / 2;
      var corners = [
        [bld.x - hw, bld.z - hd],
        [bld.x + hw, bld.z - hd],
        [bld.x + hw, bld.z + hd],
        [bld.x - hw, bld.z + hd]
      ];
      var shifted = corners.map(function(c) { return [c[0] + sx, c[1] + sz]; });
      var hull = convexHull(corners.concat(shifted));

      var shape = new THREE.Shape();
      shape.moveTo(hull[0][0], hull[0][1]);
      for (var hi = 1; hi < hull.length; hi++) shape.lineTo(hull[hi][0], hull[hi][1]);
      shape.closePath();

      var geo = new THREE.ShapeGeometry(shape);
      var mesh = new THREE.Mesh(geo, shadowMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0;
      mesh.renderOrder = shadowMeshes[i].order;
      scene.add(mesh);
      shadowMeshes[i].mesh = mesh;
    }
  }

  updateShadows(Math.PI * 0.75, Math.PI / 4);

  function animate() {
    animId = requestAnimationFrame(animate);

    // mouse.x -> azimuth (0 to π), mouse.y -> altitude (45° to 90°)
    var azimuth = (mouse.x + 1) / 2 * Math.PI;
    var altitude = ((mouse.y + 1) / 2) * (45 * Math.PI / 180) + (45 * Math.PI / 180);
    updateShadows(azimuth, altitude);

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;
    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createSunCity.cleanup = function() {
    scene.clear();
    buildings.length = 0;
    shadowMeshes.length = 0;
  };
}

// === TOY 3: WAVE GRID (isometric, white fill + black outline) ===
function createWaveGrid() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 350;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(500, 500, 500);
  cam.lookAt(0, 0, 0);

  var gridN = 50;
  var spacing = GRID_EXTENT * 2 / gridN;
  var columns = [];
  var startOff = -GRID_EXTENT;
  var cubeSize = spacing * 0.75;

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000' });
  var fillMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  for (var gx = 0; gx < gridN; gx++) {
    for (var gz = 0; gz < gridN; gz++) {
      var geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
      var fill = new THREE.Mesh(geo, fillMat);
      var edges = new THREE.EdgesGeometry(geo);
      var outline = new THREE.LineSegments(edges, lineMat);

      var group = new THREE.Group();
      group.add(fill);
      group.add(outline);
      group.position.x = startOff + gx * spacing + spacing / 2;
      group.position.z = startOff + gz * spacing + spacing / 2;
      group.userData.gx = gx;
      group.userData.gz = gz;
      group.userData.targetY = 0;
      scene.add(group);
      columns.push(group);
    }
  }

  var time = 0;

  function animate() {
    animId = requestAnimationFrame(animate);
    time += 0.02;
    var mx = (mouse.x * 0.5 + 0.5) * gridN;
    var my = (mouse.y * 0.5 + 0.5) * gridN;

    for (var i = 0; i < columns.length; i++) {
      var c = columns[i];
      var dx = c.userData.gx - mx;
      var dz = c.userData.gz - my;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var wave = Math.sin(dist * 0.4 - time * 3) * Math.max(0, 1 - dist / 20) * 50;
      var ambient = Math.sin(c.userData.gx * 0.3 + time) * Math.cos(c.userData.gz * 0.3 + time * 0.7) * 6;
      c.userData.targetY = wave + ambient;
      c.position.y += (c.userData.targetY - c.position.y) * 0.1;
      c.scale.y = 1 + Math.abs(c.position.y) / 25;
    }

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;
    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createWaveGrid.cleanup = function() { scene.clear(); columns.length = 0; };
}

// === TOY 4: DYNAMIC RELAXATION MESH (isometric, matched domain with wave) ===
function createRelaxMesh() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 350;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(500, 500, 500);
  cam.lookAt(0, 0, 0);

  var gridN = 28;
  var restLength = GRID_EXTENT * 2 / (gridN - 1);
  var nodes = [];
  var springs = [];
  var startOff = -GRID_EXTENT;
  var load = 0.5;

  for (var i = 0; i < gridN; i++) {
    for (var j = 0; j < gridN; j++) {
      var pinned = (i === 0 || i === gridN - 1 || j === 0 || j === gridN - 1);
      nodes.push({
        x: startOff + i * restLength,
        y: 0,
        z: startOff + j * restLength,
        vx: 0, vy: 0, vz: 0,
        pinned: pinned,
        gi: i, gj: j
      });
    }
  }

  for (var i = 0; i < gridN; i++) {
    for (var j = 0; j < gridN; j++) {
      var idx = i * gridN + j;
      if (j < gridN - 1) springs.push([idx, idx + 1, restLength]);
      if (i < gridN - 1) springs.push([idx, idx + gridN, restLength]);
    }
  }

  var linePositions = new Float32Array(springs.length * 6);
  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  var lineMat = new THREE.LineBasicMaterial({ color: '#000000' });
  var lineMesh = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lineMesh);

  sliderEl = document.createElement('input');
  sliderEl.type = 'range';
  sliderEl.min = '0';
  sliderEl.max = '100';
  sliderEl.value = '50';
  sliderEl.style.cssText = 'position:absolute;bottom:60px;left:50%;transform:translateX(-50%);width:180px;opacity:0.7;accent-color:#000;';
  canvas.parentElement.appendChild(sliderEl);
  sliderEl.addEventListener('input', function() {
    load = sliderEl.value / 100;
  });

  var stiffness = 0.5;
  var damping = 0.9;

  function simulate() {
    var gravity = load * 1.2;
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].pinned) nodes[i].vy += gravity;
    }

    for (var s = 0; s < springs.length; s++) {
      var sp = springs[s];
      var a = nodes[sp[0]], b = nodes[sp[1]];
      var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 0.001) continue;
      var force = (dist - sp[2]) * stiffness;
      var fx = dx/dist*force, fy = dy/dist*force, fz = dz/dist*force;
      if (!a.pinned) { a.vx += fx; a.vy += fy; a.vz += fz; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; b.vz -= fz; }
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.pinned) continue;
      n.vx *= damping; n.vy *= damping; n.vz *= damping;
      n.x += n.vx; n.y += n.vy; n.z += n.vz;
    }
  }

  function updateLines() {
    var pos = lineGeo.attributes.position.array;
    for (var s = 0; s < springs.length; s++) {
      var a = nodes[springs[s][0]], b = nodes[springs[s][1]];
      pos[s*6] = a.x; pos[s*6+1] = a.y; pos[s*6+2] = a.z;
      pos[s*6+3] = b.x; pos[s*6+4] = b.y; pos[s*6+5] = b.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    for (var step = 0; step < 4; step++) simulate();
    updateLines();

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;
    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createRelaxMesh.cleanup = function() {
    scene.clear();
    nodes.length = 0;
    springs.length = 0;
  };
}

// === TOY 5: L-SYSTEM TREE (2D, click to grow) ===
function createLSystem() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 300;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 1000
  );
  cam.position.set(0, 0, 500);
  cam.lookAt(0, 0, 0);

  var treeGroup = new THREE.Group();
  treeGroup.position.y = -frustum * 0.85;
  scene.add(treeGroup);

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000' });
  var iterations = 2;
  var maxIterations = 6;
  var baseAngle = 22 + Math.random() * 10;

  function generateString(n) {
    var axiom = 'F';
    var rules = 'FF+[+F-F-F]-[-F+F+F]';
    var current = axiom;
    for (var i = 0; i < n; i++) {
      var next = '';
      for (var c = 0; c < current.length; c++) {
        next += current[c] === 'F' ? rules : current[c];
      }
      current = next;
    }
    return current;
  }

  function drawTree(str, angle, initLen) {
    while (treeGroup.children.length > 0) treeGroup.remove(treeGroup.children[0]);

    var stack = [];
    var x = 0, y = 0, dir = Math.PI / 2;
    var len = initLen;
    var positions = [];
    var depth = 0;

    for (var c = 0; c < str.length; c++) {
      var ch = str[c];
      if (ch === 'F') {
        var nx = x + Math.cos(dir) * len;
        var ny = y + Math.sin(dir) * len;
        positions.push(x, y, 0, nx, ny, 0);
        x = nx; y = ny;
      } else if (ch === '+') {
        dir += angle * (1 + (Math.random() - 0.5) * 0.3);
      } else if (ch === '-') {
        dir -= angle * (1 + (Math.random() - 0.5) * 0.3);
      } else if (ch === '[') {
        stack.push({ x: x, y: y, dir: dir, len: len, depth: depth });
        depth++;
        len *= 0.7;
      } else if (ch === ']') {
        var s = stack.pop();
        if (s) { x = s.x; y = s.y; dir = s.dir; len = s.len; depth = s.depth; }
      }
    }

    if (positions.length > 0) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      var lines = new THREE.LineSegments(geo, lineMat);
      treeGroup.add(lines);
    }
  }

  function grow() {
    if (iterations >= maxIterations) {
      iterations = 0;
      baseAngle = 22 + Math.random() * 10;
    }
    iterations++;
    var str = generateString(iterations);
    var len = 100 / Math.pow(1.8, iterations - 1);
    var rad = baseAngle * Math.PI / 180;
    drawTree(str, rad, len);
  }

  grow();

  var clickHandler = function() { grow(); };
  canvas.addEventListener('click', clickHandler);

  function animate() {
    animId = requestAnimationFrame(animate);
    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;
    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createLSystem.cleanup = function() {
    canvas.removeEventListener('click', clickHandler);
    scene.clear();
  };
}

// === TOY 6: SWARM (2D, cursor = black attractor, particles chase it) ===
function createSwarm() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 200;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 1000
  );
  cam.position.set(0, 0, 500);
  cam.lookAt(0, 0, 0);

  var numParticles = 80;
  var particles = [];
  var particleMeshes = [];
  var trails = [];

  var attractorGeo = new THREE.CircleGeometry(4, 16);
  var attractorMat = new THREE.MeshBasicMaterial({ color: '#000000' });
  var attractor = new THREE.Mesh(attractorGeo, attractorMat);
  scene.add(attractor);

  var particleMat = new THREE.MeshBasicMaterial({ color: '#000000' });

  for (var i = 0; i < numParticles; i++) {
    var size = 1 + Math.random() * 2;
    var geo = new THREE.CircleGeometry(size, 8);
    var mesh = new THREE.Mesh(geo, particleMat);
    var px = (Math.random() - 0.5) * frustum * aspect * 1.5;
    var py = (Math.random() - 0.5) * frustum * 1.5;
    mesh.position.set(px, py, 0);
    scene.add(mesh);
    particleMeshes.push(mesh);
    particles.push({
      x: px, y: py,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: size
    });

    var trailGeo = new THREE.BufferGeometry();
    var trailPositions = new Float32Array(20 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    var trailMat = new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.15 });
    var trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    trails.push({ line: trailLine, history: [] });
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;

    var ax = mouse.x * frustum * a2;
    var ay = mouse.y * frustum;
    attractor.position.set(ax, ay, 1);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var dx = ax - p.x;
      var dy = ay - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        var force = Math.min(0.8, 30 / (dist + 10));
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      for (var j = 0; j < particles.length; j++) {
        if (i === j) continue;
        var ox = p.x - particles[j].x;
        var oy = p.y - particles[j].y;
        var od = Math.sqrt(ox * ox + oy * oy);
        if (od < 15 && od > 0.1) {
          var repel = 0.3 / od;
          p.vx += (ox / od) * repel;
          p.vy += (oy / od) * repel;
        }
      }

      p.vx *= 0.96;
      p.vy *= 0.96;
      p.x += p.vx;
      p.y += p.vy;

      particleMeshes[i].position.set(p.x, p.y, 0);

      var trail = trails[i];
      trail.history.push({ x: p.x, y: p.y });
      if (trail.history.length > 10) trail.history.shift();
      var tpos = trail.line.geometry.attributes.position.array;
      for (var t = 0; t < 10; t++) {
        var hi = Math.min(t, trail.history.length - 1);
        var h = trail.history[hi];
        tpos[t * 3] = h.x;
        tpos[t * 3 + 1] = h.y;
        tpos[t * 3 + 2] = -1;
      }
      trail.line.geometry.attributes.position.needsUpdate = true;
    }

    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createSwarm.cleanup = function() {
    scene.clear();
    particles.length = 0;
    particleMeshes.length = 0;
    trails.length = 0;
  };
}

// Start when play page is shown
function hookShowPage() {
  var origShowPage = window.showPage;
  if (!origShowPage) return;
  window.showPage = function(id) {
    origShowPage(id);
    if (id === 'play') {
      setTimeout(function() {
        if (!renderer) initPlay();
        else startToy(currentToy);
      }, 0);
    } else {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    }
  };
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', hookShowPage);
} else {
  hookShowPage();
}
