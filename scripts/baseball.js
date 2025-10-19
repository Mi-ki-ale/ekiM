class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.score = 0;
        this.gameActive = false;
        
        // Player (batter) properties
        this.batter = {
            x: 100,
            y: this.canvas.height - 100,
            width: 50,
            height: 100,
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
        
        this.bindEvents();
        this.showStartScreen();
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
        document.getElementById('startScreen').style.display = 'block';
    }
    
    startGame() {
        this.gameActive = true;
        document.getElementById('startScreen').style.display = 'none';
        this.score = 0;
        document.getElementById('scoreValue').textContent = this.score;
        this.gameLoop();
        this.spawnBall();
    }
    
    swing() {
        if (!this.batter.swinging) {
            this.batter.swinging = true;
            this.batter.swingAngle = 0;
            this.checkHit();
        }
    }
    
    checkHit() {
        if (this.ball.active) {
            const batterZone = {
                x: this.batter.x,
                y: this.batter.y,
                width: this.batter.width + 50,
                height: this.batter.height
            };
            
            if (this.isCollision(this.ball, batterZone)) {
                this.score += 1;
                document.getElementById('scoreValue').textContent = this.score;
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
        this.ball.y = Math.random() * (this.canvas.height - 200) + 100;
        this.ball.active = true;
    }
    
    update() {
        if (this.ball.active) {
            this.ball.x -= this.ball.speed;
            
            if (this.ball.x < 0) {
                this.ball.active = false;
                setTimeout(() => this.spawnBall(), 1500);
            }
        }
        
        if (this.batter.swinging) {
            this.batter.swingAngle += 10;
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
        
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.batter.x, this.batter.y, this.batter.width, this.batter.height);
        this.ctx.restore();
        
        // Draw ball
        if (this.ball.active) {
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'white';
            this.ctx.fill();
            this.ctx.strokeStyle = 'red';
            this.ctx.stroke();
            this.ctx.closePath();
        }
    }
    
    drawField() {
        // Draw grass
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        
        // Draw base lines
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height - 50);
        this.ctx.lineTo(this.canvas.width, this.canvas.height - 150);
        this.ctx.stroke();
    }
    
    gameLoop() {
        if (!this.gameActive) return;
        
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});