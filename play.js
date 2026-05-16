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

var toyNames = ['bricks', 'shadows', 'wave', 'mesh', 'l-system', 'swarm'];
var toyInstructions = [
  'move cursor to rotate bricks',
  'move cursor to change sun angle',
  'move cursor to create waves',
  'drag slider to adjust load',
  'click to grow tree',
  'move cursor to attract swarm'
];

function startToy(index) {
  if (animId) cancelAnimationFrame(animId);
  if (toys[currentToy] && toys[currentToy].cleanup) toys[currentToy].cleanup();
  currentToy = index;
  var nextLabel = document.querySelector('.play-switch-label-next');
  var prevLabel = document.querySelector('.play-switch-label-prev');
  var titleEl = document.getElementById('play-title');
  var instrEl = document.getElementById('play-instructions');
  var next = (index + 1) % toys.length;
  var prev = (index - 1 + toys.length) % toys.length;
  if (nextLabel) nextLabel.textContent = toyNames[next];
  if (prevLabel) prevLabel.textContent = toyNames[prev];
  if (titleEl) titleEl.textContent = toyNames[index];
  if (instrEl) instrEl.textContent = toyInstructions[index];
  if (sliderEl) { sliderEl.remove(); sliderEl = null; }
  toys[index]();
}

window.nextToy = function() {
  startToy((currentToy + 1) % toys.length);
};

