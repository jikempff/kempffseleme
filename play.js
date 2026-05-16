import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

var canvas, renderer, currentToy = 0, animId, mouse = { x: 0, y: 0 };
var toys = [];

function initPlay() {
  canvas = document.getElementById('play-canvas');
  if (!canvas) return;
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

  toys = [createBrickWall, createSunCity, createWaveGrid, createRelaxMesh, createLSystem, createTurnerEVA];
  startToy(0);
}

function resize() {
  if (!canvas || !renderer) return;
  var w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
}

function startToy(index) {
  if (animId) cancelAnimationFrame(animId);
  if (toys[index] && toys[index].cleanup) toys[index].cleanup();
  currentToy = index;
  var label = document.querySelector('.play-switch-label');
  var names = ['bricks', 'sun & city', 'wave grid', 'mesh', 'l-system', 'eva'];
  var next = (index + 1) % toys.length;
  if (label) label.textContent = names[next];
  toys[index]();
}

window.nextToy = function() {
  startToy((currentToy + 1) % toys.length);
};

// === TOY 1: BRICK WALL (isometric) ===
function createBrickWall() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f5f5f5');
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 280;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(400, 400, 400);
  cam.lookAt(0, 0, 0);

  var bricks = [];
  var bw = 36, bh = 18, bd = 18, gap = 3;
  var cols = 14, rows = 16;

  for (var row = 0; row < rows; row++) {
    var offset = (row % 2) * (bw + gap) / 2;
    for (var col = 0; col < cols; col++) {
      var geo = new THREE.BoxGeometry(bw, bh, bd);
      var mat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.8 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = col * (bw + gap) + offset - (cols * (bw + gap)) / 2;
      mesh.position.y = row * (bh + gap) - (rows * (bh + gap)) / 2;
      mesh.position.z = 0;
      mesh.userData.baseX = mesh.position.x;
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.col = col;
      mesh.userData.row = row;
      mesh.userData.rotZ = 0;
      scene.add(mesh);
      bricks.push(mesh);
    }
  }

  var light = new THREE.DirectionalLight('#ffffff', 1.5);
  light.position.set(300, 500, 400);
  scene.add(light);
  scene.add(new THREE.AmbientLight('#ffffff', 0.5));

  var accentColor = new THREE.Color('#0a0a0a');
  var baseColor = new THREE.Color('#e8e8e8');

  function animate() {
    animId = requestAnimationFrame(animate);
    var mx = mouse.x * cols * 0.5;
    var my = mouse.y * rows * 0.5;
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      var dc = b.userData.col - (cols / 2 + mx);
      var dr = b.userData.row - (rows / 2 + my);
      var dist = Math.sqrt(dc * dc + dr * dr);
      var radius = 5;
      var influence = Math.max(0, 1 - dist / radius);
      var targetRot = influence * Math.PI * 0.5;
      b.userData.rotZ += (targetRot - b.userData.rotZ) * 0.08;
      b.rotation.z = b.userData.rotZ;
      b.material.color.copy(baseColor).lerp(accentColor, influence * 0.7);
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

  createBrickWall.cleanup = function() {
    scene.clear();
    bricks.length = 0;
  };
}

