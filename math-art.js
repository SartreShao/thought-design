// Sacred Geometry - Three.js Implementation
const container = document.getElementById('canvas-container');
const subtitle = document.getElementById('art-subtitle');

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 400;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize for high DPI but limit to 2
renderer.setClearColor(0x000000, 1);
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enablePan = false;

// Mathematical Constants & Configuration
const PARTICLE_COUNT = 60000;
const STATES = ['The Fibonacci Sphere', 'The Torus Knot', 'The Lorenz Attractor'];
let currentState = 0;
let nextState = 1;
let transitionProgress = 0;
const transitionSpeed = 0.002; // How fast to morph
let holdTimer = 0;
const HOLD_DURATION = 400; // Frames to hold a shape before transitioning

// Arrays to hold calculated mathematical positions
const positions = {
    fibonacci: new Float32Array(PARTICLE_COUNT * 3),
    torus: new Float32Array(PARTICLE_COUNT * 3),
    lorenz: new Float32Array(PARTICLE_COUNT * 3)
};

// Current buffer being rendered
const currentPositions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);

// ------------------------------------------------------------------
// 1. Generate Fibonacci Sphere
// ------------------------------------------------------------------
const radius = 150;
const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2; // y goes from 1 to -1
    const r = Math.sqrt(1 - y * y); // radius at y
    const theta = phi * i; // golden angle increment

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    positions.fibonacci[i * 3] = x * radius;
    positions.fibonacci[i * 3 + 1] = y * radius;
    positions.fibonacci[i * 3 + 2] = z * radius;
}

// ------------------------------------------------------------------
// 2. Generate Torus Knot
// ------------------------------------------------------------------
const p = 3, q = 7; // Knot parameters
for (let i = 0; i < PARTICLE_COUNT; i++) {
    // We map particles along the length of the knot, adding slight random offset for volume
    const t = (i / PARTICLE_COUNT) * Math.PI * 2 * q * 2;
    
    // Base knot formula
    const r = 60 * (2 + Math.sin(q * t / p));
    let x = r * Math.cos(p * t / q);
    let y = r * Math.sin(p * t / q);
    let z = 60 * Math.cos(q * t / p);
    
    // Add volume noise (makes it look like a tube of particles instead of a thin line)
    const noise = 15;
    x += (Math.random() - 0.5) * noise;
    y += (Math.random() - 0.5) * noise;
    z += (Math.random() - 0.5) * noise;

    positions.torus[i * 3] = x;
    positions.torus[i * 3 + 1] = y;
    positions.torus[i * 3 + 2] = z;
}

// ------------------------------------------------------------------
// 3. Generate Lorenz Attractor
// ------------------------------------------------------------------
// Simulate the differential equation to get points
let lx = 0.1, ly = 0, lz = 0;
const sigma = 10, rho = 28, beta = 8/3;
const dt = 0.005;

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const dx = sigma * (ly - lx) * dt;
    const dy = (lx * (rho - lz) - ly) * dt;
    const dz = (lx * ly - beta * lz) * dt;
    
    lx += dx;
    ly += dy;
    lz += dz;
    
    // Scale and center the attractor
    const scale = 4.5;
    positions.lorenz[i * 3] = lx * scale;
    positions.lorenz[i * 3 + 1] = (lz - 25) * scale; // Offset Z to center it vertically
    positions.lorenz[i * 3 + 2] = ly * scale;
}

// ------------------------------------------------------------------
// Color Mapping (Spatial HSL to RGB)
// ------------------------------------------------------------------
const color = new THREE.Color();
for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Base color on its index (which correlates to its position in the mathematical sequences)
    const h = (i / PARTICLE_COUNT) * 1.2; // Hue maps from 0 to 1.2 across the particles
    const s = 0.8;
    const l = 0.6;
    
    color.setHSL(h % 1.0, s, l);
    
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
}

// ------------------------------------------------------------------
// Create Geometry and Particle System
// ------------------------------------------------------------------
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Custom Shader Material for glowing, circular particles
const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
});

// To make particles circular instead of square (requires loading a texture, but we can hack it via canvas or use default)
// For raw math art, the raw additive blend squares are often beautiful, but let's make a quick procedural circle texture
const circleCanvas = document.createElement('canvas');
circleCanvas.width = 32;
circleCanvas.height = 32;
const ctx = circleCanvas.getContext('2d');
ctx.beginPath();
ctx.arc(16, 16, 14, 0, Math.PI * 2);
ctx.fillStyle = '#ffffff';
ctx.fill();
// Add a soft glow edge
ctx.shadowBlur = 4;
ctx.shadowColor = '#ffffff';
const circleTexture = new THREE.CanvasTexture(circleCanvas);
material.map = circleTexture;

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// ------------------------------------------------------------------
// Animation Loop (Morphing Logic)
// ------------------------------------------------------------------
const getBufferForState = (stateIdx) => {
    if (stateIdx === 0) return positions.fibonacci;
    if (stateIdx === 1) return positions.torus;
    if (stateIdx === 2) return positions.lorenz;
};

// Smooth easing function (Cubic In/Out)
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function animate() {
    requestAnimationFrame(animate);

    // Morphing Logic
    if (holdTimer > 0) {
        holdTimer--;
    } else {
        transitionProgress += transitionSpeed;
        
        if (transitionProgress >= 1) {
            // Transition complete
            transitionProgress = 0;
            currentState = nextState;
            nextState = (nextState + 1) % STATES.length;
            holdTimer = HOLD_DURATION;
            
            // Update UI Subtitle
            subtitle.style.opacity = 0;
            setTimeout(() => {
                subtitle.textContent = STATES[currentState];
                subtitle.style.opacity = 1;
            }, 1000);
        }
    }

    // Interpolate positions
    const posAttribute = geometry.attributes.position;
    const currentBuffer = getBufferForState(currentState);
    const nextBuffer = getBufferForState(nextState);
    const easedProgress = easeInOutCubic(transitionProgress);

    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        // Linear interpolation (lerp)
        currentPositions[i] = currentBuffer[i] + (nextBuffer[i] - currentBuffer[i]) * easedProgress;
    }
    posAttribute.needsUpdate = true;

    // Slowly rotate the entire system for an ambient feel
    particleSystem.rotation.y += 0.001;
    particleSystem.rotation.x += 0.0005;

    controls.update();
    renderer.render(scene, camera);
}

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the math art
holdTimer = HOLD_DURATION / 2; // Initial hold
animate();
