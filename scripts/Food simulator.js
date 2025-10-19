class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Set initial canvas style
        this.canvas.style.width = '800px';
        this.canvas.style.height = '600px';
        this.canvas.style.backgroundColor = '#87CEEB';
        
        this.score = 0;
        this.gameActive = false;
        
        // Player (batter) properties
        this.batter = {
            x: 150,
            y: this.canvas.height - 150,
            width: 30,
            height: 80,
            swinging: false,
            swingAngle: 0
        };
        
        // Ball properties
        this.ball = {
            x: this.canvas.width,
            y: 0,
            radius: 10,
            speed: 5,
            active: false
        };

        // Anti-spam / swing tracking
        this.swingWindowStart = 0; // timestamp of current window
        this.swingCountInWindow = 0; // number of swings in window
        this.swingWindowMs = 1000; // 1 second window
        this.swingSpamThreshold = 3; // allowed swings in window before penalty
        this.swingPenaltyAmount = 50; // points to deduct on spam
        this.swingPenaltyCooldown = 0; // timestamp until which swings are ignored
    this.penaltyFlashUntil = 0;
        // Audio: try to load a local sound file first; if not available, we'll synthesize a "num num num"
        this.eatAudio = new Audio('sounds/nom.mp3');
        this.eatAudioAvailable = true;
        this.eatAudio.addEventListener('error', () => { this.eatAudioAvailable = false; });
        this.audioContext = null; // created lazily for synthesized fallback
        
        this.bindEvents();
        this.showStartScreen();
        // Exit button event
        const exitBtn = document.getElementById('exitButton');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                if (this.timerInterval) clearInterval(this.timerInterval);
                this.gameActive = false;
                this.showStartScreen();
            });
        }
    }
    
    bindEvents() {
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.gameActive) {
                this.swing();
            }
        });
    }
    
    showStartScreen() {
        const startScreen = document.getElementById('startScreen');
        startScreen.style.display = 'block';
        startScreen.innerHTML = `
            <h1>Eating Simulator</h1>
            <div style="margin: 20px 0;">
                <button id="regularMode">Regular</button>
                <button id="infiniteMode">Infinite</button>
                <button id="impossibleMode">Impossible</button>
            </div>
            <p>Choose a gamemode!<br>Press spacebar to take a big bite!</p>
        `;
        document.getElementById('regularMode').addEventListener('click', () => this.startGame('regular'));
        document.getElementById('infiniteMode').addEventListener('click', () => this.startGame('infinite'));
        document.getElementById('impossibleMode').addEventListener('click', () => this.startGame('impossible'));
    }
    
    startGame(mode = 'regular') {
        this.gameActive = true;
        document.getElementById('startScreen').style.display = 'none';
        this.score = 0;
        document.getElementById('scoreValue').textContent = this.score;
        this.gamemode = mode;

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.fastMode = false;
        this.superFastMode = false;

        if (mode === 'regular' || mode === 'impossible') {
            this.timeLeft = 60;
            document.getElementById('timerValue').textContent = this.timeLeft;
            this.timerInterval = setInterval(() => {
                this.timeLeft -= 1;
                document.getElementById('timerValue').textContent = this.timeLeft;
                if (mode === 'regular' || mode === 'impossible') {
                    if (this.timeLeft === 30) this.fastMode = true;
                    if (this.timeLeft === 10) this.superFastMode = true;
                }
                if (this.timeLeft <= 0) {
                    clearInterval(this.timerInterval);
                    this.endGame();
                }
            }, 1000);
        } else if (mode === 'infinite') {
            this.timeLeft = null;
            this.infiniteSpeedLevel = 1;
            this.infiniteTimer = 0;
            this.missedFood = 0;
            document.getElementById('timerValue').textContent = '∞';
            // Start a timer to increase speed every 30 seconds
            this.timerInterval = setInterval(() => {
                this.infiniteTimer += 1;
                if (this.infiniteTimer % 30 === 0) {  // Every 30 seconds
                    this.infiniteSpeedLevel += 1;
                    // Flash effect to show speed increase
                    this.flashSpeedUp();
                }
            }, 1000);
        }

        this.gameLoop();
        this.spawnBall();
    }

    endGame() {
        this.gameActive = false;
        // show final score + restart button
        const startScreen = document.getElementById('startScreen');
        startScreen.style.display = 'block';
        let modeName = this.gamemode === 'regular' ? 'Regular' : (this.gamemode === 'infinite' ? 'Infinite' : 'Impossible');
        startScreen.innerHTML = `<h1>Eating Simulator</h1><p>Game Over (${modeName})<br>Final score: ${this.score}</p><button id="backButton">Back to Menu</button>`;
        document.getElementById('backButton').addEventListener('click', () => {
            this.showStartScreen();
        });
    }
    
    swing() {
        const now = Date.now();

        // enforce penalty cooldown
        if (this.swingPenaltyCooldown && now < this.swingPenaltyCooldown) return;

        // initialize or advance window
        if (!this.swingWindowStart || now - this.swingWindowStart > this.swingWindowMs) {
            this.swingWindowStart = now;
            this.swingCountInWindow = 0;
        }

        this.swingCountInWindow += 1;

        // If player spams beyond threshold, apply penalty
        if (this.swingCountInWindow > this.swingSpamThreshold) {
            // Allow score to go negative
            this.score = this.score - this.swingPenaltyAmount;
            document.getElementById('scoreValue').textContent = this.score;
            // set a brief cooldown to prevent repeated penalties
            this.swingPenaltyCooldown = now + 1000;
            this.flashPenalty();
            return;
        }

        if (!this.batter.swinging) {
            this.batter.swinging = true;
            this.batter.swingAngle = 0;
            // Check hit multiple times during the swing
            this.checkHit();
            setTimeout(() => this.checkHit(), 50);
            setTimeout(() => this.checkHit(), 100);
        }
    }
    
    checkHit() {
        if (this.ball.active) {
            const batterZone = {
                x: this.batter.x + this.batter.width - 10,
                y: this.batter.y - 20,
                width: 80,
                height: this.batter.height + 40
            };
            if (this.isCollision(this.ball, batterZone)) {
                if (this.ball.type === 'clock' && (this.gamemode === 'regular' || this.gamemode === 'impossible')) {
                    // Add 10 seconds to timer for clock power-up (no maximum cap)
                    this.timeLeft += 10;
                    document.getElementById('timerValue').textContent = this.timeLeft;
                    // Reset speed flags based on new time
                    this.fastMode = this.timeLeft <= 30;
                    this.superFastMode = this.timeLeft <= 10;
                } else if (this.ball.type === 'goldenburger') {
                    this.score += 50;
                    document.getElementById('scoreValue').textContent = this.score;
                } else {
                    this.score += 10;
                    document.getElementById('scoreValue').textContent = this.score;
                }
                this.playEatSound();
                this.ball.active = false;
                setTimeout(() => this.spawnBall(), 1500);
            }
        }
    }
    
    isCollision(ball, zone) {
        return ball.x >= zone.x && 
               ball.x <= zone.x + zone.width &&
               ball.y >= zone.y &&
               ball.y <= zone.y + zone.height;
    }
    
    spawnBall() {
        if (!this.gameActive) return;
        this.ball.x = this.canvas.width;
        this.ball.y = this.canvas.height - 160; // Position the ball at batter's height
        // Golden cheeseburger now has a very slight chance of spawning
        const types = ['pizza', 'burger', 'donut', 'goldenburger', 'clock'];
        let rand = Math.random();
        if (this.gamemode === 'infinite') {
            // 5% chance goldenburger, else random food
            if (rand < 0.05) {
                this.ball.type = 'goldenburger';
            } else {
                this.ball.type = types[Math.floor(Math.random() * 3)];
            }
        } else {
            // 15% clock, 5% goldenburger, else random food
            if (rand < 0.15) {
                this.ball.type = 'clock';
            } else if (rand < 0.20) {
                this.ball.type = 'goldenburger';
            } else {
                this.ball.type = types[Math.floor(Math.random() * 3)];
            }
        }

        // Set radius depending on type for visibility and collision
        if (this.ball.type === 'pizza') this.ball.radius = 14;
        else if (this.ball.type === 'burger') this.ball.radius = 16;
        else if (this.ball.type === 'donut') this.ball.radius = 13;
        else if (this.ball.type === 'clock') this.ball.radius = 15;
        else if (this.ball.type === 'goldenburger') this.ball.radius = 18;

        this.ball.active = true;
        if (this.gamemode === 'impossible') {
            // Impossible mode: base speed 20, faster at 30s, fastest at 10s
            this.ball.speed = this.superFastMode ? 30 : (this.fastMode ? 24 : 20);
        } else if (this.gamemode === 'infinite') {
            // Infinite mode: Speed increases by 2 every 30 seconds
            const baseSpeed = 6; // Starting speed
            this.ball.speed = baseSpeed + ((this.infiniteSpeedLevel - 1) * 2);
        } else {
            this.ball.speed = this.superFastMode ? 20 : (this.fastMode ? 10 : 6);
        }
    }
    
    update() {
        if (this.ball.active) {
            this.ball.x -= this.ball.speed;
            if (this.ball.x < 0) {
                this.ball.active = false;
                // Infinite mode: count missed food
                if (this.gamemode === 'infinite') {
                    this.missedFood = (this.missedFood || 0) + 1;
                    if (this.missedFood >= 5) {
                        this.endGame();
                        return;
                    }
                }
                setTimeout(() => this.spawnBall(), 1500);
            }
        }
        
        if (this.batter.swinging) {
            this.batter.swingAngle += 15;
            if (this.batter.swingAngle >= 90) {
                this.batter.swinging = false;
                this.batter.swingAngle = 0;
            }
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background elements (field)
        this.drawField();
        
        // Draw batter
        this.ctx.save();
        this.ctx.translate(this.batter.x + this.batter.width/2, this.batter.y + this.batter.height/2);
        this.ctx.rotate(this.batter.swingAngle * Math.PI / 180);
        this.ctx.translate(-(this.batter.x + this.batter.width/2), -(this.batter.y + this.batter.height/2));
        
        // Draw player body
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.batter.x, this.batter.y, this.batter.width, this.batter.height);
        
        // Draw player head
        this.ctx.beginPath();
        this.ctx.arc(this.batter.x + this.batter.width/2, this.batter.y - 10, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = '#333';
        this.ctx.fill();
        this.ctx.restore();
        
        // Draw ball as a food item based on type
        if (this.ball.active) {
            const x = this.ball.x;
            const y = this.ball.y;
            const r = Math.max(this.ball.radius, 10);

            if (this.ball.type === 'clock') {
                // Draw clock body
                this.ctx.beginPath();
                this.ctx.arc(x, y, r + 4, 0, Math.PI * 2);
                this.ctx.fillStyle = '#f0f0f0';
                this.ctx.fill();
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.closePath();

                // Draw clock hands
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + Math.cos(-Math.PI/4) * r, y + Math.sin(-Math.PI/4) * r); // Hour hand
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + Math.cos(Math.PI/6) * (r+2), y + Math.sin(Math.PI/6) * (r+2)); // Minute hand
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.closePath();

                // Draw center dot
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fillStyle = '#333';
                this.ctx.fill();
                this.ctx.closePath();
            } else if (this.ball.type === 'goldenburger') {
                // Draw golden burger
                // Bun top (gold)
                this.ctx.beginPath();
                this.ctx.ellipse(x, y - r * 0.2, r + 6, r * 0.9, 0, Math.PI, 0);
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fill();
                this.ctx.closePath();

                // Lettuce (bright green)
                this.ctx.beginPath();
                this.ctx.ellipse(x, y, r + 2, r * 0.5, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#aaff00';
                this.ctx.fill();
                this.ctx.closePath();

                // Patty (golden brown)
                this.ctx.beginPath();
                this.ctx.ellipse(x, y + r * 0.2, r, r * 0.45, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#e6b800';
                this.ctx.fill();
                this.ctx.closePath();

                // Bun bottom (gold)
                this.ctx.beginPath();
                this.ctx.ellipse(x, y + r * 0.6, r + 4, r * 0.35, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fill();
                this.ctx.closePath();

                // Cheese (bright yellow)
                this.ctx.beginPath();
                this.ctx.rect(x - r * 0.7, y + r * 0.15, r * 1.4, r * 0.25);
                this.ctx.fillStyle = '#fff700';
                this.ctx.fill();
                this.ctx.closePath();
            } else if (this.ball.type === 'pizza') {
                // Crust (outer)
                this.ctx.beginPath();
                this.ctx.arc(x, y, r + 6, 0, Math.PI * 2);
                this.ctx.fillStyle = '#d2a679'; // crust color
                this.ctx.fill();
                this.ctx.closePath();

                // Sauce (thin ring)
                this.ctx.beginPath();
                this.ctx.arc(x, y, r + 2, 0, Math.PI * 2);
                this.ctx.fillStyle = '#b22222'; // sauce
                this.ctx.fill();
                this.ctx.closePath();

                // Cheese (main)
                this.ctx.beginPath();
                this.ctx.arc(x, y, r, 0, Math.PI * 2);
                this.ctx.fillStyle = '#f5d96b'; // cheese color
                this.ctx.fill();
                this.ctx.closePath();

                // Pepperoni
                const pepperoniCount = 6;
                for (let i = 0; i < pepperoniCount; i++) {
                    const angle = (i / pepperoniCount) * Math.PI * 2 + 0.3;
                    const px = x + Math.cos(angle) * (r * 0.5);
                    const py = y + Math.sin(angle) * (r * 0.45);
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, Math.max(4, r * 0.18), 0, Math.PI * 2);
                    this.ctx.fillStyle = '#8b0000';
                    this.ctx.fill();
                    this.ctx.closePath();
                }
            } else if (this.ball.type === 'burger') {
                // Bun top
                this.ctx.beginPath();
                this.ctx.ellipse(x, y - r * 0.2, r + 6, r * 0.9, 0, Math.PI, 0);
                this.ctx.fillStyle = '#d2a679';
                this.ctx.fill();
                this.ctx.closePath();

                // Lettuce
                this.ctx.beginPath();
                this.ctx.ellipse(x, y, r + 2, r * 0.5, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#6bbf59';
                this.ctx.fill();
                this.ctx.closePath();

                // Patty
                this.ctx.beginPath();
                this.ctx.ellipse(x, y + r * 0.2, r, r * 0.45, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#5c3a21';
                this.ctx.fill();
                this.ctx.closePath();

                // Bun bottom
                this.ctx.beginPath();
                this.ctx.ellipse(x, y + r * 0.6, r + 4, r * 0.35, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#d2a679';
                this.ctx.fill();
                this.ctx.closePath();

            } else if (this.ball.type === 'donut') {
                // Donut outer
                this.ctx.beginPath();
                this.ctx.arc(x, y, r + 6, 0, Math.PI * 2);
                this.ctx.fillStyle = '#f0c27b';
                this.ctx.fill();
                this.ctx.closePath();

                // Glaze
                this.ctx.beginPath();
                this.ctx.arc(x, y, r + 1, 0, Math.PI * 2);
                this.ctx.fillStyle = '#f08fb0';
                this.ctx.fill();
                this.ctx.closePath();

                // Hole
                this.ctx.beginPath();
                this.ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
                this.ctx.fillStyle = '#fff';
                this.ctx.fill();
                this.ctx.closePath();
            }

            // Outline to make it pop
            this.ctx.beginPath();
            this.ctx.arc(x, y, r + 6, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.closePath();
        }

        // Draw penalty flash overlay if needed
        if (this.penaltyFlashUntil && Date.now() < this.penaltyFlashUntil) {
            this.ctx.fillStyle = 'rgba(255,0,0,0.25)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw speed up flash overlay if needed
        if (this.speedUpFlashUntil && Date.now() < this.speedUpFlashUntil) {
            this.ctx.fillStyle = 'rgba(255,255,0,0.15)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    flashPenalty() {
        this.penaltyFlashUntil = Date.now() + 300; // show red flash for 300ms
    }

    flashSpeedUp() {
        // Flash yellow to indicate speed increase
        this.speedUpFlashUntil = Date.now() + 500; // show yellow flash for 500ms
    }

    playEatSound() {
        // Try audio file first
        if (this.eatAudioAvailable) {
            try {
                this.eatAudio.currentTime = 0;
                this.eatAudio.play();
                return;
            } catch (e) {
                // fallback to synth
            }
        }

        // Synthesize a quick "num num num" sequence
        try {
            if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // richer pluck + click per note
            const playPluck = (time, freq, duration) => {
                // Pluck oscillator
                const osc = ctx.createOscillator();
                const bw = ctx.createBiquadFilter();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, time);

                // quick pitch drop for pluck
                osc.frequency.setValueAtTime(freq * 1.1, time);
                osc.frequency.exponentialRampToValueAtTime(freq, time + 0.02);

                // filter to make it warmer
                bw.type = 'lowpass';
                bw.frequency.setValueAtTime(1200, time);
                bw.Q.setValueAtTime(1, time);

                gain.gain.setValueAtTime(0.0001, time);
                gain.gain.linearRampToValueAtTime(0.28, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

                osc.connect(bw);
                bw.connect(gain);
                gain.connect(ctx.destination);

                osc.start(time);
                osc.stop(time + duration + 0.03);

                // small noise click for attack
                const bufferSize = ctx.sampleRate * 0.02;
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
                const noiseSrc = ctx.createBufferSource();
                noiseSrc.buffer = noiseBuffer;
                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0.2, time);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
                noiseSrc.connect(noiseGain);
                noiseGain.connect(ctx.destination);
                noiseSrc.start(time);
                noiseSrc.stop(time + 0.03);
            };

            // three plucky notes to approximate the reference
            playPluck(now + 0.0, 740, 0.12);
            playPluck(now + 0.16, 880, 0.12);
            playPluck(now + 0.32, 740, 0.12);
        } catch (e) {
            // audio not available
        }
    }
    
    drawField() {
        // Draw sky
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grass
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
    }
    
    gameLoop() {
        if (!this.gameActive || this.paused) return;
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});