window.prevToy = function() {
  startToy((currentToy - 1 + toys.length) % toys.length);
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

// === TOY 2: SUN & CITY (top-down, single-polygon buildings, proper shadows) ===
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

  // Generate a building footprint as a single polygon (L, T, U, or rect)
  function genFootprint(cx, cz, maxW, maxD) {
    var type = Math.floor(Math.random() * 5);
    var pts = [];
    if (type <= 1) {
      // Rectangle
      var bw = 8 + Math.random() * (maxW - 8);
      var bd = 6 + Math.random() * (maxD - 6);
      pts = [[-bw/2,-bd/2],[bw/2,-bd/2],[bw/2,bd/2],[-bw/2,bd/2]];
    } else if (type === 2) {
      // L-shape
      var bw = 14 + Math.random() * (maxW - 14);
      var bd = 14 + Math.random() * (maxD - 14);
      var cw = bw * (0.35 + Math.random() * 0.3);
      var cd = bd * (0.35 + Math.random() * 0.3);
      pts = [
        [-bw/2, -bd/2], [bw/2, -bd/2], [bw/2, bd/2 - cd],
        [-bw/2 + (bw - cw), bd/2 - cd], [-bw/2 + (bw - cw), bd/2], [-bw/2, bd/2]
      ];
    } else if (type === 3) {
      // T-shape
      var bw = 16 + Math.random() * (maxW - 16);
      var bd = 16 + Math.random() * (maxD - 16);
      var stemW = bw * (0.3 + Math.random() * 0.25);
      var barD = bd * (0.25 + Math.random() * 0.2);
      pts = [
        [-bw/2, bd/2 - barD], [-bw/2, bd/2], [bw/2, bd/2], [bw/2, bd/2 - barD],
        [stemW/2, bd/2 - barD], [stemW/2, -bd/2],
        [-stemW/2, -bd/2], [-stemW/2, bd/2 - barD]
      ];
    } else {
      // U-shape
      var bw = 14 + Math.random() * (maxW - 14);
      var bd = 14 + Math.random() * (maxD - 14);
      var iw = bw * (0.3 + Math.random() * 0.25);
      var id = bd * (0.3 + Math.random() * 0.25);
      pts = [
        [-bw/2, -bd/2], [bw/2, -bd/2], [bw/2, bd/2],
        [iw/2, bd/2], [iw/2, bd/2 - id], [-iw/2, bd/2 - id],
        [-iw/2, bd/2], [-bw/2, bd/2]
      ];
    }
    // Random 90° rotation
    var rot = Math.floor(Math.random() * 4);
    for (var r = 0; r < rot; r++) {
      pts = pts.map(function(p) { return [-p[1], p[0]]; });
    }
    return pts.map(function(p) { return [p[0] + cx, p[1] + cz]; });
  }

  var buildings = [];
  var streetW = 20;
  var gridCount = 8;
  var blockW = 36, blockD = 36;
  var totalW = gridCount * (blockW + streetW);
  var offX = -totalW / 2, offZ = -totalW / 2;

  for (var bi = 0; bi < gridCount; bi++) {
    for (var bj = 0; bj < gridCount; bj++) {
      var bkCX = offX + bi * (blockW + streetW) + blockW / 2;
      var bkCZ = offZ + bj * (blockD + streetW) + blockD / 2;
      if (Math.random() < 0.08) continue; // occasional empty block
      var pts = genFootprint(bkCX, bkCZ, blockW - 4, blockD - 4);
      var bHeight = 8 + Math.random() * 40;
      buildings.push({ pts: pts, h: bHeight });
    }
  }

  var lineMat = new THREE.LineBasicMaterial({ color: '#000000', depthTest: false, depthWrite: false });
  var fillMat = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  var shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', depthTest: false, depthWrite: false, side: THREE.DoubleSide });

  var n = buildings.length;

  // Layer 1: single shadow mesh — renderOrder 1
  var shadowGeo = new THREE.BufferGeometry();
  var shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.frustumCulled = false;
  shadowMesh.renderOrder = 1;
  scene.add(shadowMesh);

  // Layer 2: individual fills — renderOrder 2
  // Layer 3: individual outlines — renderOrder 3
  for (var i = 0; i < n; i++) {
    var pts = buildings[i].pts;

    // Use ShapeGeometry directly (it handles concave polygons via earcut)
    var fillShape = new THREE.Shape();
    fillShape.moveTo(pts[0][0], pts[0][1]);
    for (var p = 1; p < pts.length; p++) fillShape.lineTo(pts[p][0], pts[p][1]);
    fillShape.closePath();
    var fill = new THREE.Mesh(new THREE.ShapeGeometry(fillShape), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.renderOrder = 2;
    fill.frustumCulled = false;
    scene.add(fill);

    // Outline from polygon edges
    var lv = [];
    for (var p = 0; p < pts.length; p++) {
      var p2 = (p + 1) % pts.length;
      lv.push(pts[p][0], pts[p][1], 0, pts[p2][0], pts[p2][1], 0);
    }
    var lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3));
    var outline = new THREE.LineSegments(lg, lineMat);
    outline.rotation.x = -Math.PI / 2;
    outline.renderOrder = 3;
    outline.frustumCulled = false;
    scene.add(outline);
  }

  // Shadow: Minkowski sum built from ShapeGeometry triangles + edge quads
  function updateShadows(azimuth, altitude) {
    var dirX = Math.cos(azimuth);
    var dirZ = Math.sin(azimuth);
    var tanAlt = Math.tan(altitude);
    if (tanAlt < 0.3) tanAlt = 0.3;

    var verts = [];

    for (var i = 0; i < n; i++) {
      var bld = buildings[i];
      var pts = bld.pts;
      var groundLen = bld.h / tanAlt;
      if (groundLen > 25) groundLen = 25;
      var sx = dirX * groundLen;
      var sz = dirZ * groundLen;

      // Helper: extract indexed triangle verts from ShapeGeometry as flat [x,y,x,y,...]
      function extractTris(polyPts) {
        var sh = new THREE.Shape();
        sh.moveTo(polyPts[0][0], polyPts[0][1]);
        for (var k = 1; k < polyPts.length; k++) sh.lineTo(polyPts[k][0], polyPts[k][1]);
        sh.closePath();
        var g = new THREE.ShapeGeometry(sh);
        var pa = g.attributes.position;
        var ix = g.index;
        var out = [];
        if (ix) {
          for (var k = 0; k < ix.count; k++) {
            var vi = ix.getX(k);
            out.push(pa.getX(vi), pa.getY(vi));
          }
        } else {
          for (var k = 0; k < pa.count; k++) {
            out.push(pa.getX(k), pa.getY(k));
          }
        }
        g.dispose();
        return out;
      }

      // Original footprint
      var ft = extractTris(pts);
      for (var t = 0; t < ft.length; t += 2) {
        verts.push(ft[t], ft[t+1], 0);
      }

      // Shifted footprint
      var shifted = [];
      for (var k = 0; k < pts.length; k++) shifted.push([pts[k][0] + sx, pts[k][1] + sz]);
      var st = extractTris(shifted);
      for (var t = 0; t < st.length; t += 2) {
        verts.push(st[t], st[t+1], 0);
      }

      // Edge quads (2 tris each)
      for (var k = 0; k < pts.length; k++) {
        var k2 = (k + 1) % pts.length;
        verts.push(pts[k][0], pts[k][1], 0);
        verts.push(pts[k2][0], pts[k2][1], 0);
        verts.push(pts[k2][0] + sx, pts[k2][1] + sz, 0);

        verts.push(pts[k][0], pts[k][1], 0);
        verts.push(pts[k2][0] + sx, pts[k2][1] + sz, 0);
        verts.push(pts[k][0] + sx, pts[k][1] + sz, 0);
      }
    }

    shadowGeo.dispose();
    shadowGeo = new THREE.BufferGeometry();
    shadowGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    shadowMesh.geometry = shadowGeo;
  }

  // Shadow mesh also needs rotation to go from XY shape-space to XZ world-space
  shadowMesh.rotation.x = -Math.PI / 2;

  updateShadows(Math.PI * 0.75, Math.PI / 3);

  var lastAz = -999, lastAl = -999;

  function animate() {
    animId = requestAnimationFrame(animate);

    var azimuth = (mouse.x + 1) / 2 * Math.PI;
    var altitude = ((mouse.y + 1) / 2) * (45 * Math.PI / 180) + (45 * Math.PI / 180);
    if (Math.abs(azimuth - lastAz) > 0.01 || Math.abs(altitude - lastAl) > 0.01) {
      updateShadows(azimuth, altitude);
      lastAz = azimuth;
      lastAl = altitude;
    }

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    var a2 = w2 / h2;
    cam.left = -frustum * a2;
    cam.right = frustum * a2;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.updateProjectionMatrix();
    resize();
    renderer.sortObjects = false;
    renderer.render(scene, cam);
    renderer.sortObjects = true;
  }
  animate();

  createSunCity.cleanup = function() {
    shadowGeo.dispose();
    scene.clear();
    buildings.length = 0;
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
