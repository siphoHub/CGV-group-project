import { assetUrl } from '../utils/assets.js';

//cutscene between levels 1 and 2

export class endcutscene{

    constructor(backgroundImage = null) {
        this.isPlaying = false;
        this.cutsceneContainer = null;
        this.onComplete = null;
        this.skipTimeout = null;
        this.skipEnabled = false;
        this.skipPrompt = null; //space to skip
        this.fireSound = null;
        this.endSound = null;
        this.fireTimeout = null;
        this.backgroundImage = backgroundImage;
        this.onFireEnded = null;
    }


    //create and start the cutscene btwn levels 1 and 2
    play(onCompleteCallback, levelLoadCallback){
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.onComplete = onCompleteCallback;
        this.createCutsceneElements();

        this.addSkipListener();

        // Enable skip after 3 seconds
        setTimeout(() => {
            this.enableSkip();
        }, 3000);

        if (levelLoadCallback) {
            setTimeout(() => {
                levelLoadCallback();
            }, 3500); //start loading level 2 after 3.5 seconds
        }

        this.skipTimeout = setTimeout(() => {
            this.end();
        }, 30000); //30 seconds total duration
    }//play func



    createCutsceneElements(){
        this.cutsceneContainer = document.createElement("div");
        this.cutsceneContainer.id = 'endcutscene';

        if (this.backgroundImage) {
            this.cutsceneContainer.style.backgroundImage = `url(${this.backgroundImage})`;
            this.cutsceneContainer.style.backgroundSize = 'cover';
            this.cutsceneContainer.style.backgroundPosition = 'center';
        }

        this.cutsceneContainer.innerHTML = `
            <div id="endcutscene-content">

                <div id="intro"> It's gone...all of it </div>

                <div id="did">Everything they built, everything they did...</div>

                <div id="wiped">Wiped away in an instant.</div>
                
                <div id="free">I should feel free.</div>

                <div id="but">But all I can think about is what it cost to get here...</div>
                
               

                <div id="skip-prompt" style="display: none;">
                    Press <span class="skip-key">SPACE</span> to skip
                </div>

            </div>
        `;

        this.addCutsceneStyles();
        document.body.appendChild(this.cutsceneContainer);

        this.startAnimations();
    }//createCutsceneElements func

    addCutsceneStyles() {
    const styles = document.createElement('style');
    styles.id = 'cutscene-styles';
    styles.textContent = `
      /* Fullscreen cutscene container */
      #endcutscene {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: #000;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
        font-family: 'Arial', sans-serif;
        overflow: hidden;
      }

      /* Main content wrapper */
      #endcutscene-content {
        max-width: 800px;
        text-align: center;
        line-height: 1.6;
        font-size: 1.8rem;
        text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
      }

      /* Each dialogue block fades in and out sequentially */
      #endcutscene-content > div {
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
      }


      /* Fade in/out animation for dialogue (quick in/out, visible in middle) */
      @keyframes fadeInOut {
        0%   { opacity: 0; transform: translateY(6px); }
        10%  { opacity: 1; transform: translateY(0); }   /* fade in */
        90%  { opacity: 1; transform: translateY(0); }   /* stay visible */
        100% { opacity: 0; transform: translateY(-6px); }/* fade out */
      }

      /* Skip prompt styling */
      #skip-prompt {
        position: absolute;
        bottom: 30px;
        right: 30px;
        font-size: 1.2rem;
        color: rgba(255, 255, 255, 0.7);
        animation: skipBlink 2s ease-in-out infinite;
        z-index: 10001;
      }

      .skip-key {
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        font-weight: bold;
      }

      @keyframes skipBlink {
        0%, 50% { opacity: 0.7; }
        100% { opacity: 0.3; }
      }

      /* Optional: subtle flicker for flashlight effect */
      @keyframes flicker {
        0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
        20%, 22%, 24%, 55% { opacity: 0.8; }
      }

      #cutscene12-content {
        animation: flicker 6s infinite;
      }

      /* Responsive text for smaller screens */
      @media (max-width: 768px) {
        #cutscene12-content {
          font-size: 1.3rem;
          line-height: 1.4;
        }
      }
    `;
    document.head.appendChild(styles);
}