// === TOY 2: SUN & CITY (top view, realistic layout) ===
function createSunCity() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f0f0f0');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 320;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(0, 600, 0);
  cam.lookAt(0, 0, 0);

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var buildings = [];
  var streetW = 14;

  var blocks = [
    { x: -120, z: -120, w: 80, d: 80 },
    { x: 0, z: -120, w: 100, d: 80 },
    { x: 120, z: -120, w: 70, d: 80 },
    { x: -120, z: 0, w: 80, d: 90 },
    { x: 20, z: 0, w: 120, d: 90 },
    { x: 160, z: 0, w: 60, d: 90 },
    { x: -100, z: 120, w: 100, d: 70 },
    { x: 60, z: 130, w: 90, d: 60 },
    { x: 170, z: 120, w: 50, d: 70 },
  ];

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    var numB = 3 + Math.floor(Math.random() * 5);
    for (var i = 0; i < numB; i++) {
      var bHeight = 30 + Math.random() * 140;
      var bWidth = 12 + Math.random() * (block.w * 0.4);
      var bDepth = 12 + Math.random() * (block.d * 0.4);
      var geo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      var shade = 0.82 + Math.random() * 0.18;
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shade, shade, shade),
        roughness: 0.9
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        block.x + (Math.random() - 0.5) * (block.w - bWidth),
        bHeight / 2,
        block.z + (Math.random() - 0.5) * (block.d - bDepth)
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      buildings.push(mesh);
    }
  }

  var sun = new THREE.DirectionalLight('#ffffff', 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  scene.add(new THREE.AmbientLight('#ffffff', 0.25));

  function animate() {
    animId = requestAnimationFrame(animate);
    var sunX = mouse.x * 300;
    var sunZ = mouse.y * 300;
    var sunY = 500;
    sun.position.set(sunX, sunY, sunZ);
    sun.target.position.set(sunX * 0.3, 0, sunZ * 0.3);
    sun.target.updateMatrixWorld();

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
  };
}

// === TOY 3: WAVE GRID (isometric) ===
function createWaveGrid() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#fafafa');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var frustum = 260;
  var aspect = w / h;
  var cam = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 2000
  );
  cam.position.set(300, 300, 300);
  cam.lookAt(0, 0, 0);

  var gridN = 30;
  var spacing = 14;
  var columns = [];
  var startOff = -(gridN - 1) * spacing / 2;

  for (var gx = 0; gx < gridN; gx++) {
    for (var gz = 0; gz < gridN; gz++) {
      var geo = new THREE.BoxGeometry(10, 10, 10);
      var shade = 0.1 + (gx + gz) / (gridN * 2) * 0.3;
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shade, shade, shade),
        roughness: 0.7
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = startOff + gx * spacing;
      mesh.position.z = startOff + gz * spacing;
      mesh.userData.gx = gx;
      mesh.userData.gz = gz;
      mesh.userData.targetY = 0;
      scene.add(mesh);
      columns.push(mesh);
    }
  }

  var light = new THREE.DirectionalLight('#ffffff', 1.8);
  light.position.set(200, 400, 200);
  scene.add(light);
  scene.add(new THREE.AmbientLight('#ffffff', 0.4));

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
      var wave = Math.sin(dist * 0.5 - time * 3) * Math.max(0, 1 - dist / 18) * 60;
      var ambient = Math.sin(c.userData.gx * 0.3 + time) * Math.cos(c.userData.gz * 0.3 + time * 0.7) * 8;
      c.userData.targetY = wave + ambient;
      c.position.y += (c.userData.targetY - c.position.y) * 0.1;
      c.scale.y = 1 + Math.abs(c.position.y) / 30;

      var brightness = 0.15 + Math.abs(c.position.y) / 80;
      c.material.color.setRGB(brightness, brightness, brightness);
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

  createWaveGrid.cleanup = function() {
    scene.clear();
    columns.length = 0;
  };
}

