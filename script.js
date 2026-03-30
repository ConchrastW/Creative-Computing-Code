const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game constants
let GAME_WIDTH = canvas.width;

let GAME_HEIGHT = canvas.height;
let GRAVITY = 0.25;
let JUMP_FORCE = -6;
let SCROLL_SPEED = 3;
let PIPE_SPAWN_RATE = 100; // frames
let PIPE_GAP = 160;

// State variables
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('flappyBestScore') || 0;
let gameState = 'START'; // START, PLAYING, GAME_OVER
let animationId;

// Resize handling
function resize() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    GAME_WIDTH = canvas.width;
    GAME_HEIGHT = canvas.height;

    // adjust game specific sizing based on screen
    PIPE_GAP = Math.min(GAME_HEIGHT * 0.25, 200);
    GRAVITY = GAME_HEIGHT * 0.00035;
    JUMP_FORCE = GAME_HEIGHT * -0.008;
    SCROLL_SPEED = GAME_WIDTH * 0.006;
}
window.addEventListener('resize', resize);
resize();

// Objects
const bird = {
    x: GAME_WIDTH * 0.2,
    y: GAME_HEIGHT / 2,
    radius: GAME_HEIGHT * 0.02,
    velocity: 0,
    rotation: 0,
    color: '#fde047', // yellow cartoon bird
    glowColor: 'rgba(253, 224, 71, 0.4)',

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Calculate rotation based on velocity (-20 to 90 degrees)
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        ctx.rotate(this.rotation);

        // Glow effect
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 10;

        // Main body (ellipse for cartoon feel)
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 1.2, this.radius * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        ctx.shadowBlur = 0; // stop shadow for inner details

        // Wing (flaps based on velocity)
        ctx.beginPath();
        let flapOffset = this.velocity < 0 ? -this.radius * 0.2 : 0;
        ctx.ellipse(-this.radius * 0.3, flapOffset, this.radius * 0.5, this.radius * 0.3, -Math.PI/6, 0, Math.PI * 2);
        ctx.fillStyle = '#fef08a'; // lighter yellow wing
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();

        // Eye whites
        ctx.beginPath();
        ctx.arc(this.radius * 0.5, -this.radius * 0.3, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Eye pupil
        ctx.beginPath();
        ctx.arc(this.radius * 0.6, -this.radius * 0.3, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        // Beak (orange)
        ctx.beginPath();
        ctx.moveTo(this.radius * 0.8, -this.radius * 0.1);
        ctx.lineTo(this.radius * 1.5, 0); // Tip of beak
        ctx.lineTo(this.radius * 0.8, this.radius * 0.3);
        ctx.fillStyle = '#f97316'; // Orange
        ctx.fill();
        ctx.strokeStyle = '#c2410c';
        ctx.stroke();

        ctx.restore();
    },

    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Floor collision
        if (this.y + this.radius >= GAME_HEIGHT) {
            this.y = GAME_HEIGHT - this.radius;
            gameOver();
        }

        // Ceiling collision
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    },

    jump() {
        this.velocity = JUMP_FORCE;
        // visual bump to score display to make it feel responsive
        scoreDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => scoreDisplay.style.transform = 'scale(1)', 100);
    },

    reset() {
        this.y = GAME_HEIGHT / 2;
        this.velocity = 0;
        this.rotation = 0;
    }
};