    startAnimations() {
        this.playBackgroundSound({ startQuiet: true });
        this.playFireSound();

        const dialogues = [
            { id: 'intro', delay: 2000 },
            {id: 'did', delay: 7000 },
            { id: 'wiped', delay: 12000 },
            { id: 'free', delay: 17000 },
            { id: 'but', delay: 23000 },
        ];

        dialogues.forEach((dialogue, index) => {
            const el = document.getElementById(dialogue.id);
            setTimeout(() => { el.style.opacity = 1; }, index * 3500);
            setTimeout(() => { el.style.opacity = 0; }, (index + 1) * 3500);
        });


    }

    // Small helper to fade volume smoothly
    _fadeVolume(audio, from, to, durationMs = 800) {
        if (!audio) return;
        const steps = 24;
        const stepTime = Math.max(16, Math.floor(durationMs / steps));
        let current = 0;
        audio.volume = from;
        const delta = (to - from) / steps;
        const id = setInterval(() => {
            current += 1;
            audio.volume = Math.max(0, Math.min(1, audio.volume + delta));
            if (current >= steps) clearInterval(id);
        }, stepTime);
    }

   playFireSound() {
        this.fireSound = new Audio(assetUrl('assets/firesound.wav'));
        this.fireSound.loop = false;
        this.fireSound.volume = 0.6; // foreground

        // After fire ends, gently bring background up a bit
        this._onFireEnded = () => {
            if (!this.isPlaying) return;
            if (this.endSound) {
                this._fadeVolume(this.endSound, this.endSound.volume, 0.35, 1200);
            }
        };
        this.fireSound.addEventListener('ended', this._onFireEnded, { once: true });

        this.fireSound.play().catch(() => {});
    }

   playBackgroundSound({ startQuiet = false } = {}) {
        if (!this.isPlaying) return;
        if (!this.endSound) {
            this.endSound = new Audio(assetUrl('assets/scary-horror-music-351315.mp3'));
            this.endSound.loop = true;
            this.endSound.volume = startQuiet ? 0.08 : 0.35; // underlay
        } else if (startQuiet) {
            this.endSound.volume = Math.min(this.endSound.volume, 0.08);
        }
        this.endSound.play().catch(() => {});
        // If we started quiet, fade in slightly so it sits under the fire
        if (startQuiet) this._fadeVolume(this.endSound, this.endSound.volume, 0.18, 900);
    }

    // Stop sounds safely
    stopSounds() {
        if (this.fireSound) {
            try {
                if (this._onFireEnded) {
                    this.fireSound.removeEventListener('ended', this._onFireEnded);
                    this._onFireEnded = null;
                }
                this.fireSound.pause();
            } catch {}
            this.fireSound = null;
        }
        if (this.endSound) {
            try { this.endSound.pause(); } catch {}
            this.endSound = null;
        }
    }



    addSkipListener() {
    this.skipHandler = (event) => {
      if (this.skipEnabled && event.code === 'Space') {
        event.preventDefault();
        this.skipCutscene();
      }
    };
    document.addEventListener('keydown', this.skipHandler);
  }

  enableSkip() {
    this.skipEnabled = true;
    this.skipPrompt = document.getElementById('skip-prompt');
    if (this.skipPrompt) {
      this.skipPrompt.style.display = 'block';
    }
  }

  skipCutscene() {
    if (!this.isPlaying) return;
    this.end();
  }

  removeSkipListener() {
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }
  }

  // End the cutscene and clean up
  end() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.skipEnabled = false;

    if (this.growlTimeout) {
        clearTimeout(this.growlTimeout);
        this.growlTimeout = null;
    }

    this.stopSounds();
    
    // Remove skip listener
    this.removeSkipListener();
    
    // Clear timeout
    if (this.skipTimeout) {
      clearTimeout(this.skipTimeout);
      this.skipTimeout = null;
    }

    // Fade out cutscene
    if (this.cutsceneContainer) {
      this.cutsceneContainer.style.animation = 'fadeOut 1s ease-in-out forwards';
      
      setTimeout(() => {
        // Clean up DOM elements
        this.cutsceneContainer?.remove();
        document.getElementById('cutscene-styles')?.remove();
        this.cutsceneContainer = null;

         // Notify listeners that the cutscene finished
        try { window.dispatchEvent(new CustomEvent('endcutscene:finished')); } catch {}

        
        // Call completion callback
        if (this.onComplete) {
          this.onComplete();
          this.onComplete = null;
        }
      }, 1000);
    }
  }

  // Check if cutscene is currently playing
  isActive() {
    return this.isPlaying;
  }

  // Skip directly to end
  skip() {
    this.end();
  }
    

}

// Add fadeOut animation for cleanup
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(fadeOutStyle);
