const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: false });

if (!gl) {
    alert('WebGL not supported');
}

// Fullscreen quad
const vertices = new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0
]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Shaders
const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

// Reaction Diffusion Shader (Simulation)
const fsSimSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    // Gray-Scott model parameters
    const float Da = 1.0;
    const float Db = 0.5;
    const float feed = 0.055;
    const float k = 0.062;
    const float dt = 1.0;

    void main() {
        vec2 pixelSize = 1.0 / u_resolution;
        
        vec2 center = texture2D(u_texture, v_uv).rg;
        
        // Laplacian filter
        vec2 lapl = vec2(0.0);
        lapl += texture2D(u_texture, v_uv + vec2(-pixelSize.x, 0.0)).rg * 0.2;
        lapl += texture2D(u_texture, v_uv + vec2(pixelSize.x, 0.0)).rg * 0.2;
        lapl += texture2D(u_texture, v_uv + vec2(0.0, -pixelSize.y)).rg * 0.2;
        lapl += texture2D(u_texture, v_uv + vec2(0.0, pixelSize.y)).rg * 0.2;
        lapl += texture2D(u_texture, v_uv + vec2(-pixelSize.x, -pixelSize.y)).rg * 0.05;
        lapl += texture2D(u_texture, v_uv + vec2(pixelSize.x, -pixelSize.y)).rg * 0.05;
        lapl += texture2D(u_texture, v_uv + vec2(-pixelSize.x, pixelSize.y)).rg * 0.05;
        lapl += texture2D(u_texture, v_uv + vec2(pixelSize.x, pixelSize.y)).rg * 0.05;
        lapl -= center;

        float a = center.r;
        float b = center.g;
        
        // Dynamic feed and kill rates based on spatial coordinates
        float f = feed + (v_uv.x * 0.012 - 0.006);
        float kill = k + (v_uv.y * 0.01 - 0.005);
        
        float reaction = a * b * b;
        
        float nextA = a + (Da * lapl.r - reaction + f * (1.0 - a)) * dt;
        float nextB = b + (Db * lapl.g + reaction - (kill + f) * b) * dt;

        // Mouse interaction
        float dist = distance(v_uv, u_mouse);
        if (dist < 0.02 && u_mouse.x > 0.0) {
            nextB += 0.5;
        }

        gl_FragColor = vec4(clamp(nextA, 0.0, 1.0), clamp(nextB, 0.0, 1.0), 0.0, 1.0);
    }
`;

// Display Shader (Rendering to screen)
const fsRenderSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;

    void main() {
        vec2 val = texture2D(u_texture, v_uv).rg;
        float a = val.r;
        float b = val.g;
        
        // Color mapping
        float t = clamp(a - b, 0.0, 1.0);
        
        vec3 col1 = vec3(0.0, 0.0, 0.0); // Black
        vec3 col2 = vec3(0.0, 0.8, 0.6); // Neon Green/Cyan
        vec3 col3 = vec3(0.8, 1.0, 0.9); // Bright tip
        
        vec3 finalColor = mix(col1, col2, smoothstep(0.1, 0.5, b));
        finalColor = mix(finalColor, col3, smoothstep(0.5, 0.9, b));
        
        gl_FragColor = vec4(finalColor, 1.0);
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

function createProgram(vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}

const vs = compileShader(vsSource, gl.VERTEX_SHADER);
const fsSim = compileShader(fsSimSource, gl.FRAGMENT_SHADER);
const fsRender = compileShader(fsRenderSource, gl.FRAGMENT_SHADER);

const simProgram = createProgram(vs, fsSim);
const renderProgram = createProgram(vs, fsRender);

// Get locations
const positionLocSim = gl.getAttribLocation(simProgram, "a_position");
const positionLocRender = gl.getAttribLocation(renderProgram, "a_position");

// Framebuffers for ping-pong
let width, height;
let fboA, fboB, texA, texB;

function createFBO(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Initialize with some noise and seed
    const data = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let i = (y * w + x) * 4;
            data[i] = 1.0; // A
            data[i+1] = 0.0; // B

            // Seed a small square in the middle
            let dx = x - w/2;
            let dy = y - h/2;
            if (dx*dx + dy*dy < 100) { // Small circle in the center
                data[i+1] = 1.0;
            }

            // Add some random noise to help the reaction break symmetry
            if (Math.random() > 0.99) {
                data[i+1] = 1.0;
            }

            data[i+2] = 0.0;
            data[i+3] = 1.0;
        }
    }
    
    // Use float texture if available, otherwise fallback (we'll just assume half_float or float is needed for accuracy, but using RGBA 8bit is usually not enough for R-D. Let's use standard for now or request float extension)
    const extFloat = gl.getExtension('OES_texture_float');
    const extHalfFloat = gl.getExtension('OES_texture_half_float');

    // We need to check if the device supports rendering to these floating point textures
    gl.getExtension('WEBGL_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');

    if(extFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, data);
    } else if (extHalfFloat) {
        // Converting float array to half float is tricky in plain JS array,
        // passing null lets WebGL allocate it, and we rely on shader to clear/seed
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, extHalfFloat.HALF_FLOAT_OES, null);
    } else {
        const byteData = new Uint8Array(data.map(v => Math.round(v * 255)));
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, byteData);
    }

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    
    return { fbo, tex };
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Downscale for performance in simulation
    const simWidth = Math.floor(width / 2);
    const simHeight = Math.floor(height / 2);
    
    fboA = createFBO(simWidth, simHeight);
    fboB = createFBO(simWidth, simHeight);
}
window.addEventListener('resize', resize);
resize();

// Mouse
let mouse = { x: -1, y: -1 };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / width;
    mouse.y = 1.0 - (e.clientY / height);
});
window.addEventListener('touchmove', (e) => {
    mouse.x = e.touches[0].clientX / width;
    mouse.y = 1.0 - (e.touches[0].clientY / height);
});

// Simulation loop
let iterationsPerFrame = 20;

function render() {
    // 1. Simulation passes
    gl.useProgram(simProgram);
    gl.enableVertexAttribArray(positionLocSim);
    gl.vertexAttribPointer(positionLocSim, 2, gl.FLOAT, false, 0, 0);

    const simWidth = Math.floor(width / 2);
    const simHeight = Math.floor(height / 2);
    
    gl.viewport(0, 0, simWidth, simHeight);
    
    gl.uniform2f(gl.getUniformLocation(simProgram, "u_resolution"), simWidth, simHeight);
    gl.uniform2f(gl.getUniformLocation(simProgram, "u_mouse"), mouse.x, mouse.y);

    for (let i = 0; i < iterationsPerFrame; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
        gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Swap
        let temp = fboA;
        fboA = fboB;
        fboB = temp;
    }

    // 2. Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(renderProgram);
    gl.enableVertexAttribArray(positionLocRender);
    gl.vertexAttribPointer(positionLocRender, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

render();
