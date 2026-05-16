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

  toys = [createBrickWall, createSunCity, createWaveGrid];
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
  var names = ['bricks', 'sun & city', 'wave grid'];
  var next = (index + 1) % toys.length;
  if (label) label.textContent = names[next];
  toys[index]();
}

window.nextToy = function() {
  startToy((currentToy + 1) % toys.length);
};

// === TOY 1: BRICK WALL ===
function createBrickWall() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f5f5f5');
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var cam = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, 1, 1000);
  cam.position.set(0, 0, 500);

  var cols = Math.ceil(w / 52) + 2;
  var rows = Math.ceil(h / 28) + 2;
  var bricks = [];
  var bw = 48, bh = 24, gap = 4;

  for (var row = 0; row < rows; row++) {
    var offset = (row % 2) * (bw + gap) / 2;
    for (var col = 0; col < cols; col++) {
      var geo = new THREE.BoxGeometry(bw, bh, 12);
      var mat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.8 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = col * (bw + gap) + offset - w / 2;
      mesh.position.y = row * (bh + gap) - h / 2;
      mesh.userData.baseX = mesh.position.x;
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.rotZ = 0;
      scene.add(mesh);
      bricks.push(mesh);
    }
  }

  var light = new THREE.DirectionalLight('#ffffff', 1.5);
  light.position.set(200, 300, 400);
  scene.add(light);
  scene.add(new THREE.AmbientLight('#ffffff', 0.5));

  var accentColor = new THREE.Color('#0a0a0a');
  var baseColor = new THREE.Color('#e8e8e8');

  function animate() {
    animId = requestAnimationFrame(animate);
    var mx = (mouse.x * 0.5 + 0.5) * w - w / 2;
    var my = (mouse.y * 0.5 + 0.5) * h - h / 2;
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      var dx = b.userData.baseX - mx;
      var dy = b.userData.baseY - my;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var radius = 180;
      var influence = Math.max(0, 1 - dist / radius);
      var targetRot = influence * Math.PI * 0.5;
      b.userData.rotZ += (targetRot - b.userData.rotZ) * 0.08;
      b.rotation.z = b.userData.rotZ;
      b.material.color.copy(baseColor).lerp(accentColor, influence * 0.7);
    }
    resize();
    renderer.render(scene, cam);
    cam.left = -canvas.clientWidth / 2;
    cam.right = canvas.clientWidth / 2;
    cam.top = canvas.clientHeight / 2;
    cam.bottom = -canvas.clientHeight / 2;
    cam.updateProjectionMatrix();
  }
  animate();

  createBrickWall.cleanup = function() {
    scene.clear();
    bricks.length = 0;
  };
}

// === TOY 2: SUN & CITY ===
function createSunCity() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f0f0f0');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var aspect = w / h;
  var cam = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
  cam.position.set(0, 250, 400);
  cam.lookAt(0, 0, 0);

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var buildings = [];
  var gridSize = 7;
  var spacing = 50;
  var startOff = -(gridSize - 1) * spacing / 2;

  for (var gx = 0; gx < gridSize; gx++) {
    for (var gz = 0; gz < gridSize; gz++) {
      if (Math.random() < 0.25) continue;
      var bHeight = 20 + Math.random() * 120;
      var bWidth = 18 + Math.random() * 22;
      var bDepth = 18 + Math.random() * 22;
      var geo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      var shade = 0.85 + Math.random() * 0.15;
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shade, shade, shade),
        roughness: 0.9
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        startOff + gx * spacing + (Math.random() - 0.5) * 15,
        bHeight / 2,
        startOff + gz * spacing + (Math.random() - 0.5) * 15
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      buildings.push(mesh);
    }
  }

  var sun = new THREE.DirectionalLight('#fff5e6', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -400;
  sun.shadow.camera.right = 400;
  sun.shadow.camera.top = 400;
  sun.shadow.camera.bottom = -400;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1000;
  scene.add(sun);
  scene.add(new THREE.AmbientLight('#b0c4de', 0.3));

  var sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#ffcc44' })
  );
  scene.add(sunSphere);

  function animate() {
    animId = requestAnimationFrame(animate);
    var sunX = mouse.x * 350;
    var sunZ = mouse.y * 350;
    var sunY = 300;
    sun.position.set(sunX, sunY, sunZ);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
    sunSphere.position.copy(sun.position);

    var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
    cam.aspect = w2 / h2;
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

// === TOY 3: WAVE GRID ===
function createWaveGrid() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#fafafa');

  var w = canvas.clientWidth, h = canvas.clientHeight;
  var cam = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
  cam.position.set(0, 300, 350);
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
    cam.aspect = w2 / h2;
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
