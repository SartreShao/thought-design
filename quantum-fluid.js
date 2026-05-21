const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: false });

if (!gl) {
    alert('WebGL not supported');
}

// Fullscreen quad
const vertices = new Float32Array([
    -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0, -1.0,  1.0,  1.0
]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Vertex Shader
const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

// Simplex Noise 3D function
const noiseLogic = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) { 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i); 
        vec4 p = permute( permute( permute( 
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }
`;

// Fluid Simulation Shader
const fsSimSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform vec2 u_mouseDir;

    ${noiseLogic}

    void main() {
        // Fluid advection (moving the texture based on noise)
        vec2 uv = v_uv;
        
        float n1 = snoise(vec3(uv * 3.0, u_time * 0.2));
        float n2 = snoise(vec3(uv * 3.0 + vec2(10.0), u_time * 0.2));
        
        vec2 vel = vec2(n1, n2) * 0.005;
        
        // Sample previous frame slightly offset
        vec4 prev = texture2D(u_texture, uv - vel);
        
        // Dissipate
        prev *= 0.98;

        // Mouse interaction
        float dist = distance(uv, u_mouse);
        float mouseForce = exp(-dist * 50.0);
        
        vec3 injectColor = vec3(0.5 + 0.5 * sin(u_time), 0.2, 1.0); // Purple/Blue neon
        
        if (dist < 0.1 && length(u_mouseDir) > 0.0) {
            prev.rgb += injectColor * mouseForce * 0.1;
        }

        gl_FragColor = vec4(prev.rgb, 1.0);
    }
`;

// Render Shader
const fsRenderSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;

    void main() {
        vec3 col = texture2D(u_texture, v_uv).rgb;
        
        // Tonemapping / Bloom approximation
        col = smoothstep(0.0, 1.0, col);
        col *= 1.5;

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
const fsSim = compileShader(fsSimSource, gl.FRAGMENT_SHADER);
const fsRender = compileShader(fsRenderSource, gl.FRAGMENT_SHADER);

function createProgram(vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}

const simProgram = createProgram(vs, fsSim);
const renderProgram = createProgram(vs, fsRender);

const positionLocSim = gl.getAttribLocation(simProgram, "a_position");
const positionLocRender = gl.getAttribLocation(renderProgram, "a_position");

let width, height;
let fboA, fboB;

function createFBO(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

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
    
    fboA = createFBO(width, height);
    fboB = createFBO(width, height);
}
window.addEventListener('resize', resize);
resize();

let mouse = { x: -1, y: -1 };
let lastMouse = { x: -1, y: -1 };
let mouseDir = { x: 0, y: 0 };

function updateMouse(x, y) {
    let nx = x / width;
    let ny = 1.0 - (y / height);
    
    mouseDir.x = nx - mouse.x;
    mouseDir.y = ny - mouse.y;
    
    mouse.x = nx;
    mouse.y = ny;
}

window.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
window.addEventListener('touchmove', (e) => updateMouse(e.touches[0].clientX, e.touches[0].clientY));

let startTime = Date.now();

function render() {
    let time = (Date.now() - startTime) * 0.001;

    // 1. Simulation
    gl.useProgram(simProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
    gl.viewport(0, 0, width, height);
    
    gl.enableVertexAttribArray(positionLocSim);
    gl.vertexAttribPointer(positionLocSim, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform1f(gl.getUniformLocation(simProgram, "u_time"), time);
    gl.uniform2f(gl.getUniformLocation(simProgram, "u_resolution"), width, height);
    gl.uniform2f(gl.getUniformLocation(simProgram, "u_mouse"), mouse.x, mouse.y);
    gl.uniform2f(gl.getUniformLocation(simProgram, "u_mouseDir"), mouseDir.x, mouseDir.y);
    
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // Swap
    let temp = fboA;
    fboA = fboB;
    fboB = temp;
    
    // Decay mouse dir
    mouseDir.x *= 0.8;
    mouseDir.y *= 0.8;

    // 2. Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(renderProgram);
    gl.viewport(0, 0, width, height);
    
    gl.enableVertexAttribArray(positionLocRender);
    gl.vertexAttribPointer(positionLocRender, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

render();