// === TOY 4: DYNAMIC RELAXATION MESH ===
function createRelaxMesh() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f8f8f8');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var cam = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
  cam.position.set(250, 300, 250);
  cam.lookAt(0, 0, 0);

  var gridN = 24;
  var restLength = 12;
  var nodes = [];
  var springs = [];
  var startOff = -(gridN - 1) * restLength / 2;

  for (var i = 0; i < gridN; i++) {
    for (var j = 0; j < gridN; j++) {
      nodes.push({
        x: startOff + i * restLength,
        y: 0,
        z: startOff + j * restLength,
        vx: 0, vy: 0, vz: 0,
        pinned: (i === 0 && j === 0) || (i === gridN-1 && j === 0) ||
                (i === 0 && j === gridN-1) || (i === gridN-1 && j === gridN-1),
        gi: i, gj: j
      });
    }
  }

  for (var i = 0; i < gridN; i++) {
    for (var j = 0; j < gridN; j++) {
      var idx = i * gridN + j;
      if (j < gridN - 1) springs.push([idx, idx + 1, restLength]);
      if (i < gridN - 1) springs.push([idx, idx + gridN, restLength]);
      if (i < gridN - 1 && j < gridN - 1) springs.push([idx, idx + gridN + 1, restLength * 1.414]);
      if (i < gridN - 1 && j > 0) springs.push([idx, idx + gridN - 1, restLength * 1.414]);
    }
  }

  var positions = new Float32Array(gridN * gridN * 3);
  var indices = [];
  for (var i = 0; i < gridN - 1; i++) {
    for (var j = 0; j < gridN - 1; j++) {
      var a = i * gridN + j;
      var b = a + 1;
      var c = a + gridN;
      var d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  var meshMat = new THREE.MeshStandardMaterial({
    color: '#1a1a1a',
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
    wireframe: false
  });
  var meshObj = new THREE.Mesh(geo, meshMat);
  scene.add(meshObj);

  var wireMat = new THREE.MeshBasicMaterial({ color: '#333333', wireframe: true });
  var wireObj = new THREE.Mesh(geo, wireMat);
  scene.add(wireObj);

  var light = new THREE.DirectionalLight('#ffffff', 1.6);
  light.position.set(150, 300, 150);
  scene.add(light);
  scene.add(new THREE.AmbientLight('#ffffff', 0.4));

  var accentLight = new THREE.PointLight('#00ffcc', 0.6, 300);
  accentLight.position.set(0, 50, 0);
  scene.add(accentLight);

  var stiffness = 0.4;
  var damping = 0.92;
  var gravity = -0.3;

  function simulate() {
    var mx = (mouse.x * 0.5 + 0.5) * gridN;
    var mz = (mouse.y * 0.5 + 0.5) * gridN;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.pinned) continue;
      var dx = n.gi - mx;
      var dz = n.gj - mz;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 6) {
        var pull = (6 - dist) / 6 * 40;
        n.vy -= pull;
      }
      n.vy += gravity;
    }

    for (var s = 0; s < springs.length; s++) {
      var sp = springs[s];
      var a = nodes[sp[0]], b = nodes[sp[1]];
      var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 0.001) continue;
      var force = (dist - sp[2]) * stiffness;
      var fx = dx / dist * force;
      var fy = dy / dist * force;
      var fz = dz / dist * force;
      if (!a.pinned) { a.vx += fx; a.vy += fy; a.vz += fz; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; b.vz -= fz; }
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.pinned) continue;
      n.vx *= damping; n.vy *= damping; n.vz *= damping;
      n.x += n.vx; n.y += n.vy; n.z += n.vz;
      if (n.y < -150) { n.y = -150; n.vy *= -0.3; }
    }
  }

  function updateGeometry() {
    var pos = geo.attributes.position.array;
    for (var i = 0; i < nodes.length; i++) {
      pos[i*3] = nodes[i].x;
      pos[i*3+1] = nodes[i].y;
      pos[i*3+2] = nodes[i].z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    simulate();
    updateGeometry();

    accentLight.position.set(mouse.x * 120, 50, mouse.y * 120);

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    cam.aspect = w2 / h2;
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

// === TOY 5: L-SYSTEM TREE ===
function createLSystem() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#fafafa');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var cam = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
  cam.position.set(0, 150, 300);
  cam.lookAt(0, 80, 0);

  var light = new THREE.DirectionalLight('#ffffff', 1.5);
  light.position.set(100, 300, 200);
  scene.add(light);
  scene.add(new THREE.AmbientLight('#ffffff', 0.4));

  var accentLight = new THREE.PointLight('#ff3366', 0.4, 250);
  accentLight.position.set(0, 100, 0);
  scene.add(accentLight);

  var treeGroup = new THREE.Group();
  scene.add(treeGroup);

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  var branchMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7 });
  var tipMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.5 });

  function buildTree(iterations, angle, lengthFactor) {
    while (treeGroup.children.length > 0) treeGroup.remove(treeGroup.children[0]);

    var stack = [];
    var segments = [];
    var state = { x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0, len: 30, depth: 0 };

    var rules = 'F[+F][-F][>F][<F]';
    var axiom = 'F';
    var current = axiom;
    for (var i = 0; i < iterations; i++) {
      var next = '';
      for (var c = 0; c < current.length; c++) {
        next += current[c] === 'F' ? rules : current[c];
      }
      current = next;
    }

    var rad = angle * Math.PI / 180;
    var pos = new THREE.Vector3(0, 0, 0);
    var dir = new THREE.Vector3(0, 1, 0);
    var len = 30;
    var depth = 0;

    for (var c = 0; c < current.length && segments.length < 2000; c++) {
      var ch = current[c];
      if (ch === 'F') {
        var end = pos.clone().add(dir.clone().multiplyScalar(len * Math.pow(lengthFactor, depth)));
        segments.push({ start: pos.clone(), end: end.clone(), depth: depth });
        pos.copy(end);
      } else if (ch === '+') {
        dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), rad + (Math.random() - 0.5) * 0.2);
      } else if (ch === '-') {
        dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), -rad - (Math.random() - 0.5) * 0.2);
      } else if (ch === '>') {
        dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), rad + (Math.random() - 0.5) * 0.2);
      } else if (ch === '<') {
        dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), -rad - (Math.random() - 0.5) * 0.2);
      } else if (ch === '[') {
        stack.push({ pos: pos.clone(), dir: dir.clone(), depth: depth });
        depth++;
      } else if (ch === ']') {
        var s = stack.pop();
        if (s) { pos.copy(s.pos); dir.copy(s.dir); depth = s.depth; }
      }
    }

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var mid = seg.start.clone().add(seg.end).multiplyScalar(0.5);
      var segLen = seg.start.distanceTo(seg.end);
      var radius = Math.max(0.5, 3 - seg.depth * 0.6);

      var geo = new THREE.CylinderGeometry(radius * 0.6, radius, segLen, 6);
      var mat = seg.depth > 2 ? tipMat : branchMat;
      var mesh = new THREE.Mesh(geo, mat);

      mesh.position.copy(mid);
      var direction = seg.end.clone().sub(seg.start).normalize();
      var quat = new THREE.Quaternion();
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      mesh.quaternion.copy(quat);

      treeGroup.add(mesh);
    }
  }

  var growTimer = 0;
  var currentIterations = 3;
  var targetAngle = 25;
  var regrowInterval = 4;

  buildTree(currentIterations, targetAngle, 0.7);

  function animate() {
    animId = requestAnimationFrame(animate);
    growTimer += 0.016;

    if (growTimer > regrowInterval) {
      growTimer = 0;
      targetAngle = 18 + Math.random() * 20;
      currentIterations = 3 + Math.floor(Math.random() * 2);
      buildTree(currentIterations, targetAngle, 0.65 + Math.random() * 0.1);
    }

    treeGroup.rotation.y += 0.003;
    var tiltX = mouse.y * 0.15;
    var tiltZ = mouse.x * 0.15;
    treeGroup.rotation.x += (tiltX - treeGroup.rotation.x) * 0.05;
    treeGroup.rotation.z += (tiltZ - treeGroup.rotation.z) * 0.05;

    accentLight.position.set(mouse.x * 100, 120, mouse.y * 100);

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    cam.aspect = w2 / h2;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createLSystem.cleanup = function() {
    scene.clear();
  };
}

