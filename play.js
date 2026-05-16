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

// === TOY 1: BRICK WALL (isometric orthographic, neverending) ===
function createBrickWall() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 120;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(400, 400, 400);
  cam.lookAt(0, 0, 0);

  var bricks = [];
  var bw = 18, bh = 9, bd = 9, gap = 2;
  var cols = 22, rows = 22;
  var lineMat = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 1 });

  function createWall() {
    for (var row = 0; row < rows; row++) {
      var offset = (row % 2) * (bw + gap) / 2;
      for (var col = 0; col < cols; col++) {
        var geo = new THREE.BoxGeometry(bw, bh, bd);
        var edges = new THREE.EdgesGeometry(geo);
        var line = new THREE.LineSegments(edges, lineMat);
        line.position.x = col * (bw + gap) + offset - (cols * (bw + gap)) / 2;
        line.position.y = row * (bh + gap) - (rows * (bh + gap)) / 2;
        line.position.z = 0;
        line.userData.baseX = line.position.x;
        line.userData.baseY = line.position.y;
        line.userData.col = col;
        line.userData.row = row;
        line.userData.rotZ = 0;
        scene.add(line);
        bricks.push(line);
      }
    }
  }
  createWall();

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
      b.userData.rotZ += (targetRot - b.userData.rotZ) * 0.08;
      b.rotation.z = b.userData.rotZ;
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

// === TOY 2: SUN & CITY (top-down, vector shadows, outlines) ===
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
  var shadows = [];
  var outlines = [];

  var blocks = [
    { x: -180, z: -180, w: 90, d: 70 },
    { x: -60, z: -180, w: 100, d: 70 },
    { x: 70, z: -180, w: 80, d: 70 },
    { x: 180, z: -180, w: 60, d: 70 },
    { x: -180, z: -80, w: 90, d: 80 },
    { x: -60, z: -80, w: 100, d: 80 },
    { x: 70, z: -80, w: 80, d: 80 },
    { x: 180, z: -80, w: 60, d: 80 },
    { x: -180, z: 30, w: 90, d: 75 },
    { x: -60, z: 30, w: 100, d: 75 },
    { x: 70, z: 30, w: 80, d: 75 },
    { x: 180, z: 30, w: 60, d: 75 },
    { x: -180, z: 140, w: 90, d: 70 },
    { x: -60, z: 140, w: 100, d: 70 },
    { x: 70, z: 140, w: 80, d: 70 },
    { x: 180, z: 140, w: 60, d: 70 },
  ];

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 1 });
  var shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.15 });
  var buildingFillMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    var numB = 4 + Math.floor(Math.random() * 4);
    for (var i = 0; i < numB; i++) {
      var bw = 10 + Math.random() * (block.w * 0.35);
      var bd = 10 + Math.random() * (block.d * 0.35);
      var bHeight = 30 + Math.random() * 160;
      var bx = block.x + (Math.random() - 0.5) * (block.w - bw) * 0.8;
      var bz = block.z + (Math.random() - 0.5) * (block.d - bd) * 0.8;

      buildings.push({ x: bx, z: bz, w: bw, d: bd, h: bHeight });

      var fillGeo = new THREE.PlaneGeometry(bw, bd);
      var fill = new THREE.Mesh(fillGeo, buildingFillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(bx, 2, bz);
      scene.add(fill);

      var outlineGeo = new THREE.PlaneGeometry(bw, bd);
      var edgesGeo = new THREE.EdgesGeometry(outlineGeo);
      var outline = new THREE.LineSegments(edgesGeo, lineMat);
      outline.rotation.x = -Math.PI / 2;
      outline.position.set(bx, 3, bz);
      scene.add(outline);
      outlines.push(outline);
    }
  }

  var shadowGroup = new THREE.Group();
  shadowGroup.position.y = 0.5;
  scene.add(shadowGroup);

  function updateShadows(sunDirX, sunDirZ) {
    while (shadowGroup.children.length > 0) {
      shadowGroup.remove(shadowGroup.children[0]);
    }

    var len = Math.sqrt(sunDirX * sunDirX + sunDirZ * sunDirZ);
    if (len < 0.01) return;

    for (var i = 0; i < buildings.length; i++) {
      var bld = buildings[i];
      var shadowLen = bld.h * 0.6;
      var sx = (sunDirX / len) * shadowLen;
      var sz = (sunDirZ / len) * shadowLen;

      var shape = new THREE.Shape();
      var hw = bld.w / 2, hd = bld.d / 2;
      shape.moveTo(bld.x - hw, bld.z - hd);
      shape.lineTo(bld.x + hw, bld.z - hd);
      shape.lineTo(bld.x + hw, bld.z + hd);
      shape.lineTo(bld.x - hw, bld.z + hd);
      shape.lineTo(bld.x - hw, bld.z - hd);
      shape.lineTo(bld.x - hw + sx, bld.z - hd + sz);
      shape.lineTo(bld.x + hw + sx, bld.z - hd + sz);
      shape.lineTo(bld.x + hw + sx, bld.z + hd + sz);
      shape.lineTo(bld.x - hw + sx, bld.z + hd + sz);
      shape.lineTo(bld.x - hw + sx, bld.z - hd + sz);

      var geo = new THREE.ShapeGeometry(shape);
      var mesh = new THREE.Mesh(geo, shadowMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.5;
      shadowGroup.add(mesh);
    }
  }

  updateShadows(0.5, 0.5);

  function animate() {
    animId = requestAnimationFrame(animate);

    var sunDirX = -mouse.x;
    var sunDirZ = mouse.y;
    updateShadows(sunDirX, sunDirZ);

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
    shadows.length = 0;
    outlines.length = 0;
  };
}

