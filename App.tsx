import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PreparationForm } from './components/PreparationForm.tsx';
import { RefineStage } from './components/RefineStage.tsx';
import { Envelope } from './components/Envelope.tsx';
import { MainExperience } from './components/MainExperience.tsx';
import { SharePackage } from './components/SharePackage.tsx';
import { InteractiveQuestion } from './components/InteractiveQuestion.tsx';
import { SoulmateSync } from './components/SoulmateSync.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { PaymentStage } from './components/PaymentStage.tsx';

import { MasterControl } from './components/MasterControl.tsx';
import { PersonalIntro } from './components/PersonalIntro.tsx';
import { CoupleData, AppStage, Theme } from './types.ts';
import { useLinkLoader, LoaderState } from './hooks/useLinkLoader';
import { validateCoupleData } from './utils/validator.ts';

const THEME_BG_COLORS: Record<Theme, string> = {
  obsidian: '#050505',
  velvet: '#1A0B2E',
  crimson: '#2B0A0A',
  midnight: '#0f172a',
  evergreen: '#022c22',
  pearl: '#ffffff'
};

const STUDIO_BG_COLOR = '#1C1917';


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
    case AppStage.PERSONAL_INTRO:
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
  const { state: linkState, data: sharedData, error: linkError } = useLinkLoader();
  
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [data, setData] = useState<CoupleData | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  const [isCreatorPreview, setIsCreatorPreview] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);

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

  // DEV PREVIEW — ?preview=receiver|intro|envelope|letter
  useEffect(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get('preview');
      if (!preview) return;

      // Theme override: ?theme=velvet, ?theme=crimson, etc.
      const themeParam = params.get('theme') as Theme | null;
      const VALID_THEMES: Theme[] = ['obsidian', 'velvet', 'crimson', 'midnight', 'evergreen', 'pearl'];
      const selectedTheme: Theme = (themeParam && VALID_THEMES.includes(themeParam)) ? themeParam : 'obsidian';

      // High-quality free stock images (Unsplash — no auth needed)
      const IMG = {
        cover: 'https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=800&q=80',
        memory1: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80',
        memory2: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80',
        memory3: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=80',
        memory4: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=600&q=80',
        memory5: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=80',
      };

      const mockData: CoupleData = {
        sessionId: 'dev-preview-001',
        recipientName: 'Saniya',
        senderName: 'Ajmal',
        timeShared: '3 beautiful years',
        relationshipIntent: 'Deeply romantic, grateful, and present.',
        sharedMoment: 'When we got lost in the old city and found that rooftop café where the stars felt close enough to touch.',
        occasion: 'valentine',
        writingMode: 'assisted',
        theme: selectedTheme,
        myth: 'Three years. One story. Still unfolding.',

        finalLetter: 'From the moment I first saw you, I knew something had shifted in the universe. Not dramatically — more like a quiet rearrangement of priorities.\n\nYou taught me that love is not a grand gesture. It is the way you remember how I take my coffee. The way you laugh at my worst jokes. The way you hold my hand when I am anxious without me having to ask.\n\nThere are nights I lie awake wondering what I did to deserve this. Wondering how one person can make an entire city feel like home. You are my answer to every question I was afraid to ask.\n\nEvery morning with you feels like a gift I did nothing to deserve. And yet here we are — improbably, stubbornly, beautifully together.\n\nI do not know what the future holds. But I know that whatever it is, I want to face it standing next to you. Always.',

        // Cover image
        userImageUrl: IMG.cover,

        // Memory board — 5 photos with captions
        memoryBoard: [
          { url: IMG.memory1, caption: 'That first evening', angle: -4, xOffset: -15, yOffset: -10 },
          { url: IMG.memory2, caption: 'Lost in the old city', angle: 3, xOffset: 20, yOffset: 5 },
          { url: IMG.memory3, caption: 'Our quiet place', angle: -2, xOffset: -8, yOffset: 15 },
          { url: IMG.memory4, caption: 'You laughed so hard', angle: 5, xOffset: 12, yOffset: -5 },
          { url: IMG.memory5, caption: 'Unplanned and perfect', angle: -3, xOffset: -20, yOffset: 8 },
        ],

        // Sacred location
        sacredLocation: {
          placeName: 'The Rooftop Café, Old City',
          description: 'Where we got lost and found something better. The stars felt close enough to touch.',
          googleMapsUri: 'https://maps.google.com/?q=26.9124,75.7873',
          latLng: { lat: 26.9124, lng: 75.7873 },
        },

        // Promises (coupons)
        coupons: [
          { id: 'c1', title: 'One Midnight Drive', description: 'No destination. No map. Just us, the road, and whatever playlist you choose.', icon: '🌙', isOpen: true },
          { id: 'c2', title: 'A Full Day of Yes', description: 'Whatever you want — wherever you want — no questions asked. Your wish is literally my command.', icon: '✨', isOpen: true },
          { id: 'c3', title: 'Breakfast in Bed', description: 'Handmade by me. Served on the good plates. You don\'t lift a finger until noon.', icon: '🍳', isOpen: true },
        ],

        // Gift
        hasGift: true,
        giftType: 'gastronomy',
        giftTitle: 'Dinner at That Rooftop Place',
        giftLink: 'https://example.com/reservation',

        // Music
        musicType: 'preset',
        musicUrl: '',

        // Reveal
        revealMethod: 'immediate',
        replyEnabled: true,

        // Timestamps
        sealedAt: new Date().toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      };

      setData(mockData);
      setIsBooting(false);
      setIsFadingOut(true);

      if (preview === 'intro') safeSetStage(AppStage.PERSONAL_INTRO);
      else if (preview === 'envelope') safeSetStage(AppStage.ENVELOPE);
      else if (preview === 'letter' || preview === 'main') safeSetStage(AppStage.MAIN_EXPERIENCE);
      else if (preview === 'receiver') safeSetStage(AppStage.PERSONAL_INTRO);
    }
  }, []);

  useEffect(() => {
    // Skip link loader routing when dev preview is active
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('preview')) return;
    }

    if (linkState === LoaderState.SUCCESS && sharedData) {
      setData(hydrateCoupleData(sharedData));
      setIsBooting(false);
      setIsFadingOut(false);
      
      // Check for master role in query params (clean URLs) or hash params (legacy)
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const role = queryParams.get('role') || hashParams.get('role');
      
      if (role === 'master') {
        safeSetStage(AppStage.MASTER_CONTROL);
      } else {
        safeSetStage(AppStage.PERSONAL_INTRO);
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

  // Detect receiver link (path has slug)
  const isReceiverLink = useMemo(() => {
    const path = window.location.pathname;
    return path.length > 1 && !path.startsWith('/api');
  }, []);

  useEffect(() => {
    // Skip boot animation entirely for receiver links
    if (isReceiverLink) return;

    const fadeTimer = setTimeout(() => setIsFadingOut(true), 2200);
    const endTimer = setTimeout(() => setIsBooting(false), 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [isReceiverLink]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const applyColor = (color: string) => {
      document.body.style.backgroundColor = color;
    };

    switch (stage) {
      case AppStage.LANDING:
      case AppStage.MASTER_CONTROL:
      case AppStage.PERSONAL_INTRO: {
        document.body.style.transition = 'background-color 0.5s ease';
        applyColor('#000000');
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

  const bootScreen = (
    <div className={`boot-screen-container ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="relative flex flex-col items-center">
        <div className="mb-12 relative w-32 h-32 flex items-center justify-center animate-boot-logo">
           <div className="absolute inset-0 border-[0.5px] rounded-full" style={{ borderColor: 'rgba(198,168,90,0.35)' }}></div>
           <div className="absolute inset-2 border-[0.5px] rounded-full" style={{ borderColor: 'rgba(198,168,90,0.2)' }}></div>
           <span 
             className="text-5xl font-serif-elegant italic select-none"
             style={{ 
               color: '#C6A85A', 
               letterSpacing: '-0.03em',
               textShadow: '0 0 12px rgba(198,168,90,0.25)',
             }}
           >V</span>
        </div>
        
        <div className="overflow-hidden mb-4 text-center">
          <h1 
            className="text-[13px] font-bold uppercase animate-boot-text"
            style={{ 
              color: '#C6A85A', 
              letterSpacing: '1em',
              textShadow: '0 0 12px rgba(198,168,90,0.25)',
            }}
          >
            VOW
          </h1>
          <p 
            className="text-[7px] uppercase mt-3 animate-fade-in"
            style={{ 
              animationDelay: '1.2s',
              color: 'rgba(198,168,90,0.6)',
              letterSpacing: '0.7em',
            }}
          >
            Sealed Moment
          </p>
        </div>
        
        <div className="animate-boot-line" style={{ height: '0.5px', backgroundColor: 'rgba(198,168,90,0.6)' }}></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-1000">
      {isBooting && !isReceiverLink && bootScreen}
      {isReceiverLink && linkState === LoaderState.LOADING && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: '#000' }} />
      )}

      <div className="fixed inset-0 pointer-events-none opacity-[0.04] z-0" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper.png")' }}></div>
      
      {stage === AppStage.PREPARE && (
        <>
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-0"></div>
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,rgba(60,50,40,0.04)_0%,transparent_70%)] z-0"></div>
        </>
      )}

      <main className={`relative z-10 w-full min-h-screen transition-opacity duration-1000 ${isBooting && !isReceiverLink ? 'opacity-0' : 'opacity-100'}`}>
        
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

        {stage === AppStage.PERSONAL_INTRO && data && (
          <PersonalIntro
            recipientName={data.recipientName}
            theme={data.theme}
            onComplete={() => safeSetStage(AppStage.ENVELOPE)}
          />
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
              onPaymentComplete={(result: { replyEnabled: boolean; sessionKey: string; shareSlug: string }) => {
                updateData({ replyEnabled: result.replyEnabled, sealedAt: new Date().toISOString() });
                setSessionKey(result.sessionKey);
                setShareSlug(result.shareSlug);
                safeSetStage(AppStage.SHARE);
              }}
              onBack={() => {
                safeSetStage(AppStage.MAIN_EXPERIENCE); 
                setIsCreatorPreview(true);
              }}
            />
          </div>
        )}

        {stage === AppStage.SHARE && data && sessionKey && shareSlug && (
          <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
            <SharePackage 
              data={data} 
              sessionKey={sessionKey}
              shareSlug={shareSlug}
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

      {/* Dev Theme Switcher — only in preview mode */}
      {import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') && data && (
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-black/90 border-t border-white/10 px-4 py-3 flex items-center justify-center gap-3 backdrop-blur-sm">
          <span className="text-[8px] uppercase tracking-widest text-white/30 mr-2">Theme</span>
          {(['obsidian', 'velvet', 'crimson', 'midnight', 'evergreen', 'pearl'] as Theme[]).map((t) => {
            const colors: Record<Theme, string> = {
              obsidian: '#D4AF37',
              velvet: '#C084FC',
              crimson: '#FDA4AF',
              midnight: '#93c5fd',
              evergreen: '#d97706',
              pearl: '#a8a29e',
            };
            const isActive = data.theme === t;
            return (
              <button
                key={t}
                onClick={() => {
                  updateData({ theme: t } as Partial<CoupleData>);
                  document.body.style.backgroundColor = THEME_BG_COLORS[t];
                }}
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded transition-all ${isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
              >
                <div 
                  className="w-5 h-5 rounded-full border-2" 
                  style={{ 
                    backgroundColor: THEME_BG_COLORS[t], 
                    borderColor: isActive ? colors[t] : 'transparent',
                    boxShadow: isActive ? `0 0 8px ${colors[t]}40` : 'none',
                  }} 
                />
                <span className="text-[7px] uppercase tracking-wider text-white/50">{t}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default App;