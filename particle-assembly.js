document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const loadSlider = document.getElementById('load-slider');
    const loadVal = document.getElementById('load-val');
    const shapeBtns = document.querySelectorAll('.shape-btn');

    // Three.js Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020202, 0.001);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.z = 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasContainer.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    const PARTICLE_COUNT = 15000;
    
    // Geometry Data Buffers
    const posChaos = new Float32Array(PARTICLE_COUNT * 3);
    const posOctahedron = new Float32Array(PARTICLE_COUNT * 3);
    const posText = new Float32Array(PARTICLE_COUNT * 3);
    const posDNA = new Float32Array(PARTICLE_COUNT * 3);
    
    const posOrder = new Float32Array(PARTICLE_COUNT * 3); // The active target
    const currentPos = new Float32Array(PARTICLE_COUNT * 3); // What is rendered
    
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const randomOffsets = new Float32Array(PARTICLE_COUNT);

    // --- GENERATORS ---

    // 1. Chaos Generator
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const radius = 800 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        posChaos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        posChaos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        posChaos[i * 3 + 2] = radius * Math.cos(phi);
        randomOffsets[i] = Math.random() * Math.PI * 2;
    }

    // 2. Octahedron Generator
    function generateOctahedron() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const faceX = Math.random() > 0.5 ? 1 : -1;
            const faceY = Math.random() > 0.5 ? 1 : -1;
            const faceZ = Math.random() > 0.5 ? 1 : -1;
            let u = Math.random(), v = Math.random(), w = Math.random();
            const sum = u + v + w;
            u /= sum; v /= sum; w /= sum;
            const scale = 250;
            posOctahedron[i * 3] = faceX * u * scale;
            posOctahedron[i * 3 + 1] = faceY * v * scale;
            posOctahedron[i * 3 + 2] = faceZ * w * scale;
        }
    }

    // 3. Typography Generator ("AWAKE")
    function generateTypography() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 800;
        tempCanvas.height = 300;
        const tCtx = tempCanvas.getContext('2d');
        
        tCtx.fillStyle = '#000';
        tCtx.fillRect(0, 0, 800, 300);
        
        tCtx.fillStyle = '#fff';
        tCtx.font = 'bold 200px "Cinzel", serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText('AWAKE', 400, 150);
        
        const imgData = tCtx.getImageData(0, 0, 800, 300).data;
        const validPixels = [];
        for (let y = 0; y < 300; y++) {
            for (let x = 0; x < 800; x++) {
                const alpha = imgData[(y * 800 + x) * 4];
                if (alpha > 128) validPixels.push({x: x - 400, y: -(y - 150)});
            }
        }
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const px = validPixels[i % validPixels.length];
            posText[i * 3] = px.x * 1.5 + (Math.random() - 0.5) * 5;
            posText[i * 3 + 1] = px.y * 1.5 + (Math.random() - 0.5) * 5;
            posText[i * 3 + 2] = (Math.random() - 0.5) * 40; // Slight depth
        }
    }

    // 4. DNA Helix Generator
    function generateDNA() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const t = (i / PARTICLE_COUNT) * Math.PI * 20; // 10 twists
            const isStrand1 = Math.random() > 0.5;
            const radius = 60;
            const heightSpan = 600;
            
            let x, y, z;
            
            // 80% chance to be on the strands, 20% to be on a connecting rung
            if (Math.random() > 0.2) {
                // Strands
                const offset = isStrand1 ? 0 : Math.PI;
                x = Math.cos(t + offset) * radius;
                y = (i / PARTICLE_COUNT) * heightSpan - (heightSpan / 2);
                z = Math.sin(t + offset) * radius;
                
                // Add noise
                x += (Math.random() - 0.5) * 10;
                y += (Math.random() - 0.5) * 10;
                z += (Math.random() - 0.5) * 10;
            } else {
                // Rungs
                const rungT = Math.floor(t / Math.PI) * Math.PI; // Snap to nearest PI step
                const lerp = Math.random() * 2 - 1; // -1 to 1
                x = Math.cos(rungT) * radius * lerp;
                y = (rungT / (Math.PI * 20)) * heightSpan - (heightSpan / 2);
                z = Math.sin(rungT) * radius * lerp;
                
                x += (Math.random() - 0.5) * 5;
                y += (Math.random() - 0.5) * 5;
                z += (Math.random() - 0.5) * 5;
            }
            
            posDNA[i * 3] = x;
            posDNA[i * 3 + 1] = y;
            posDNA[i * 3 + 2] = z;
        }
    }

    // Initialize Generators
    generateOctahedron();
    generateTypography();
    generateDNA();

    // Set initial target to Octahedron
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        posOrder[i] = posOctahedron[i];
        currentPos[i] = posChaos[i];
        
        colors[i] = 0.7 + Math.random() * 0.3; // Base intensity
        if (i % 3 === 2) colors[i] *= 1.1; // Blue tint on Z/Blue channel
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Circle texture
    const circleCanvas = document.createElement('canvas');
    circleCanvas.width = 16;
    circleCanvas.height = 16;
    const ctx = circleCanvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    const circleTexture = new THREE.CanvasTexture(circleCanvas);

    const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        map: circleTexture
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- INTERACTION LOGIC ---

    let targetProgress = 0;
    let currentProgress = 0;
    let activeShapeArray = posOctahedron;

    loadSlider.addEventListener('input', (e) => {
        targetProgress = e.target.value / 100;
        loadVal.textContent = `${e.target.value}%`;
    });

    shapeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            shapeBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const shape = e.target.getAttribute('data-shape');
            if (shape === 'octahedron') activeShapeArray = posOctahedron;
            if (shape === 'text') activeShapeArray = posText;
            if (shape === 'dna') activeShapeArray = posDNA;
            
            // Smoothly copy active array into posOrder
            for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
                posOrder[i] = activeShapeArray[i];
            }
        });
    });

    // Ease function
    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += 0.05;

        // Smoothly interpolate progress
        currentProgress += (targetProgress - currentProgress) * 0.05;
        const easedP = easeInOutQuad(currentProgress);

        const posAttr = geometry.attributes.position;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const ix = i * 3;
            
            // Linear interpolate between Chaos and active Order shape
            let nx = posChaos[ix] + (posOrder[ix] - posChaos[ix]) * easedP;
            let ny = posChaos[ix+1] + (posOrder[ix+1] - posChaos[ix+1]) * easedP;
            let nz = posChaos[ix+2] + (posOrder[ix+2] - posChaos[ix+2]) * easedP;

            // Ambient floating noise
            const noiseAmp = (1.0 - easedP) * 50 + 2; 
            const offset = randomOffsets[i];

            nx += Math.sin(time + offset) * noiseAmp;
            ny += Math.cos(time + offset * 1.5) * noiseAmp;
            nz += Math.sin(time * 0.8 + offset) * noiseAmp;

            posAttr.array[ix] = nx;
            posAttr.array[ix+1] = ny;
            posAttr.array[ix+2] = nz;
        }

        posAttr.needsUpdate = true;

        controls.autoRotateSpeed = 0.5 + easedP * 2.0;
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
});
