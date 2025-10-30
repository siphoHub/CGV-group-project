import { assetUrl } from '../utils/assets.js';

//cutscene between levels 1 and 2

export class cutscene12{

    constructor(backgroundImage = null) {
        this.isPlaying = false;
        this.cutsceneContainer = null;
        this.onComplete = null;
        this.skipTimeout = null;
        this.skipEnabled = false;
        this.skipPrompt = null; //space to skip
        this.elevatorSound = null;
        this.growlSound = null;
        this.growlTimeout = null;
        this.backgroundImage = backgroundImage;
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
            // kick off next level loading almost immediately so it can finish during the cutscene
            setTimeout(() => levelLoadCallback(), 100);
        }

        this.skipTimeout = setTimeout(() => {
            this.end();
        }, 30000); //30 seconds total duration
    }//play func



    createCutsceneElements(){
        this.cutsceneContainer = document.createElement("div");
        this.cutsceneContainer.id = 'cutscene-12';

        if (this.backgroundImage) {
            this.cutsceneContainer.style.backgroundImage = `url(${this.backgroundImage})`;
            this.cutsceneContainer.style.backgroundSize = 'cover';
            this.cutsceneContainer.style.backgroundPosition = 'center';
        }

        this.cutsceneContainer.innerHTML = `
            <div id="cutscene12-content">

                <div id="elevator">
                    <p>That's strange. The elevator still works.</p>
                </div>

                <div id="thought">
                    <p>Looks like the power is still on in some parts of the facility...</p>
                </div>

                <div id="thought2">
                    <p>But why keep it on if no one is here?</p>
                </div>

                <div id="thought3">
                    <p>Maybe they were expecting someone to come back. Or they are containing something...</p>
                </div>

                <div id="noise">
                    <p>Something is down there. Whatever they were doing here, it's still alive.</p>
                </div>


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
      #cutscene-12 {
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
      #cutscene12-content {
        max-width: 800px;
        text-align: center;
        line-height: 1.6;
        font-size: 1.8rem;
        text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
      }

      /* Each dialogue block fades in and out sequentially */
      #cutscene12-content > div {
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
        //Start elevator background sound immediately
        this.playElevatorSound();

        const lines = [
            'elevator',
            'thought',
            'thought2',
            'thought3'
        ];

         // Show first 4 lines sequentially
          lines.forEach((id, index) => {
            const el = document.getElementById(id);
            setTimeout(() => { el.style.opacity = 1; }, index * 3500);
            setTimeout(() => { el.style.opacity = 0; }, (index + 1) * 3500);
        });

            const growlDuration = 3500;
            this.growlTimeout = setTimeout(() => { 
                
                this.playGrowlSound();


                setTimeout(() => {
            const lastLine = document.getElementById('noise');
            lastLine.style.opacity = 1;

                setTimeout(() => { lastLine.style.opacity = 0; }, 3500);
            }, growlDuration);


                this.growlTimeout = null;
            }, 4*3500); //play growl as last line on dialogue
        }

    // --- Sound helper functions ---
    playElevatorSound() {
        this.elevatorSound = new Audio(assetUrl('assets/elevator_loop.wav'));
        this.elevatorSound.loop = true;
        this.elevatorSound.volume = 0.4; // subtle hum
        this.elevatorSound.play().catch(() => {});
    }

    playGrowlSound() {
        this.growlSound = new Audio(assetUrl('assets/elevator_growl.wav'));
        this.growlSound.volume = 0.7; // scary, more prominent
        this.growlSound.play().catch(() => {});
    }

    // Stop sounds safely
    stopSounds() {
        if (this.elevatorSound) {
            this.elevatorSound.pause();
            this.elevatorSound = null;
        }
        if (this.growlSound) {
            this.growlSound.pause();
            this.growlSound = null;
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
