const canvas = document.getElementById('attractorCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let dpr = window.devicePixelRatio || 1;

let scale = 1;
let centerX = 0;
let centerY = 0;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Fill black initially
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    
    scale = Math.min(canvas.width, canvas.height) * 0.25;
}

window.addEventListener('resize', resize);
resize();

// Known good parameters for Peter de Jong / Clifford attractors
const goodParams = [
    {a: 1.4, b: -2.3, c: 2.4, d: -2.1},
    {a: 2.0, b: -1.2, c: 1.7, d: 1.5},
    {a: 1.7, b: 1.7, c: 0.6, d: 1.2},
    {a: -1.7, b: 1.3, c: -0.1, d: -1.2},
    {a: -1.8, b: -2.0, c: -0.5, d: -0.9},
    {a: -1.4, b: 1.6, c: 1.0, d: 0.7}
];

const p = goodParams[Math.floor(Math.random() * goodParams.length)];
const a = p.a;
const b = p.b;
const c = p.c;
const d = p.d;

let x = 0.1;
let y = 0.1;

// Pick a beautiful color
const hue = Math.floor(Math.random() * 360);
const dotColor = `hsla(${hue}, 80%, 70%, 0.1)`; // Solid color with low opacity

let isLoaded = false;
const flashEl = document.getElementById('flash');

// Simulate a longer loading time
const loadTime = 8000 + Math.random() * 4000;
setTimeout(() => {
    isLoaded = true;
    flashEl.classList.add('active');
}, loadTime);

function step() {
    // Set color explicitly every frame
    ctx.fillStyle = dotColor;
    ctx.globalCompositeOperation = 'lighter';
    
    // Draw 8000 points per frame
    for (let i = 0; i < 8000; i++) {
        // Clifford Attractor formula (very similar but guaranteed spread)
        let nextX = Math.sin(a * y) + c * Math.cos(a * x);
        let nextY = Math.sin(b * x) + d * Math.cos(b * y);
        
        x = nextX;
        y = nextY;
        
        // Scale down slightly for Clifford since it bounds [-1+|c|, 1+|c|] roughly
        let plotX = centerX + x * (scale * 0.6);
        let plotY = centerY + y * (scale * 0.6);
        
        ctx.fillRect(plotX, plotY, 1.5, 1.5);
    }
    
    ctx.globalCompositeOperation = 'source-over';
}

function draw() {
    if (isLoaded) return;
    step();
    requestAnimationFrame(draw);
}

// Pre-warm so the screen is immediately populated
for(let k = 0; k < 10; k++) {
    step();
}

draw();
