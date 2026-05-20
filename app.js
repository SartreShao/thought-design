document.addEventListener('DOMContentLoaded', () => {
    const viewport = document.getElementById('loader-viewport');
    const styleBtns = document.querySelectorAll('.style-btn');
    const themeBtns = document.querySelectorAll('.theme-btn');
    const speedRange = document.getElementById('speed-range');
    const speedVal = document.getElementById('speed-val');
    const progressRange = document.getElementById('progress-range');
    const progressVal = document.getElementById('progress-val');
    const btnSimulateLoop = document.getElementById('btn-simulate-loop');
    const btnSimulateProgress = document.getElementById('btn-simulate-progress');
    const dashboard = document.getElementById('control-dashboard');
    const triggerZone = document.getElementById('dashboard-trigger-zone');
    const closeBtn = document.getElementById('close-dashboard-btn');
    const helpToast = document.getElementById('help-toast');

    let currentStyle = 'ethereal-threads';
    let simulationMode = 'loop';
    let progressTimer = null;
    let currentProgress = 50;

    // Subtle Help Toast
    setTimeout(() => {
        helpToast.classList.add('show');
        setTimeout(() => helpToast.classList.remove('show'), 4000);
    }, 1500);

    // Dashboard Toggling
    const toggleDashboard = () => dashboard.classList.toggle('hidden');
    triggerZone.addEventListener('click', toggleDashboard);
    closeBtn.addEventListener('click', () => dashboard.classList.add('hidden'));

    viewport.addEventListener('dblclick', (e) => {
        if (!dashboard.contains(e.target) && e.target !== triggerZone && !triggerZone.contains(e.target)) {
            toggleDashboard();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
            toggleDashboard();
        }
    });

    // Parallax Interaction
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    
    viewport.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        // Normalize between -0.5 and 0.5
        targetX = (clientX / innerWidth) - 0.5;
        targetY = (clientY / innerHeight) - 0.5;
    });

    viewport.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
    });

    // Smooth interpolation for parallax
    const renderParallax = () => {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;
        
        // Deeply bind parallax to the root variables for CSS wrappers to use
        viewport.style.setProperty('--parallax-x', `${currentX * 100}px`);
        viewport.style.setProperty('--parallax-y', `${currentY * 100}px`);

        // Extra 3D tilts for specific styles
        if (currentStyle === 'ethereal-threads') {
            const scene = document.querySelector('.spirograph-scene');
            if(scene) scene.style.transform = `rotateY(${currentX * 40}deg) rotateX(${-currentY * 40}deg)`;
        } else if (currentStyle === 'geometric-resonance') {
            const scene = document.querySelector('.resonance-scene');
            if(scene) scene.style.transform = `rotateY(${currentX * 20}deg) rotateX(${-currentY * 20}deg)`;
        }

        requestAnimationFrame(renderParallax);
    };
    renderParallax();

    // Style Switcher
    styleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            styleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const nextStyle = btn.dataset.style;
            document.querySelectorAll('.loader-container').forEach(container => {
                container.classList.remove('active');
            });
            document.getElementById(`loader-${nextStyle}`).classList.add('active');
            
            currentStyle = nextStyle;
            
            // Reset transforms
            document.querySelectorAll('.spirograph-scene, .resonance-scene').forEach(el => el.style.transform = '');
            updateStyleProgressEffect();
        });
    });

    // Theme Switcher
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            viewport.className = btn.dataset.theme;
        });
    });

    // Speed Controller
    speedRange.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value).toFixed(1);
        speedVal.textContent = `${val}x`;
        viewport.style.setProperty('--animation-speed-mult', val);
    });

    // Progress Bindings
    const updateProgressUI = (val) => {
        currentProgress = val;
        progressRange.value = val;
        progressVal.textContent = simulationMode === 'progress' ? `${val}%` : `Auto (${val}%)`;
        updateStyleProgressEffect();
    };

    const updateStyleProgressEffect = () => {
        const val = currentProgress;
        const norm = val / 100;
        
        if (simulationMode === 'loop') {
            // Restore defaults for infinite loop
            if (currentStyle === 'ethereal-threads') {
                const svg = document.querySelector('.spiro-svg');
                if(svg) svg.style.opacity = '1';
                document.querySelector('.spiro-core').style.transform = '';
            } else if (currentStyle === 'chromatic-dispersion') {
                const wrapper = document.querySelector('.liquid-canvas');
                if(wrapper) wrapper.style.filter = `url(#chromatic-dispersion) blur(4px)`;
            } else if (currentStyle === 'geometric-resonance') {
                document.querySelectorAll('.hex-echo').forEach(hex => {
                    hex.style.animationPlayState = 'running';
                });
            }
            return;
        }

        // Linear Progress Mode Mapping
        if (currentStyle === 'ethereal-threads') {
            // Unfold the mandala based on progress
            const svg = document.querySelector('.spiro-svg');
            if(svg) svg.style.opacity = 0.1 + norm * 0.9;
            
            // Scale the core
            document.querySelector('.spiro-core').style.transform = `scale(${1 + norm * 2})`;
            
        } else if (currentStyle === 'chromatic-dispersion') {
            // Increase turbulence base frequency or reduce blur as it loads
            const wrapper = document.querySelector('.liquid-canvas');
            // Hard mapping of blur: starts highly blurred (formless), resolves to sharp liquid glass
            if(wrapper) wrapper.style.filter = `url(#chromatic-dispersion) blur(${15 - norm * 15}px)`;
            
        } else if (currentStyle === 'geometric-resonance') {
            // Pause auto animation and manually scale/fade echoes based on progress
            const echoes = document.querySelectorAll('.hex-echo');
            echoes.forEach((hex, i) => {
                hex.style.animationPlayState = 'paused';
                // Calculate a specific phase for each hex based on global progress
                const phase = (norm * 10 + i) % 10 / 10; 
                hex.style.transform = `scale(${0.1 + phase * 4}) rotate(${phase * 90}deg)`;
                
                // Fade in and out
                let opacity = 0;
                if (phase > 0.1 && phase < 0.9) opacity = Math.sin((phase - 0.1) * Math.PI / 0.8) * 0.8;
                hex.style.opacity = opacity;
                hex.style.strokeWidth = 2 - phase * 1.9;
            });
        }
    };

    progressRange.addEventListener('input', (e) => {
        if (simulationMode !== 'progress') setSimulationMode('progress');
        updateProgressUI(parseInt(e.target.value));
    });

    const setSimulationMode = (mode) => {
        simulationMode = mode;
        clearInterval(progressTimer);
        
        if (mode === 'loop') {
            btnSimulateLoop.classList.add('active');
            btnSimulateProgress.classList.remove('active');
            progressVal.textContent = 'Infinite';
            updateStyleProgressEffect();
        } else {
            btnSimulateLoop.classList.remove('active');
            btnSimulateProgress.classList.add('active');
            progressVal.textContent = `${currentProgress}%`;
        }
    };

    btnSimulateLoop.addEventListener('click', () => setSimulationMode('loop'));

    btnSimulateProgress.addEventListener('click', () => {
        setSimulationMode('progress');
        let progress = 0;
        updateProgressUI(progress);
        
        progressTimer = setInterval(() => {
            progress += 1;
            updateProgressUI(progress);
            if (progress >= 100) {
                clearInterval(progressTimer);
                setTimeout(() => progressVal.textContent = 'Resolved (100%)', 300);
            }
        }, 40 / parseFloat(speedRange.value));
    });

    setSimulationMode('loop');
});
