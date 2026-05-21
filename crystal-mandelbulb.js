const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

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
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

// Fragment Shader: Raymarching the Mandelbulb with Glass refraction
const fsSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    #define MAX_STEPS 100
    #define MAX_DIST 10.0
    #define SURF_DIST 0.002
    
    // Rotation matrix
    mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    // Mandelbulb Distance Estimator
    float map(vec3 p) {
        vec3 w = p;
        float m = dot(w, w);
        vec4 trap = vec4(abs(w), m);
        float dz = 1.0;
        
        // Morphing power based on time
        float power = 8.0 + 2.0 * sin(u_time * 0.2);
        
        for(int i = 0; i < 4; i++) {
            float m2 = m * m;
            float m4 = m2 * m2;
            dz = power * sqrt(m4 * m2 * m) * dz + 1.0;
            
            float x = w.x, y = w.y, z = w.z;
            float x2 = x*x, y2 = y*y, z2 = z*z;
            float r = sqrt(x2 + y2 + z2);
            float theta = acos(z / r);
            float phi = atan(y, x);
            
            float zr = pow(r, power);
            theta = theta * power;
            phi = phi * power;
            
            w = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
            w += p;
            
            m = dot(w, w);
            trap = min(trap, vec4(abs(w), m));
            if(m > 256.0) break;
        }
        return 0.25 * log(m) * sqrt(m) / dz;
    }

    // Calculate Normal
    vec3 getNormal(vec3 p) {
        vec2 e = vec2(0.001, 0);
        vec3 n = map(p) - vec3(
            map(p - e.xyy),
            map(p - e.yxy),
            map(p - e.yyx)
        );
        return normalize(n);
    }

    // Raymarch
    float rayMarch(vec3 ro, vec3 rd) {
        float dO = 0.0;
        for(int i = 0; i < MAX_STEPS; i++) {
            vec3 p = ro + rd * dO;
            float dS = map(p);
            dO += dS;
            if(dO > MAX_DIST || dS < SURF_DIST) break;
        }
        return dO;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        
        // Camera setup
        vec3 ro = vec3(0.0, 0.0, -2.5);
        ro.yz *= rot(-u_mouse.y * 3.14 + 1.5);
        ro.xz *= rot(-u_mouse.x * 3.14 * 2.0 + u_time * 0.1);
        
        vec3 rd = normalize(vec3(uv.x, uv.y, 1.0));
        rd.yz *= rot(-u_mouse.y * 3.14 + 1.5);
        rd.xz *= rot(-u_mouse.x * 3.14 * 2.0 + u_time * 0.1);
        
        // Background color
        vec3 col = vec3(0.02, 0.05, 0.1) * (1.0 - length(uv) * 0.5);

        float d = rayMarch(ro, rd);
        
        if(d < MAX_DIST) {
            vec3 p = ro + rd * d;
            vec3 n = getNormal(p);
            vec3 r = reflect(rd, n);
            
            // Lighting
            vec3 lightDir = normalize(vec3(1.0, 2.0, -3.0));
            float dif = clamp(dot(n, lightDir), 0.0, 1.0);
            
            // Simulated Crystal / Glass Effect
            // Chromatic aberration via multiple refracted rays
            vec3 refR = refract(rd, n, 1.0 / 1.33); // Red
            vec3 refG = refract(rd, n, 1.0 / 1.35); // Green
            vec3 refB = refract(rd, n, 1.0 / 1.37); // Blue
            
            // Sample background with refracted rays (fake environment mapping)
            float bgR = pow(clamp(dot(refR, lightDir)*0.5+0.5, 0.0, 1.0), 4.0);
            float bgG = pow(clamp(dot(refG, lightDir)*0.5+0.5, 0.0, 1.0), 4.0);
            float bgB = pow(clamp(dot(refB, lightDir)*0.5+0.5, 0.0, 1.0), 4.0);
            
            vec3 refraction = vec3(bgR, bgG, bgB);
            
            // Fresnel reflection
            float fresnel = pow(1.0 + dot(rd, n), 4.0);
            vec3 reflection = vec3(1.0) * pow(clamp(dot(r, lightDir), 0.0, 1.0), 32.0);
            
            // Base crystal color (cyan/magenta hue)
            vec3 baseCol = vec3(0.8, 0.9, 1.0);
            
            col = baseCol * dif * 0.1 + refraction * 1.5 + reflection * fresnel * 2.0;
            
            // Attenuate by depth
            col *= exp(-d * 0.1);
        }

        // Post-processing
        col = pow(col, vec3(0.4545)); // Gamma correction
        
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
const mouseLoc = gl.getUniformLocation(program, "u_mouse");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

let mouse = { x: 0.5, y: 0.5 };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
});
window.addEventListener('touchmove', (e) => {
    mouse.x = e.touches[0].clientX / window.innerWidth;
    mouse.y = e.touches[0].clientY / window.innerHeight;
});

let startTime = Date.now();

function render() {
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, (Date.now() - startTime) * 0.001);
    gl.uniform2f(mouseLoc, mouse.x, mouse.y);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
}

render();
