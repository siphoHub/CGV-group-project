//cutscene between levels 2 and 3

export class cutscene23{

    constructor(backgroundImage = null) {
        this.isPlaying = false;
        this.cutsceneContainer = null;
        this.onComplete = null;
        this.skipTimeout = null;
        this.skipEnabled = false;
        this.skipPrompt = null; //space to skip
        this.metalSound = null;
        this.creatureSound = null;
        this.flashlightSound = null;
        this.breathingSound = null;
        this.backgroundImage = backgroundImage;
    }


    //create and start the cutscene btwn levels 2 and 3
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
            }, 3500); //start loading level 3 after 3.5 seconds
        }

        this.skipTimeout = setTimeout(() => {
            this.end();
        }, 30000); //30 seconds total duration
    }//play func



    createCutsceneElements(){
        this.cutsceneContainer = document.createElement("div");
        this.cutsceneContainer.id = 'cutscene-23';

        if (this.backgroundImage) {
            this.cutsceneContainer.style.backgroundImage = `url(${this.backgroundImage})`;
            this.cutsceneContainer.style.backgroundSize = 'cover';
            this.cutsceneContainer.style.backgroundPosition = 'center';
        }

        this.cutsceneContainer.innerHTML = `
        <div id="cutscene23-content">
            <div id="thought1">
                <p>The air in here...it's thick. The logs warned about this place.</p>
            </div>

            <div id="metalclatter">
                <p>Something's not right.</p>
            </div>

            <div id="thought2">
                <p>What was that?</p>
            </div>

            <div id="creature-glimpse">
                <p>Hello... Is someone there?</p>
            </div>

            <div id="flashlightdrop">
                <p>No, no, no! My flashlight is broken!</p>
            </div>

            <div id="finalthought">
                <p>I have to get out of here. I'm not alone.</p>
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
        #cutscene-23 {
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

      #cutscene23-content {
        max-width: 800px;
        text-align: center;
        line-height: 1.6;
        font-size: 1.8rem;
        text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
      }

       #cutscene23-content > div {
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
        position: relative;
        z-index: 8;
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

      #cutscene23-content {
        animation: flicker 6s infinite;
      }

      /* Responsive text for smaller screens */
      @media (max-width: 768px) {
        #cutscene23-content {
          font-size: 1.3rem;
          line-height: 1.4;
        }
      }

      
    `;
    document.head.appendChild(styles);
}

startAnimations() {
    const show = (id, delay) =>
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.style.opacity = 1;
      }, delay);

    const hide = (id, delay) =>
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.style.opacity = 0;
      }, delay);

    // Timing and events
    show("thought1", 1000);
    hide("thought1", 4000);

    show("metalclatter", 5000);
    hide("metalclatter", 8000);
    this.playMetalSound(8200);

    show("thought2", 12000);
    hide("thought2", 15000);

    
    this.playCreatureSound(12000);
   

    // Shadow moves across
    setTimeout(() => {
        const shadow = document.createElement('div');
        Object.assign(shadow.style, {
            position: 'absolute',
            top: '0',
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            transition: 'left 0.5s linear',
            zIndex: '5',
        });
        this.cutsceneContainer.appendChild(shadow);
        setTimeout(() => shadow.style.left = '100%', 50);
        setTimeout(() => shadow.remove(), 600);

        // Flashlight flicker
        const flicker = document.createElement('div');
        Object.assign(flicker.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.3)',
            zIndex: '6',
            opacity: '0',
        });
        this.cutsceneContainer.appendChild(flicker);
        const flickerPattern = [200, 400, 450, 700, 800, 900, 1000, 1150, 1200, 1400];
        flickerPattern.forEach(t => {
            setTimeout(() => {
                flicker.style.opacity = Math.random() > 0.5 ? '0.4' : '0.1';
                setTimeout(() => flicker.style.opacity = '0', 80);
            }, t);
        });

        // Flashlight breaks (screen goes dark)
        setTimeout(() => {
            const darkness = document.createElement('div');
            Object.assign(darkness.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.7)',
                transition: 'opacity 2s ease',
                opacity: '0',
                zIndex: '4',
            });
            this.cutsceneContainer.appendChild(darkness);
            setTimeout(() => darkness.style.opacity = '1', 100);
        }, 1500);

    }, 12000); // same time as creature sound


     show("creature-glimpse", 16000);
    hide("creature-glimpse", 19000);

    this.playBreathingSound(19000);

    //this.playFlashlightSound(16000);
    show("flashlightdrop", 19500);
    hide("flashlightdrop", 22500);

    
    show("finalthought", 25500);
  }

  playMetalSound(delay) {
    setTimeout(() => {
      this.metalSound = new Audio("models/assets/metal_clatter.wav");
      this.metalSound.volume = 0.7;
      this.metalSound.play();
    }, delay);
  }

  playCreatureSound(delay) {
    setTimeout(() => {
      this.creatureSound = new Audio("models/assets/creature_run.wav");
      this.creatureSound.volume = 0.8;
      this.creatureSound.play();
    }, delay);
  }

  playFlashlightSound(delay) {
    setTimeout(() => {
      this.flashlightSound = new Audio("models/assets/flashlight_break.wav");
      this.flashlightSound.volume = 0.8;
      this.flashlightSound.play();
    }, delay);
  }

  playBreathingSound(delay) {
    setTimeout(() => {
      this.breathingSound = new Audio("models/assets/heavy_breathing.mp3");
      this.breathingSound.volume = 0.6;
      this.breathingSound.loop = false;
      this.breathingSound.play();
    }, delay);
  }

  stopSounds() {
    [this.metalSound, this.creatureSound, this.flashlightSound, this.breathingSound].forEach(sound => {
      if (sound) {
        sound.pause();
        sound.currentTime = 0;
      }
    });
  }

  addSkipListener() {
    this.skipHandler = (event) => {
      if (this.skipEnabled && event.code === "Space") {
        event.preventDefault();
        this.skipCutscene();
      }
    };
    document.addEventListener("keydown", this.skipHandler);
  }

  enableSkip() {
    this.skipEnabled = true;
    this.skipPrompt = document.getElementById("skip-prompt");
    if (this.skipPrompt) this.skipPrompt.style.display = "block";
  }

  skipCutscene() {
    if (!this.isPlaying) return;
    this.end();
  }

  removeSkipListener() {
    if (this.skipHandler) {
      document.removeEventListener("keydown", this.skipHandler);
      this.skipHandler = null;
    }
  }

  end() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.skipEnabled = false;

    this.stopSounds();
    this.removeSkipListener();

    if (this.skipTimeout) {
      clearTimeout(this.skipTimeout);
      this.skipTimeout = null;
    }

    if (this.cutsceneContainer) {
      this.cutsceneContainer.style.animation = "fadeOut 1s ease-in-out forwards";
      setTimeout(() => {
        this.cutsceneContainer?.remove();
        document.getElementById("cutscene-styles")?.remove();
        this.cutsceneContainer = null;
        if (this.onComplete) {
          this.onComplete();
          this.onComplete = null;
        }
      }, 1000);
    }
  }

  isActive() {
    return this.isPlaying;
  }

  skip() {
    this.end();
  }
}