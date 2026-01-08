import * as THREE from 'three';

export class SoundAnalyser {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.dataArray = null;
        this.isInitialized = false;
        this.source = null;
        this.activeStream = null;
    }

    setupContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 512; 
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (this.context.state === 'suspended') this.context.resume();
    }

    stopPrevious() {
        if (this.source) { this.source.disconnect(); this.source = null; }
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(track => track.stop());
            this.activeStream = null;
        }
    }

    async initMic() {
        this.setupContext();
        this.stopPrevious();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.activeStream = stream;
            this.source = this.context.createMediaStreamSource(stream);
            this.source.connect(this.analyser);
            this.isInitialized = true;
            console.log("Microphone Active");
        } catch (err) { console.error(err); }
    }

    async initSystem() {
        this.setupContext();
        this.stopPrevious();
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            this.activeStream = stream;
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) { alert("Share Audio!"); return; }
            const audioStream = new MediaStream([audioTrack]);
            this.source = this.context.createMediaStreamSource(audioStream);
            this.source.connect(this.analyser);
            this.isInitialized = true;
            console.log("System Audio Active");
            stream.getVideoTracks().forEach(t => t.stop());
        } catch (err) { console.error(err); }
    }

    getData() {
        if (!this.isInitialized) return { bass: 0, lowMid: 0, highMid: 0, treble: 0 };
        
        this.analyser.getByteFrequencyData(this.dataArray);

        // --- 4 BAND SPLIT ---
        // Array length is usually 256.
        
        // 1. Deep Bass (0-5) ~0-100Hz
        let b = 0; for(let i=0; i<5; i++) b += this.dataArray[i];
        
        // 2. Low Mids / Body (6-30) ~100-600Hz
        let lm = 0; for(let i=6; i<30; i++) lm += this.dataArray[i];
        
        // 3. High Mids / Vocals (31-100) ~600-2kHz
        let hm = 0; for(let i=31; i<100; i++) hm += this.dataArray[i];
        
        // 4. Treble / Air (101-200) ~2k-10kHz
        let t = 0; for(let i=101; i<200; i++) t += this.dataArray[i];

        return {
            bass: (b/5)/255,
            lowMid: (lm/24)/255,
            highMid: (hm/69)/255,
            treble: (t/99)/255
        };
    }
}