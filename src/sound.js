import * as THREE from 'three';

export class SoundAnalyser {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.dataArray = null;
        this.isInitialized = false;
        
        this.source = null;        // The audio connection
        this.activeStream = null;  // The actual MediaStream (Mic or System)
    }

    // 1. Setup Audio Engine
    setupContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 512;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
        // Ensure context is running (sometimes it suspends)
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    // 2. THE KILL SWITCH
    // This stops the previous stream completely.
    // It makes the "Stop Sharing" banner disappear from Chrome.
    stopPrevious() {
        // Disconnect audio nodes
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        // Kill the stream (Mic or System)
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(track => track.stop());
            this.activeStream = null;
        }
    }

    // 3. Microphone Logic
    async initMic() {
        this.setupContext();
        this.stopPrevious(); // Kill System audio if active

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.activeStream = stream; // Save ref to stop it later

            this.source = this.context.createMediaStreamSource(stream);
            this.source.connect(this.analyser);
            
            this.isInitialized = true;
            console.log("MODE: Microphone");
        } catch (err) {
            console.error("Mic Error:", err);
        }
    }

    // 4. System Logic
    async initSystem() {
        this.setupContext();
        this.stopPrevious(); // Kill Mic if active

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true, // Video required for prompt
                audio: true 
            });
            this.activeStream = stream; // Save ref to stop it later

            // Check if user shared audio
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) {
                alert("You didn't check 'Share Audio'. Try again.");
                this.stopPrevious();
                return;
            }

            // Create pure audio stream
            const audioStream = new MediaStream([audioTrack]);
            this.source = this.context.createMediaStreamSource(audioStream);
            this.source.connect(this.analyser);
            
            this.isInitialized = true;
            console.log("MODE: System Audio");

            // Stop the video track immediately (we don't need the video feed)
            // But KEEP the audio track alive.
            stream.getVideoTracks().forEach(t => t.stop());

        } catch (err) {
            console.error("System Error:", err);
        }
    }

    getData() {
        if (!this.isInitialized) return { bass: 0, mid: 0, treble: 0 };
        
        this.analyser.getByteFrequencyData(this.dataArray);

        let b = 0; for(let i=0; i<10; i++) b += this.dataArray[i];
        let m = 0; for(let i=10; i<100; i++) m += this.dataArray[i];
        let t = 0; for(let i=100; i<200; i++) t += this.dataArray[i];

        return {
            bass: (b/10)/255,
            mid: (m/90)/255,
            treble: (t/100)/255
        };
    }
}