// === TOY 6: TURNER EVA ===
function createTurnerEVA() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f5f5f5');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var cam = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
  cam.position.set(0, 80, 250);
  cam.lookAt(0, 40, 0);

  var light = new THREE.DirectionalLight('#ffffff', 1.4);
  light.position.set(100, 200, 150);
  light.castShadow = true;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;
  scene.add(light);
  scene.add(new THREE.AmbientLight('#ffffff', 0.5));

  var accentLight = new THREE.PointLight('#6644ff', 0.5, 200);
  scene.add(accentLight);

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var bodyMat = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.3, metalness: 0.2 });
  var darkMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  var jointMat = new THREE.MeshStandardMaterial({ color: '#444444', roughness: 0.4 });

  var eva = new THREE.Group();

  var torso = new THREE.Mesh(new THREE.BoxGeometry(14, 20, 10), bodyMat);
  torso.position.y = 55;
  torso.castShadow = true;
  eva.add(torso);

  var head = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), bodyMat);
  head.position.y = 72;
  head.castShadow = true;
  eva.add(head);

  var visor = new THREE.Mesh(
    new THREE.SphereGeometry(4, 12, 8, 0, Math.PI),
    darkMat
  );
  visor.position.y = 72;
  visor.position.z = 3;
  eva.add(visor);

  var backpack = new THREE.Mesh(new THREE.BoxGeometry(12, 16, 6), darkMat);
  backpack.position.set(0, 56, -8);
  backpack.castShadow = true;
  eva.add(backpack);

  var armL = new THREE.Group();
  var upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2, 14, 8), bodyMat);
  upperArmL.position.y = -7;
  armL.add(upperArmL);
  var lowerArmL = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.8, 12, 8), bodyMat);
  lowerArmL.position.y = -16;
  armL.add(lowerArmL);
  var jointL = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 8), jointMat);
  jointL.position.y = -13;
  armL.add(jointL);
  armL.position.set(-10, 62, 0);
  eva.add(armL);

  var armR = new THREE.Group();
  var upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2, 14, 8), bodyMat);
  upperArmR.position.y = -7;
  armR.add(upperArmR);
  var lowerArmR = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.8, 12, 8), bodyMat);
  lowerArmR.position.y = -16;
  armR.add(lowerArmR);
  var jointR = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 8), jointMat);
  jointR.position.y = -13;
  armR.add(jointR);
  armR.position.set(10, 62, 0);
  eva.add(armR);

  var legL = new THREE.Group();
  var upperLegL = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.5, 16, 8), bodyMat);
  upperLegL.position.y = -8;
  legL.add(upperLegL);
  var lowerLegL = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 14, 8), bodyMat);
  lowerLegL.position.y = -20;
  legL.add(lowerLegL);
  var bootL = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 8), darkMat);
  bootL.position.set(0, -28, 1);
  legL.add(bootL);
  legL.position.set(-5, 45, 0);
  eva.add(legL);

  var legR = new THREE.Group();
  var upperLegR = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.5, 16, 8), bodyMat);
  upperLegR.position.y = -8;
  legR.add(upperLegR);
  var lowerLegR = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 14, 8), bodyMat);
  lowerLegR.position.y = -20;
  legR.add(lowerLegR);
  var bootR = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 8), darkMat);
  bootR.position.set(0, -28, 1);
  legR.add(bootR);
  legR.position.set(5, 45, 0);
  eva.add(legR);

  eva.position.set((Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 60);
  scene.add(eva);

  var targetPos = new THREE.Vector3();
  var time = 0;
  var walkCycle = 0;

  function animate() {
    animId = requestAnimationFrame(animate);
    time += 0.016;

    targetPos.set(mouse.x * 120, 0, -mouse.y * 80);
    var dx = targetPos.x - eva.position.x;
    var dz = targetPos.z - eva.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 5) {
      var speed = Math.min(dist * 0.02, 1.5);
      eva.position.x += (dx / dist) * speed;
      eva.position.z += (dz / dist) * speed;
      walkCycle += speed * 0.15;

      var angle = Math.atan2(dx, dz);
      var currentY = eva.rotation.y;
      var diff = angle - currentY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      eva.rotation.y += diff * 0.05;

      var swing = Math.sin(walkCycle) * 0.4;
      armL.rotation.x = swing;
      armR.rotation.x = -swing;
      legL.rotation.x = -swing * 0.6;
      legR.rotation.x = swing * 0.6;

      torso.rotation.z = Math.sin(walkCycle * 0.5) * 0.02;
    } else {
      armL.rotation.x *= 0.9;
      armR.rotation.x *= 0.9;
      legL.rotation.x *= 0.9;
      legR.rotation.x *= 0.9;

      var idle = Math.sin(time * 2) * 0.03;
      torso.position.y = 55 + Math.sin(time * 1.5) * 0.5;
      head.rotation.y = Math.sin(time * 0.8) * 0.1;
    }

    accentLight.position.set(eva.position.x, 80, eva.position.z);

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    cam.aspect = w2 / h2;
    cam.updateProjectionMatrix();
    resize();
    renderer.render(scene, cam);
  }
  animate();

  createTurnerEVA.cleanup = function() {
    scene.clear();
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