const pipes = {
    items: [],
    width: 60,
    color: '#ea580c', // orange color
    gradientColor: '#f97316',

    draw() {
        this.items.forEach(p => {
            // Give pipes a slight 3D gradient look
            const gradTop = ctx.createLinearGradient(p.x, 0, p.x + this.width, 0);
            gradTop.addColorStop(0, this.color);
            gradTop.addColorStop(0.5, this.gradientColor);
            gradTop.addColorStop(1, this.color);

            ctx.fillStyle = gradTop;

            // Top pipe
            ctx.fillRect(p.x, 0, this.width, p.top);
            // Highlight border
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.strokeRect(p.x, 0, this.width, p.top);

            // Cap top
            ctx.fillRect(p.x - 4, p.top - 20, this.width + 8, 20);

            // Bottom pipe
            ctx.fillRect(p.x, GAME_HEIGHT - p.bottom, this.width, p.bottom);
            ctx.strokeRect(p.x, GAME_HEIGHT - p.bottom, this.width, p.bottom);

            // Cap bottom
            ctx.fillRect(p.x - 4, GAME_HEIGHT - p.bottom, this.width + 8, 20);

            // Inner glow line for aesthetics
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(p.x + 5, 0, 5, p.top - 20);
            ctx.fillRect(p.x + 5, GAME_HEIGHT - p.bottom + 20, 5, p.bottom - 20);
        });
    },

    update() {
        if (frames % PIPE_SPAWN_RATE === 0) {
            // Min height of pipe is 10% of game height
            const minPipeHeight = GAME_HEIGHT * 0.1;
            const maxPos = GAME_HEIGHT - minPipeHeight - PIPE_GAP - minPipeHeight;
            const topHeight = minPipeHeight + Math.random() * maxPos;

            this.items.push({
                x: GAME_WIDTH,
                top: topHeight,
                bottom: GAME_HEIGHT - topHeight - PIPE_GAP,
                passed: false
            });
        }

        this.items.forEach((p, i) => {
            p.x -= SCROLL_SPEED;

            // Collision detection
            // define hitboxes slightly smaller than visuals to be forgiving
            const bLeft = bird.x - bird.radius * 0.8;
            const bRight = bird.x + bird.radius * 0.8;
            const bTop = bird.y - bird.radius * 0.8;
            const bBottom = bird.y + bird.radius * 0.8;

            if (bRight > p.x && bLeft < p.x + this.width) {
                if (bTop < p.top || bBottom > GAME_HEIGHT - p.bottom) {
                    gameOver();
                }
            }

            // Score update
            if (p.x + this.width < bird.x && !p.passed) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;

                // Increase difficulty slightly
                if (score % 5 === 0) {
                    SCROLL_SPEED += 0.2;
                }
            }

            if (p.x + this.width < 0) {
                this.items.shift();
            }
        });
    },

    reset() {
        this.items = [];
    }
};

const particles = {
    items: [],

    spawn(x, y) {
        for (let i = 0; i < 15; i++) {
            this.items.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                color: Math.random() > 0.5 ? '#fde047' : '#f8fafc'
            });
        }
    },

    updateAndDraw() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            let p = this.items[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.items.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
};

function drawBackground() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function loop() {
    drawBackground();

    if (gameState === 'PLAYING') {
        pipes.update();
        pipes.draw();

        bird.update();
        bird.draw();

        particles.updateAndDraw();

        frames++;
        animationId = requestAnimationFrame(loop);
    } else if (gameState === 'GAME_OVER') {
        pipes.draw();
        bird.draw();
        particles.updateAndDraw();
        animationId = requestAnimationFrame(loop);
    }
}

function startGame() {
    gameState = 'PLAYING';
    bird.reset();
    pipes.reset();
    score = 0;
    frames = 0;
    SCROLL_SPEED = GAME_WIDTH * 0.006;

    scoreDisplay.innerText = score;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.style.opacity = '1';

    cancelAnimationFrame(animationId);
    loop();
}

function gameOver() {
    if (gameState === 'GAME_OVER') return; // prevent multiple triggers

    gameState = 'GAME_OVER';
    particles.spawn(bird.x, bird.y); // impact effect

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappyBestScore', bestScore);
    }

    finalScoreEl.innerText = score;
    bestScoreEl.innerText = bestScore;

    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
        scoreDisplay.style.opacity = '0';
    }, 500);
}

// Controls
function input() {
    if (gameState === 'PLAYING') {
        bird.jump();
    } else if (gameState === 'START') {
        startGame();
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        input();
    }
});

canvas.addEventListener('mousedown', input);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent zoom and scroll
    input();
}, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
bird.reset();
bird.draw();
