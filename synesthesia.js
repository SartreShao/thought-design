document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const audioUpload = document.getElementById('audio-upload');
    const audioPlayer = document.getElementById('audio-player');
    const nowPlaying = document.getElementById('now-playing');
    const trackName = document.getElementById('track-name');
    const uploadBtn = document.querySelector('.upload-btn');

    // Web Audio API Setup
    let audioContext, analyser, dataArray;
    let isAudioInitialized = false;

    // Three.js Setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030305, 0.0015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.z = 800;
    camera.position.y = 200;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x030305, 1);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // Cosmic Starburst Particles
    const PARTICLE_COUNT = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const basePositions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);

    const colorObj = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Distribute in a thick torus/ring
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        
        const rMajor = 300;
        const rMinor = Math.random() * 100 + 20;

        const x = (rMajor + rMinor * Math.cos(v)) * Math.cos(u);
        const y = rMinor * Math.sin(v);
        const z = (rMajor + rMinor * Math.cos(v)) * Math.sin(u);

        basePositions[i * 3] = x;
        basePositions[i * 3 + 1] = y;
        basePositions[i * 3 + 2] = z;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        phases[i] = Math.random() * Math.PI * 2;

        // Base color (deep violet / cosmic blue)
        colorObj.setHSL(0.65 + Math.random() * 0.1, 0.8, 0.5);
        colors[i * 3] = colorObj.r;
        colors[i * 3 + 1] = colorObj.g;
        colors[i * 3 + 2] = colorObj.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Store original positions for math calculations
    geometry.setAttribute('basePosition', new THREE.BufferAttribute(basePositions, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    // Circular particle texture
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
        size: 3.5,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        map: circleTexture
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Audio Input Handling
    audioUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        trackName.textContent = file.name;
        uploadBtn.classList.add('hidden');
        nowPlaying.classList.remove('hidden');
        audioPlayer.classList.remove('hidden');

        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;
        audioPlayer.play();

        setupWebAudio();
    });

    function setupWebAudio() {
        if (isAudioInitialized) return;
        isAudioInitialized = true;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audioPlayer);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }

    // Animation Loop
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.05;

        let bass = 0;
        let mid = 0;
        let high = 0;

        if (isAudioInitialized && !audioPlayer.paused) {
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate frequency bands
            for(let i = 0; i < 10; i++) bass += dataArray[i];
            for(let i = 10; i < 100; i++) mid += dataArray[i];
            for(let i = 100; i < 250; i++) high += dataArray[i];
            
            bass /= 10;
            mid /= 90;
            high /= 150;
        }

        const posAttr = geometry.attributes.position;
        const colorAttr = geometry.attributes.color;
        const baseAttr = geometry.attributes.basePosition;
        const phaseAttr = geometry.attributes.phase;

        const bassScale = 1 + (bass / 255) * 1.5;
        const colorShift = (mid / 255);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const ix = i * 3;
            
            // Organic idle breathing
            const idleNoise = Math.sin(time + phaseAttr.array[i]) * 5;
            
            // Audio explosion based on bass
            let bx = baseAttr.array[ix];
            let by = baseAttr.array[ix + 1];
            let bz = baseAttr.array[ix + 2];
            
            // Calculate distance from center to push outward
            const dist = Math.sqrt(bx*bx + by*by + bz*bz);
            const dirX = bx / dist;
            const dirY = by / dist;
            const dirZ = bz / dist;

            const push = (bass / 255) * (100 + Math.random() * 100);

            posAttr.array[ix] = bx * bassScale + dirX * push + idleNoise;
            posAttr.array[ix + 1] = by * bassScale + dirY * push + idleNoise;
            posAttr.array[ix + 2] = bz * bassScale + dirZ * push + idleNoise;

            // Color reaction
            const hue = (0.65 + colorShift * 0.4 + (high / 255) * 0.2) % 1.0;
            colorObj.setHSL(hue, 0.8 + (bass/255)*0.2, 0.5 + (bass/255)*0.3);
            
            // Only update colors heavily if music is playing to save perf, or lerp it
            if (isAudioInitialized && !audioPlayer.paused) {
                colorAttr.array[ix] = colorObj.r;
                colorAttr.array[ix+1] = colorObj.g;
                colorAttr.array[ix+2] = colorObj.b;
            }
        }

        posAttr.needsUpdate = true;
        if (isAudioInitialized) colorAttr.needsUpdate = true;

        // Reactive material size based on high frequencies
        material.size = 3.5 + (high / 255) * 5;

        // Camera pulsing
        controls.autoRotateSpeed = 1.0 + (mid / 255) * 5;
        
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
