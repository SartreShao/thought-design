const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

let width, height, centerY;
let dpr = window.devicePixelRatio || 1;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    centerY = height / 2;
}

window.addEventListener('resize', resize);
resize();

// Download simulation variables
let progress = 0; // 0.0 to 1.0
let targetProgress = 0;
let time = 0;

const percentEl = document.getElementById('percent');
const statusEl = document.getElementById('status');
const flashEl = document.getElementById('flash');

const messages = [
    { threshold: 0.0, text: "INITIATING SEQUENCE" },
    { threshold: 0.2, text: "RECEIVING PACKETS" },
    { threshold: 0.4, text: "DECODING STREAM" },
    { threshold: 0.7, text: "WEAVING THREADS" },
    { threshold: 0.9, text: "HARMONIZING" },
    { threshold: 1.0, text: "MATERIALIZED" }
];

function simulateNetwork() {
    if (targetProgress >= 1.0) return;
    
    // Non-linear jump to simulate network chunks
    let jump = (Math.random() * 0.08) + 0.01;
    targetProgress = Math.min(1.0, targetProgress + jump);
    
    // Find appropriate message
    let currentMsg = messages[0].text;
    for (let i = 0; i < messages.length; i++) {
        if (targetProgress >= messages[i].threshold) {
            currentMsg = messages[i].text;
        }
    }
    statusEl.innerText = currentMsg;
    
    let nextDelay = (Math.random() * 600) + 150;
    
    if (targetProgress < 1.0) {
        setTimeout(simulateNetwork, nextDelay);
    } else {
        setTimeout(() => {
            flashEl.classList.add('active');
            statusEl.innerText = "MATERIALIZED";
        }, 800);
    }
}

setTimeout(simulateNetwork, 500);

// Colors for the waves (Neon Blue/Cyan theme)
const colors = [
    'rgba(0, 191, 255, 0.4)',  // Deep Sky Blue
    'rgba(0, 255, 255, 0.4)',  // Cyan
    'rgba(65, 105, 225, 0.4)', // Royal Blue
    'rgba(255, 255, 255, 0.3)' // White highlight
];

function draw() {
    // Smooth progress interpolation
    progress += (targetProgress - progress) * 0.05;
    
    // Update UI
    let displayPercent = Math.floor(progress * 100);
    if (progress > 0.999) displayPercent = 100;
    percentEl.innerText = displayPercent;

    // Clear background
    ctx.fillStyle = '#030305';
    ctx.fillRect(0, 0, width, height);
    
    // Add additive blending for a glowing effect
    ctx.globalCompositeOperation = 'lighter';
    
    time += 0.02;

    // Calculate Amplitude based on progress
    // It starts at 0, peaks around 50%, and goes back to 0 at 100%
    // Formula: sin(progress * PI) creates a nice bell curve.
    let baseAmplitude = Math.sin(progress * Math.PI) * (height * 0.25);
    
    // If progress is almost 1, force amplitude to extremely tight glowing line
    if (progress > 0.95) {
        baseAmplitude *= (1.0 - progress) * 20.0;
    }

    // How "chaotic" the waves are. Starts high, gets perfectly ordered at 100%.
    let chaos = 1.0 - Math.pow(progress, 3.0);
    
    // Base thickness
    let baseLineWidth = 2 + (progress * 4); // Line gets thicker as it completes

    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        
        let freq = 0.002 + (i * 0.001 * chaos);
        let phase = time * (1 + i * 0.5);
        let amplitude = baseAmplitude * (0.5 + i * 0.2 * chaos);
        
        // Draw sine wave across the screen
        for (let x = 0; x <= width; x += 5) {
            // Envelope function so the edges are pinned to the center
            let envelope = Math.sin((x / width) * Math.PI);
            
            // Y position formula
            let y = centerY + Math.sin(x * freq + phase) * amplitude * envelope;
            
            // Add microscopic noise for the chaotic phase
            if (chaos > 0.1) {
                y += (Math.random() - 0.5) * (chaos * 5);
            }

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        // Styling
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = baseLineWidth;
        
        // Add glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = colors[i];
        
        ctx.stroke();
    }
    
    // Draw a perfectly straight, bright core line that intensifies at the end
    if (progress > 0.8) {
        let coreIntensity = (progress - 0.8) * 5.0; // 0 to 1
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${coreIntensity})`;
        ctx.lineWidth = 2 + coreIntensity * 6;
        ctx.shadowBlur = 20 * coreIntensity;
        ctx.shadowColor = '#ffffff';
        ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
}

draw();