// === TOY 3: WAVE GRID (isometric orthographic) ===
function createWaveGrid() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 220;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(300, 300, 300);
  cam.lookAt(0, 0, 0);

  var gridN = 40;
  var spacing = 11;
  var columns = [];
  var startOff = -(gridN - 1) * spacing / 2;

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 1 });

  for (var gx = 0; gx < gridN; gx++) {
    for (var gz = 0; gz < gridN; gz++) {
      var geo = new THREE.BoxGeometry(8, 8, 8);
      var edges = new THREE.EdgesGeometry(geo);
      var line = new THREE.LineSegments(edges, lineMat);
      line.position.x = startOff + gx * spacing;
      line.position.z = startOff + gz * spacing;
      line.userData.gx = gx;
      line.userData.gz = gz;
      line.userData.targetY = 0;
      scene.add(line);
      columns.push(line);
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

// === TOY 4: DYNAMIC RELAXATION MESH (isometric, slider controls load) ===
function createRelaxMesh() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 200;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(250, 250, 250);
  cam.lookAt(0, 0, 0);

  var gridN = 20;
  var restLength = 10;
  var nodes = [];
  var springs = [];
  var startOff = -(gridN - 1) * restLength / 2;
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

  var boundaryPositions = [];
  for (var i = 0; i < gridN - 1; i++) {
    boundaryPositions.push(startOff + i * restLength, 0, startOff);
    boundaryPositions.push(startOff + (i+1) * restLength, 0, startOff);
    boundaryPositions.push(startOff + i * restLength, 0, startOff + (gridN-1)*restLength);
    boundaryPositions.push(startOff + (i+1) * restLength, 0, startOff + (gridN-1)*restLength);
    boundaryPositions.push(startOff, 0, startOff + i * restLength);
    boundaryPositions.push(startOff, 0, startOff + (i+1) * restLength);
    boundaryPositions.push(startOff + (gridN-1)*restLength, 0, startOff + i * restLength);
    boundaryPositions.push(startOff + (gridN-1)*restLength, 0, startOff + (i+1) * restLength);
  }

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
    var gravity = -load * 1.2;
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
  treeGroup.position.y = -frustum + 20;
  scene.add(treeGroup);

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000' });
  var iterations = 0;
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
    var len = 40 / Math.pow(1.6, iterations - 1);
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
var origShowPage = window.showPage || function() {};
window.addEventListener('DOMContentLoaded', function() {
  origShowPage = window.showPage;
  window.showPage = function(id) {
    origShowPage(id);
    if (id === 'play') {
      if (!renderer) initPlay();
      else startToy(currentToy);
    } else {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    }
  };
});
