const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL not supported');
}

const vertices = new Float32Array([
    -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0, -1.0,  1.0,  1.0
]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const vsSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

const fsSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_progress;

    #define MAX_STEPS 100
    #define MAX_DIST 20.0
    #define SURF_DIST 0.005

    // Smooth Minimum (Polynomial) - Inigo Quilez
    float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
    }

    mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    float hash(float n) {
        return fract(sin(n) * 43758.5453);
    }

    // Distance Estimator for Amalgamation
    float map(vec3 p) {
        float d = MAX_DIST;
        
        // As progress approaches 1.0, dispersion goes to 0.0, meaning all drops merge to center.
        // We use a cubic ease-in-out or similar curve for drama.
        float dispersion = pow(1.0 - u_progress, 2.0) * 4.0;
        
        // Base central mass that grows
        float baseRadius = 0.5 + u_progress * 1.5;
        d = length(p) - baseRadius;

        // Orbiting drops
        for(float i = 1.0; i <= 8.0; i++) {
            float t = u_time * (0.2 + hash(i) * 0.5) + hash(i * 13.0) * 100.0;
            
            // Random orbit angles
            vec3 orbit = vec3(
                sin(t) * cos(t * 0.5),
                cos(t * 1.2),
                sin(t * 0.8) * sin(t)
            );
            
            orbit = normalize(orbit) * dispersion * (0.5 + hash(i*7.0));
            
            float radius = 0.2 + hash(i * 3.0) * 0.3;
            float dropDist = length(p - orbit) - radius;
            
            // Merge with the main body smoothly
            d = smin(d, dropDist, 0.8);
        }

        return d;
    }

    vec3 getNormal(vec3 p) {
        vec2 e = vec2(0.01, 0);
        vec3 n = map(p) - vec3(
            map(p - e.xyy),
            map(p - e.yxy),
            map(p - e.yyx)
        );
        return normalize(n);
    }

    float rayMarch(vec3 ro, vec3 rd) {
        float dO = 0.0;
        for(int i = 0; i < MAX_STEPS; i++) {
            vec3 p = ro + rd * dO;
            float dS = map(p);
            dO += dS;
            if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
        }
        return dO;
    }

    // Fake environment reflection
    vec3 getEnvColor(vec3 dir) {
        float v = pow(max(0.0, dir.y), 2.0);
        vec3 col = mix(vec3(0.05, 0.05, 0.08), vec3(0.8, 0.9, 1.0), v);
        // Add a fake studio light
        float light = pow(max(0.0, dot(dir, normalize(vec3(1.0, 1.0, 1.0)))), 10.0);
        col += light * vec3(1.0, 0.9, 0.8);
        return col;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        
        vec3 ro = vec3(0.0, 0.0, -8.0 + u_progress * 3.0); // Move camera closer as it loads
        vec3 rd = normalize(vec3(uv.x, uv.y, 1.0));
        
        // Gentle camera rotation
        ro.yz *= rot(-0.2);
        rd.yz *= rot(-0.2);
        ro.xz *= rot(u_time * 0.1);
        rd.xz *= rot(u_time * 0.1);

        float d = rayMarch(ro, rd);
        
        // Background color (very dark void)
        vec3 bgCol = vec3(0.01, 0.01, 0.02) * (1.0 - length(uv) * 0.5);
        vec3 col = bgCol;

        if(d < MAX_DIST) {
            vec3 p = ro + rd * d;
            vec3 n = getNormal(p);
            
            vec3 r = reflect(rd, n);
            
            // highly reflective liquid metal material
            vec3 env = getEnvColor(r);
            
            // Fresnel
            float fresnel = pow(1.0 + dot(rd, n), 4.0);
            
            // Base color is a dark obsidian / chrome, transitioning to pure light at the end
            vec3 material = mix(vec3(0.1), vec3(1.0, 0.9, 0.8), pow(u_progress, 4.0));
            
            col = material * 0.2 + env * (0.5 + fresnel * 0.5);
            
            // Add an inner glow that builds up
            float innerGlow = pow(u_progress, 3.0) * (1.0 - clamp(dot(-rd, n), 0.0, 1.0));
            col += vec3(0.9, 0.7, 0.3) * innerGlow * 2.0;
        }
        
        // Screen shake or bloom towards the very end
        float energy = pow(u_progress, 8.0);
        col += vec3(1.0) * energy * 0.5;

        // Post
        col = pow(col, vec3(0.4545));
        
        gl_FragColor = vec4(col, 1.0);
    }
`;

function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

const vs = compileShader(vsSource, gl.VERTEX_SHADER);
const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);

const positionLoc = gl.getAttribLocation(program, "a_position");
const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
const timeLoc = gl.getUniformLocation(program, "u_time");
const progressLoc = gl.getUniformLocation(program, "u_progress");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

let startTime = Date.now();

// Loading Logic
let currentProgress = 0.0;
let targetProgress = 0.0;

const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const logText = document.getElementById('log-text');
const flash = document.getElementById('flash');

const logMessages = [
    "ESTABLISHING CONNECTION...",
    "RESOLVING MANIFEST...",
    "ALLOCATING BUFFER...",
    "DOWNLOADING SHADER ASSETS...",
    "EXTRACTING GEOMETRY DATA...",
    "COMPILING KERNEL...",
    "WEAVING LIGHT THREADS...",
    "SYNCHRONIZING ENTROPY...",
    "MATERIALIZING...",
    "COMPLETED."
];

function simulateNetwork() {
    if (targetProgress >= 1.0) return;
    
    // Random jump in progress
    let jump = (Math.random() * 0.1) + 0.02;
    targetProgress = Math.min(1.0, targetProgress + jump);
    
    // Update text
    let logIndex = Math.min(logMessages.length - 1, Math.floor(targetProgress * logMessages.length));
    logText.innerText = logMessages[logIndex];
    
    // Next jump
    let nextDelay = (Math.random() * 800) + 200;
    if (targetProgress < 1.0) {
        setTimeout(simulateNetwork, nextDelay);
    } else {
        setTimeout(() => {
            flash.classList.add('active');
            logText.innerText = logMessages[logMessages.length - 1];
        }, 500); // Trigger flash at the end
    }
}

// Start simulation
setTimeout(simulateNetwork, 500);

function render() {
    // Smooth out progress visually
    currentProgress += (targetProgress - currentProgress) * 0.05;

    // Update UI
    let displayPercent = (currentProgress * 100).toFixed(2);
    if (currentProgress > 0.999) displayPercent = "100.00";
    progressText.innerText = displayPercent + "%";
    progressBar.style.width = displayPercent + "%";

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, (Date.now() - startTime) * 0.001);
    gl.uniform1f(progressLoc, currentProgress);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
}

render();
