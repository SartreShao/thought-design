/**
 * Exhibit 04: The Organic Loom
 * A Physarum (Slime Mold) Transport Network Simulation
 */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sim-canvas');
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize performance
    
    let width, height;
    
    // Slime mold parameters
    const numAgents = 15000;
    const moveSpeed = 1.5;
    const sensorAngleSpacing = 0.4;
    const sensorOffsetDst = 15;
    const sensorSize = 1;
    const turnSpeed = 0.2;
    const trailWeight = 1.5;
    const decayRate = 0.95; // Multiply by this to fade
    
    let agents = [];
    let trailMap = []; // 2D array flat
    
    function init() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        
        trailMap = new Float32Array(width * height);
        agents = [];
        
        // Spawn agents in a circle in the center
        const cx = width / 2;
        const cy = height / 2;
        
        spawnColony(cx, cy, numAgents);
        
        // Fill canvas with black
        ctx.fillStyle = '#010400';
        ctx.fillRect(0, 0, width, height);
    }
    
    function spawnColony(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 50;
            agents.push({
                x: x + Math.cos(angle) * r,
                y: y + Math.sin(angle) * r,
                angle: angle // Point outwards
            });
        }
    }
    
    // Listen for clicks to spawn new colonies
    canvas.addEventListener('mousedown', (e) => {
        spawnColony(e.clientX, e.clientY, 3000);
    });
    
    function getTrail(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return trailMap[Math.floor(y) * width + Math.floor(x)];
    }
    
    function setTrail(x, y, val) {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        trailMap[Math.floor(y) * width + Math.floor(x)] = val;
    }
    
    function sense(agent, sensorAngleOffset) {
        const sensorAngle = agent.angle + sensorAngleOffset;
        const sensorDirX = Math.cos(sensorAngle);
        const sensorDirY = Math.sin(sensorAngle);
        const sensorCenterX = agent.x + sensorDirX * sensorOffsetDst;
        const sensorCenterY = agent.y + sensorDirY * sensorOffsetDst;
        
        let sum = 0;
        // Sample a 3x3 area
        for (let offsetX = -sensorSize; offsetX <= sensorSize; offsetX++) {
            for (let offsetY = -sensorSize; offsetY <= sensorSize; offsetY++) {
                sum += getTrail(sensorCenterX + offsetX, sensorCenterY + offsetY);
            }
        }
        return sum;
    }
    
    let lastTime = 0;
    
    function animate(time) {
        requestAnimationFrame(animate);
        
        // We render to an ImageData object for performance
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;
        
        // 1. Process Agents
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            
            // Sense
            const weightForward = sense(agent, 0);
            const weightLeft = sense(agent, sensorAngleSpacing);
            const weightRight = sense(agent, -sensorAngleSpacing);
            
            // Steer
            const randomSteerStrength = Math.random();
            if (weightForward > weightLeft && weightForward > weightRight) {
                // Keep going straight
            } else if (weightForward < weightLeft && weightForward < weightRight) {
                agent.angle += (Math.random() > 0.5 ? 1 : -1) * turnSpeed * randomSteerStrength;
            } else if (weightRight > weightLeft) {
                agent.angle -= turnSpeed * randomSteerStrength;
            } else if (weightLeft > weightRight) {
                agent.angle += turnSpeed * randomSteerStrength;
            }
            
            // Move
            const directionX = Math.cos(agent.angle);
            const directionY = Math.sin(agent.angle);
            let newX = agent.x + directionX * moveSpeed;
            let newY = agent.y + directionY * moveSpeed;
            
            // Wrap around edges
            if (newX < 0) newX += width;
            if (newX >= width) newX -= width;
            if (newY < 0) newY += height;
            if (newY >= height) newY -= height;
            
            agent.x = newX;
            agent.y = newY;
            
            // Deposit trail
            setTrail(newX, newY, Math.min(255, getTrail(newX, newY) + trailWeight * 10));
        }
        
        // 2. Diffuse and Decay Trail Map, and map to Pixels
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // Fast box blur (approximate diffusion)
                let sum = getTrail(x, y);
                let count = 1;
                
                if (x > 0) { sum += trailMap[idx - 1]; count++; }
                if (x < width - 1) { sum += trailMap[idx + 1]; count++; }
                if (y > 0) { sum += trailMap[idx - width]; count++; }
                if (y < height - 1) { sum += trailMap[idx + width]; count++; }
                
                let blurredVal = sum / count;
                blurredVal *= decayRate; // Decay
                
                trailMap[idx] = blurredVal;
                
                // Map to bioluminescent color (Black -> Purple -> Green -> White)
                const pxIdx = idx * 4;
                const intensity = Math.min(255, Math.max(0, blurredVal));
                
                if (intensity > 5) {
                    // Bio-greenish-cyan mapping
                    pixels[pxIdx] = intensity * 0.2;     // R
                    pixels[pxIdx + 1] = intensity * 0.9; // G
                    pixels[pxIdx + 2] = intensity * 0.5; // B
                } else {
                    // Deep dark background
                    pixels[pxIdx] = 1;
                    pixels[pxIdx + 1] = 4;
                    pixels[pxIdx + 2] = 0;
                }
                pixels[pxIdx + 3] = 255; // Alpha
            }
        }
        
        ctx.putImageData(imgData, 0, 0);
    }
    
    window.addEventListener('resize', init);
    
    init();
    animate(0);
});
