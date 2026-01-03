export class NumberRain {
    constructor() {
        this.isActive = false;
        
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none'; 
        this.canvas.style.zIndex = '10'; // On top of Three.js
        this.canvas.style.display = 'none';
        
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        
        this.fontSize = 14;
        this.columns = 0;
        this.drops = []; 
        
        this.chars = "0123456789ABCDEF∑∫π∆∇µ";
        
        this.resize();
    }

    toggle() {
        this.isActive = !this.isActive;
        this.canvas.style.display = this.isActive ? 'block' : 'none';
        
        // Clear canvas immediately on toggle to remove old stuck frames
        if (this.isActive) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        
        this.drops = [];
        for (let i = 0; i < this.columns; i++) {
            this.drops[i] = Math.random() * -100; 
        }
    }

    update(audio) {
        if (!this.isActive) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        // --- FIX: TRANSPARENT FADE ---
        // Instead of drawing a black rect (which hides the lightning),
        // we use 'destination-out' to gently ERASE the previous frame.
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // 0.1 = Fade speed
        ctx.fillRect(0, 0, w, h);

        // Reset to normal drawing for the text
        ctx.globalCompositeOperation = 'source-over';

        // --- TEXT SETTINGS ---
        ctx.font = 'bold ' + this.fontSize + 'px monospace';
        
        // Brightness based on Mids
        const brightness = 50 + (audio.mid * 205); 
        ctx.fillStyle = `rgb(${brightness * 0.5}, ${brightness}, ${brightness})`;

        for (let i = 0; i < this.drops.length; i++) {
            const text = this.chars.charAt(Math.floor(Math.random() * this.chars.length));
            ctx.fillText(text, i * this.fontSize, this.drops[i] * this.fontSize);

            const speed = 0.5 + (audio.treble * 2.0);
            
            if (this.drops[i] * this.fontSize > h && Math.random() > 0.975) {
                this.drops[i] = 0;
            }
            this.drops[i] += speed;
        }
    }
}