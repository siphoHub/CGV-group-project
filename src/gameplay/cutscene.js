// Star Wars-style opening cutscene for Mutation Detective Horror Game
export class OpeningCutscene {
  constructor() {
    this.isPlaying = false;
    this.cutsceneContainer = null;
    this.onComplete = null;
    this.skipTimeout = null;
    this.skipEnabled = false;
    this.skipPrompt = null;
  }

  // Create and start the opening cutscene
  play(onCompleteCallback, levelLoadCallback) {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.onComplete = onCompleteCallback;
    this.createCutsceneElements();
    
    // Add skip listener
    this.addSkipListener();
    
    // Enable skip after 10 seconds
    setTimeout(() => {
      this.enableSkip();
    }, 10000);
    
    // Start loading the level in parallel after a short delay
    if (levelLoadCallback) {
      setTimeout(() => {
        levelLoadCallback();
      }, 2000); // Start loading 2 seconds into cutscene
    }
    
    // Auto-complete after cutscene duration
    this.skipTimeout = setTimeout(() => {
      this.end();
    }, 60000); // 60 seconds total duration (6 paragraphs * 9 seconds + title time)
  }

  createCutsceneElements() {
    this.cutsceneContainer = document.createElement('div');
    this.cutsceneContainer.id = 'opening-cutscene';
    this.cutsceneContainer.innerHTML = `
      <div id="cutscene-stars"></div>
      <div id="cutscene-content">
        <div id="cutscene-title">
          <h1>MUTATION DETECTIVE</h1>
          <h2>THE ABANDONED FACILITY</h2>
        </div>
        
        <div id="cutscene-crawl">
          <div id="crawl-text">
            <p>Years ago, a secret government facility was shut down after a mysterious outbreak.</p>
            
            <p>Rumors say it was a bioweapons research lab where scientists experimented with living organisms, splicing DNA and testing mutations that were never meant to exist.</p>
            
            <p>One night, the entire staff disappeared without explanation. The doors were sealed, the surface was quarantined, and all records of the project were erased.</p>
            
            <p>Now, you are a freelance investigator hired to uncover the truth. Armed with only a flashlight and a basic toolkit, you enter the facility to document what really happened.</p>
            
            <p>What horrors await in the depths of this abandoned laboratory? What twisted experiments were conducted in these darkened halls?</p>
            
            <p>The truth lies buried in the shadows...</p>
          </div>
        </div>
        
        <div id="skip-prompt" style="display: none;">
          Press <span class="skip-key">SPACE</span> to skip
        </div>
      </div>
    `;

    this.addCutsceneStyles();
    document.body.appendChild(this.cutsceneContainer);

    // Start animations
    this.startAnimations();
  }

  addCutsceneStyles() {
    const styles = document.createElement('style');
    styles.id = 'cutscene-styles';
    styles.textContent = `
      #opening-cutscene {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: #000;
        z-index: 10000;
        overflow: hidden;
        font-family: 'Arial', sans-serif;
        color: #FFFFFF;
      }

      #cutscene-stars {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: #000000;
      }

      #cutscene-content {
        position: relative;
        width: 100%;
        height: 100%;
        perspective: 400px;
      }

      #cutscene-title {
        position: absolute;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        z-index: 2;
        opacity: 0;
        animation: titleFade 4s ease-in-out forwards;
      }

      #cutscene-title h1 {
        font-size: 5rem;
        font-weight: bold;
        margin: 0;
        text-shadow: 3px 3px 6px rgba(0,0,0,0.9);
        letter-spacing: 0.3em;
      }

      #cutscene-title h2 {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 0.5rem 0 0 0;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.9);
        letter-spacing: 0.2em;
      }

      @keyframes titleFade {
        0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
        15% { opacity: 1; transform: translateX(-50%) scale(1); }
        85% { opacity: 1; transform: translateX(-50%) scale(1); }
        100% { opacity: 0; transform: translateX(-50%) scale(1.1); }
      }

      #cutscene-crawl {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 900px;
        height: auto;
      }

      #crawl-text {
        font-size: 2rem;
        font-weight: bold;
        line-height: 2.2;
        text-align: center;
        padding: 0 2rem;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.9);
      }

      #crawl-text p {
        margin: 3rem 0;
        opacity: 0;
        animation: simpleFade 9s ease-in-out forwards;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
      }

      #crawl-text p:nth-child(1) { animation-delay: 6s; }
      #crawl-text p:nth-child(2) { animation-delay: 15s; }
      #crawl-text p:nth-child(3) { animation-delay: 24s; }
      #crawl-text p:nth-child(4) { animation-delay: 33s; }
      #crawl-text p:nth-child(5) { animation-delay: 42s; }
      #crawl-text p:nth-child(6) { animation-delay: 51s; }

      @keyframes simpleFade {
        0% { opacity: 0; }
        11% { opacity: 1; }
        89% { opacity: 1; }
        100% { opacity: 0; }
      }

      #skip-prompt {
        position: absolute;
        bottom: 30px;
        right: 30px;
        font-size: 1.2rem;
        color: rgba(255, 255, 255, 0.7);
        animation: skipBlink 2s ease-in-out infinite;
        z-index: 3;
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

      /* Responsive adjustments */
      @media (max-width: 768px) {
        #cutscene-title h1 { font-size: 3rem; }
        #cutscene-title h2 { font-size: 1.8rem; }
        #crawl-text { font-size: 1.5rem; padding: 0 1rem; }
      }
    `;
    document.head.appendChild(styles);
  }

  startAnimations() {
    // Additional sound effect trigger could go here
    // this.playOpeningMusic();
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
