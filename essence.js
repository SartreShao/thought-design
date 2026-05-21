document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');

    // Basic Three.js setup for a full-screen shader
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    
    // We render the shader onto a single 2D plane that fills the screen
    const geometry = new THREE.PlaneGeometry(2, 2);

    // GLSL Vertex Shader (Pass-through)
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    // GLSL Fragment Shader (The actual Art)
    const fragmentShader = `
        uniform float u_time;
        uniform vec2 u_resolution;

        varying vec2 vUv;

        // Rotation matrix
        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // Gyroid SDF (Signed Distance Field)
        // Formula: dot(sin(p), cos(p.zxy))
        float gyroid(vec3 p) {
            return dot(sin(p), cos(p.zxy));
        }

        // Map function: Distances to objects
        float map(vec3 p) {
            // Scale the gyroid
            float scale = 1.5;
            vec3 q = p * scale;
            
            // Add slight animation to the structure
            q.z += u_time * 0.5;
            q.y += u_time * 0.2;
            
            // Generate gyroid distance
            float d = abs(gyroid(q)) / scale - 0.05; // 0.05 is thickness
            
            return d * 0.8; // Step scale for raymarching safety
        }

        // Calculate Normals for lighting
        vec3 calcNormal(vec3 p) {
            vec2 e = vec2(0.001, 0.0);
            return normalize(vec3(
                map(p + e.xyy) - map(p - e.xyy),
                map(p + e.yxy) - map(p - e.yxy),
                map(p + e.yyx) - map(p - e.yyx)
            ));
        }

        void main() {
            // Normalize UV coordinates
            vec2 uv = (vUv - 0.5) * 2.0;
            uv.x *= u_resolution.x / u_resolution.y;

            // Camera setup
            vec3 ro = vec3(0.0, 0.0, -3.0); // Ray Origin
            vec3 rd = normalize(vec3(uv, 1.0)); // Ray Direction

            // Slowly rotate camera
            ro.xz *= rot(u_time * 0.1);
            rd.xz *= rot(u_time * 0.1);
            ro.xy *= rot(u_time * 0.05);
            rd.xy *= rot(u_time * 0.05);

            // Raymarching Loop
            float t = 0.0;
            int max_steps = 100;
            float d = 0.0;
            vec3 p = ro;

            for(int i = 0; i < max_steps; i++) {
                p = ro + rd * t;
                d = map(p);
                if(d < 0.001 || t > 20.0) break;
                t += d;
            }

            // Material and Lighting
            vec3 color = vec3(0.02, 0.02, 0.03); // Deep Obsidian background

            if(t < 20.0) {
                vec3 n = calcNormal(p);
                
                // Lighting
                vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
                
                // Diffuse
                float diff = max(dot(n, lightDir), 0.0);
                
                // Specular (Gold reflection)
                vec3 viewDir = normalize(ro - p);
                vec3 reflectDir = reflect(-lightDir, n);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                
                // Base material color (Dark Obsidian / Gold mix based on normal)
                float blend = smoothstep(0.3, 0.8, n.y);
                vec3 matObsidian = vec3(0.05, 0.05, 0.05);
                vec3 matGold = vec3(1.0, 0.8, 0.3) * 1.5;
                
                vec3 baseColor = mix(matObsidian, matGold, blend);
                
                // Edge glow (Fresnel)
                float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
                
                // Combine
                color = baseColor * diff + matGold * spec + matGold * fresnel * 0.8;
                
                // Ambient Occlusion approximation (darker in crevices)
                color *= smoothstep(0.0, 1.0, float(max_steps - int(t*10.0)) / float(max_steps));
            }
            
            // Fog (fade to black in distance)
            color = mix(color, vec3(0.01, 0.01, 0.015), smoothstep(5.0, 15.0, t));

            // Tonemapping and Gamma correction
            color = pow(color, vec3(1.0/2.2));

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const uniforms = {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({ antialias: false }); // Antialias not needed for full quad
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        uniforms.u_time.value = clock.getElapsedTime();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
});
