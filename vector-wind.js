document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sim-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    
    let width, height;
    
    const PARTICLE_COUNT = 8000;
    let particles = [];
    
    // Pseudo-random noise function using overlapping sine waves
    // to simulate a Perlin noise flow field
    function noise(x, y, z) {
        return Math.sin(x * 0.01 + z) * Math.cos(y * 0.01 + z) +
               Math.sin(x * 0.02 - z * 0.5) * Math.cos(y * 0.02 + z * 0.5) * 0.5;
    }
    
    function init() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: 0,
                vy: 0,
                life: Math.random() * 100
            });
        }
        
        ctx.fillStyle = '#000B18';
        ctx.fillRect(0, 0, width, height);
    }
    
    let time = 0;
    
    function animate() {
        requestAnimationFrame(animate);
        time += 0.005; // Wind shifting speed
        
        // Fade out previous frame (creates trails)
        ctx.fillStyle = 'rgba(0, 11, 24, 0.08)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = 'rgba(100, 200, 255, 0.4)';
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = particles[i];
            
            // Calculate wind angle at particle's position
            const angle = noise(p.x, p.y, time) * Math.PI * 4;
            
            // Add wind force
            p.vx += Math.cos(angle) * 0.2;
            p.vy += Math.sin(angle) * 0.2;
            
            // Friction
            p.vx *= 0.95;
            p.vy *= 0.95;
            
            // Move
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around edges OR respawn
            p.life -= 0.5;
            if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || p.life <= 0) {
                p.x = Math.random() * width;
                p.y = Math.random() * height;
                p.vx = 0;
                p.vy = 0;
                p.life = 100 + Math.random() * 50;
            }
            
            // Draw
            ctx.fillRect(p.x, p.y, 1.5, 1.5);
        }
    }
    
    window.addEventListener('resize', init);
    
    init();
    animate();
});
