import * as THREE from 'three';

export class SoundAnalyser {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.dataArray = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.context.createMediaStreamSource(stream);
            
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 256; 
            source.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isInitialized = true;
            console.log("Audio System Live");
        } catch (err) {
            console.error("Audio Init Failed:", err);
        }
    }

    // RENAMED FUNCTION TO ENSURE CACHE CLEAR
    getData() {
        // IMPORTANT: Must return an object with zeros, NOT just 'return;'
        if (!this.isInitialized) return { bass: 0, mid: 0, treble: 0 };
        
        this.analyser.getByteFrequencyData(this.dataArray);

        let b = 0; for(let i=0; i<10; i++) b += this.dataArray[i];
        let m = 0; for(let i=10; i<40; i++) m += this.dataArray[i];
        let t = 0; for(let i=40; i<100; i++) t += this.dataArray[i];

        return {
            bass: (b/10)/255,
            mid: (m/30)/255,
            treble: (t/60)/255
        };
    }
}