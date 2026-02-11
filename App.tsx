import React, { useState, useEffect, useRef } from 'react';
import { PreparationForm } from './components/PreparationForm.tsx';
import { RefineStage } from './components/RefineStage.tsx';
import { Envelope } from './components/Envelope.tsx';
import { MainExperience } from './components/MainExperience.tsx';
import { SharePackage } from './components/SharePackage.tsx';
import { InteractiveQuestion } from './components/InteractiveQuestion.tsx';
import { SoulmateSync } from './components/SoulmateSync.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { PaymentStage } from './components/PaymentStage.tsx';
import { BackgroundAudio } from './components/BackgroundAudio.tsx';
import { MasterControl } from './components/MasterControl.tsx';
import { CoupleData, AppStage, Theme } from './types.ts';
import { useSharedLinkLoader, LoaderState } from './hooks/useSharedLinkLoader';
import { validateCoupleData } from './utils/validator.ts';

const THEME_BG_COLORS: Record<Theme, string> = {
  obsidian: '#FAF6F1',
  velvet: '#1A0B2E',
  crimson: '#2B0A0A',
  midnight: '#0f172a',
  evergreen: '#022c22',
  pearl: '#ffffff'
};

const STUDIO_BG_COLOR = '#1C1917';
const DEFAULT_AMBIENT_MUSIC = 'https://ia800201.us.archive.org/12/items/GymnopedieNo1/GymnopedieNo1.mp3';

const STORAGE_KEY = 'vday_data';

const hydrateCoupleData = (value: CoupleData): CoupleData => ({
  ...value,
  theme: value.theme ?? 'obsidian',
});

const assertNever = (value: never): never => {
  throw new Error(`Unhandled AppStage: ${value}`);
};

const ensureExhaustiveStage = (stage: AppStage): void => {
  switch (stage) {
    case AppStage.LANDING:
    case AppStage.PREPARE:
    case AppStage.REFINE:
    case AppStage.PREVIEW:
    case AppStage.PAYMENT:
    case AppStage.SHARE:
    case AppStage.ENVELOPE:
    case AppStage.QUESTION:
    case AppStage.SOULMATE_SYNC:
    case AppStage.MAIN_EXPERIENCE:
    case AppStage.MASTER_CONTROL:
      return;
    default:
      assertNever(stage as never);
  }
};

const readPersistedCoupleData = (): CoupleData | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const result = validateCoupleData(parsed);
    if (!result.success) {
      console.warn('[Persistence] Discarding invalid CoupleData from storage');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return hydrateCoupleData(result.data);
  } catch (e) {
    console.error('[Persistence] Failed to read CoupleData from storage', e);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const writePersistedCoupleData = (value: CoupleData): void => {
  const hydrated = hydrateCoupleData(value);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
  } catch (e) {
    console.error('[Persistence] Failed to write CoupleData to storage', e);
  }
};

const App: React.FC = () => {
  const { state: linkState, data: sharedData, error: linkError } = useSharedLinkLoader();
  
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [data, setData] = useState<CoupleData | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isCreatorPreview, setIsCreatorPreview] = useState(false);

  const previousStageRef = useRef<AppStage | null>(null);

  const safeSetStage = (nextStage: AppStage) => {
    ensureExhaustiveStage(nextStage);
    setStage(prev => {
      if (prev === nextStage) {
        console.warn('[AppStage] Redundant transition', { from: prev, to: nextStage });
        return prev;
      }
      previousStageRef.current = prev;
      return nextStage;
    });
  };

  const updateData = (patch: Partial<CoupleData>) => {
    setData(prev => (prev ? { ...prev, ...patch } : prev));
  };

  useEffect(() => {
    if (linkState === LoaderState.SUCCESS && sharedData) {
      setData(hydrateCoupleData(sharedData));
      
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const role = params.get('role');
      
      if (role === 'master') {
        safeSetStage(AppStage.MASTER_CONTROL);
      } else {
        safeSetStage(AppStage.ENVELOPE);
      }
    } else if (linkState === LoaderState.NO_LINK) {
      safeSetStage(AppStage.LANDING);
      
      const persisted = readPersistedCoupleData();
      if (persisted) {
        setData(persisted);
      }
    } else if (linkState === LoaderState.ERROR) {
      console.error('Link loading error:', linkError);
      safeSetStage(AppStage.LANDING);
    }
  }, [linkState, sharedData, linkError]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsFadingOut(true), 2200);
    const endTimer = setTimeout(() => setIsBooting(false), 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, []);

  useEffect(() => {
    if (hasInteracted) return;

    const unlockAudio = () => {
      if (!hasInteracted) setHasInteracted(true);
    };
    
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [hasInteracted]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const applyColor = (color: string) => {
      document.body.style.backgroundColor = color;
    };

    switch (stage) {
      case AppStage.LANDING:
      case AppStage.MASTER_CONTROL: {
        applyColor('#050505');
        break;
      }
      case AppStage.PREPARE: {
        document.body.style.transition = 'background-color 2.5s ease-out';
        applyColor(STUDIO_BG_COLOR);
        break;
      }
      case AppStage.ENVELOPE: {
        if (!data) {
          applyColor('#050505');
          break;
        }

        if (previousStageRef.current === AppStage.REFINE) {
          document.body.style.transition = 'background-color 2s ease-in-out';
          applyColor('#000000');
          timeoutId = window.setTimeout(() => {
            applyColor(THEME_BG_COLORS[data.theme]);
          }, 600);
        } else if (previousStageRef.current === AppStage.SHARE) {
          applyColor(THEME_BG_COLORS[data.theme]);
        } else {
          applyColor(THEME_BG_COLORS[data.theme]);
        }
        break;
      }
      case AppStage.REFINE: {
        if (previousStageRef.current === AppStage.MAIN_EXPERIENCE) {
          applyColor(STUDIO_BG_COLOR);
        }
        break;
      }
      case AppStage.PAYMENT: {
        if (previousStageRef.current === AppStage.MAIN_EXPERIENCE) {
          applyColor(STUDIO_BG_COLOR);
        }
        break;
      }
      case AppStage.MAIN_EXPERIENCE: {
        if (previousStageRef.current === AppStage.PAYMENT && data) {
          applyColor(THEME_BG_COLORS[data.theme]);
        }
        break;
      }
      case AppStage.SHARE: {
        if (previousStageRef.current === AppStage.PAYMENT) {
          applyColor(STUDIO_BG_COLOR);
        }
        break;
      }
      case AppStage.QUESTION:
      case AppStage.SOULMATE_SYNC:
      case AppStage.PREVIEW: {
        break;
      }
      default: {
        assertNever(stage as never);
      }
    }

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [stage, data]);

  const handleEnterStudio = () => {
    safeSetStage(AppStage.PREPARE);
  };

  const handleEnvelopeInteract = () => {
    // Envelope interaction logic
  };

  const handleEnvelopeOpen = () => {
    safeSetStage(AppStage.QUESTION);
  };

  const handleQuestionAccepted = () => {
    if (data?.revealMethod === 'sync') {
      safeSetStage(AppStage.SOULMATE_SYNC);
    } else {
      safeSetStage(AppStage.MAIN_EXPERIENCE);
    }
  };

  // Music logic (unchanged)
  const currentMusicUrl = (stage === AppStage.MAIN_EXPERIENCE || stage === AppStage.ENVELOPE || stage === AppStage.PREVIEW || stage === AppStage.SHARE) && data?.musicUrl 
    ? data.musicUrl 
    : DEFAULT_AMBIENT_MUSIC;

  const currentMusicType = (stage === AppStage.MAIN_EXPERIENCE || stage === AppStage.ENVELOPE || stage === AppStage.PREVIEW || stage === AppStage.SHARE) && data?.musicType 
    ? data.musicType 
    : 'preset';

  const shouldPlay = hasInteracted && !isGlobalMuted && stage !== AppStage.MASTER_CONTROL;

  const bootScreen = (
    <div className={`boot-screen-container ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="relative flex flex-col items-center">
        <div className="mb-12 relative w-32 h-32 flex items-center justify-center animate-boot-logo">
           <div className="absolute inset-0 border-[0.5px] border-luxury-gold/50 rounded-full"></div>
           <div className="absolute inset-2 border-[0.5px] border-luxury-gold/30 rounded-full"></div>
           <span className="text-5xl font-serif-elegant italic text-luxury-gold select-none tracking-tighter">V</span>
        </div>
        
        <div className="overflow-hidden mb-4 text-center">
          <h1 className="text-[13px] font-bold text-luxury-gold uppercase tracking-[1em] animate-boot-text">
            VOW
          </h1>
          <p className="text-[7px] text-luxury-gold/70 tracking-[0.6em] uppercase mt-2 animate-fade-in" style={{ animationDelay: '1.2s' }}>
            Private Studio
          </p>
        </div>
        
        <div className="h-[0.5px] bg-luxury-gold/80 animate-boot-line"></div>
        
        <p className="absolute bottom-[-100px] text-[8px] tracking-[0.4em] uppercase text-luxury-gold/60 italic">
          Private Expression Studio
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-1000">
      {isBooting && bootScreen}
      
      <BackgroundAudio 
        musicUrl={currentMusicUrl} 
        musicType={currentMusicType} 
        isPlaying={shouldPlay} 
        onPlayError={() => setIsGlobalMuted(true)}
      />

      {!isBooting && stage !== AppStage.MASTER_CONTROL && (
          <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                setIsGlobalMuted(!isGlobalMuted); 
                if (!hasInteracted) setHasInteracted(true);
            }}
            className={`fixed top-6 left-6 z-[100] p-3 rounded-full border backdrop-blur-md transition-all duration-500 group overflow-hidden ${shouldPlay ? 'border-luxury-gold/30 bg-black/20 hover:bg-luxury-gold/10' : 'border-white/10 bg-black/40 opacity-70 hover:opacity-100'}`}
          >
             {shouldPlay ? (
               <div className="flex gap-1 h-3 items-end">
                  <div className="w-0.5 bg-luxury-gold animate-[bounce_1s_infinite]"></div>
                  <div className="w-0.5 bg-luxury-gold animate-[bounce_1.2s_infinite]"></div>
                  <div className="w-0.5 bg-luxury-gold animate-[bounce_0.8s_infinite]"></div>
               </div>
             ) : (
                <div className="relative">
                   <span className="text-xs text-white/60">♪</span>
                   <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/60 rotate-45 transform -translate-y-1/2"></div>
                </div>
             )}
             
             <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 text-[8px] uppercase tracking-widest text-luxury-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-black/50 px-2 py-1 rounded">
                {isGlobalMuted ? 'Unmute Sound' : 'Mute Sound'}
             </span>
          </button>
      )}

      <div className="fixed inset-0 pointer-events-none opacity-[0.04] z-0" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper.png")' }}></div>
      
      {stage === AppStage.PREPARE && (
        <>
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-0"></div>
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,rgba(60,50,40,0.04)_0%,transparent_70%)] z-0"></div>
        </>
      )}

      <main className={`relative z-10 w-full min-h-screen transition-opacity duration-1000 ${isBooting ? 'opacity-0' : 'opacity-100'}`}>
        
        {stage === AppStage.LANDING && (
          <LandingPage onEnter={handleEnterStudio} />
        )}

        {stage === AppStage.PREPARE && (
          <div className="animate-fade-in py-12 px-4">
             <PreparationForm onComplete={(d) => { setData(hydrateCoupleData(d)); safeSetStage(AppStage.REFINE); }} />
          </div>
        )}

        {stage === AppStage.REFINE && data && (
          <RefineStage 
            data={data} 
            onSave={(finalLetter, enrichedData) => {
              if (!data) return;
              const updated: CoupleData = hydrateCoupleData({ ...data, ...enrichedData, finalLetter });
              setData(updated);
              setIsCreatorPreview(true);
              safeSetStage(AppStage.ENVELOPE); 
              writePersistedCoupleData(updated);
            }}
            onBack={() => safeSetStage(AppStage.PREPARE)}
          />
        )}

        {stage === AppStage.MASTER_CONTROL && data && (
          <MasterControl data={data} />
        )}

        {stage === AppStage.ENVELOPE && data && (
          <div className="animate-fade-in flex items-center justify-center min-h-screen">
            {isCreatorPreview && (
               <div className="fixed top-0 left-0 w-full bg-[#1C1917] text-luxury-gold z-[100] py-3 text-center shadow-lg border-b border-luxury-gold/20">
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] animate-pulse">Previewing Receiver Experience</p>
               </div>
            )}
            <Envelope 
              recipientName={data.recipientName} 
              theme={data.theme || 'obsidian'}
              onOpen={handleEnvelopeOpen} 
              onInteract={handleEnvelopeInteract}
            />
          </div>
        )}

        {stage === AppStage.QUESTION && data && (
          <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
            <InteractiveQuestion 
               data={data} 
               onAccept={handleQuestionAccepted} 
            />
          </div>
        )}

        {stage === AppStage.SOULMATE_SYNC && data && (
          <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
            <SoulmateSync 
              senderName={data.senderName} 
              sessionId={data.sessionId}
              onComplete={() => safeSetStage(AppStage.MAIN_EXPERIENCE)} 
            />
          </div>
        )}

        {stage === AppStage.MAIN_EXPERIENCE && data && (
          <div className="animate-fade-in relative">
            <MainExperience 
              data={data} 
              isPreview={isCreatorPreview}
              onEdit={() => {
                safeSetStage(AppStage.REFINE);
                setIsCreatorPreview(false);
              }}
              onPayment={() => {
                safeSetStage(AppStage.PAYMENT);
              }}
            />
          </div>
        )}

        {stage === AppStage.PAYMENT && data && (
          <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
            <PaymentStage 
              data={data} 
              onPaymentComplete={() => safeSetStage(AppStage.SHARE)}
              onBack={() => {
                safeSetStage(AppStage.MAIN_EXPERIENCE); 
                setIsCreatorPreview(true);
              }}
            />
          </div>
        )}

        {stage === AppStage.SHARE && data && (
          <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
            <SharePackage 
              data={data} 
              onPreview={() => {
                 safeSetStage(AppStage.ENVELOPE);
                 setIsCreatorPreview(false); 
              }} 
              onEdit={() => safeSetStage(AppStage.PREPARE)}
            />
          </div>
        )}
      </main>

      <style>{`
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(20px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fade-in { animation: fade-in 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        
        @keyframes boot-logo {
          0% { transform: scale(0.8); opacity: 0; }
          20% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        .animate-boot-logo { animation: boot-logo 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

        @keyframes boot-text {
          0% { opacity: 0; letter-spacing: 0em; }
          40% { opacity: 1; letter-spacing: 1em; }
          80% { opacity: 1; letter-spacing: 1em; }
          100% { opacity: 0; letter-spacing: 1.2em; }
        }
        .animate-boot-text { animation: boot-text 2.5s ease-out forwards; }
        
        @keyframes boot-line {
          0% { width: 0; opacity: 0; }
          40% { width: 100px; opacity: 1; }
          80% { width: 100px; opacity: 0.5; }
          100% { width: 0; opacity: 0; }
        }
        .animate-boot-line { animation: boot-line 2.5s ease-in-out forwards; }
      `}</style>
    </div>
  );
};

export default App;