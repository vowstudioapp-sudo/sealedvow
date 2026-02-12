import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePreparationState } from '../hooks/usePreparationState';
import { useMediaUploads } from '../hooks/useMediaUploads';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useDictation } from '../hooks/useDictation';
import { CoupleData, Occasion, GiftType, Theme, Coupon, RevealMethod } from '../types.ts';

interface Props {
  onComplete: (data: CoupleData) => void;
}

const OCCASIONS: { id: Occasion; label: string; icon: string; defaultTone: string }[] = [
  // Primary Tier
  { id: 'valentine', label: 'Valentine\'s', icon: '❤️', defaultTone: 'Deeply romantic, grateful, and present.' },
  { id: 'anniversary', label: 'Anniversary', icon: '🥂', defaultTone: 'Nostalgic, proud, and enduring.' },
  { id: 'just-because', label: 'Just Because', icon: '✨', defaultTone: 'Playful, spontaneous, and affectionate.' },
  // Secondary Tier
  { id: 'apology', label: 'I\'m Sorry', icon: '🕯️', defaultTone: 'Humble, sincere, and stripped back.' },
  { id: 'long-distance', label: 'Missing You', icon: '✈️', defaultTone: 'Longing, hopeful, and digitally intimate.' },
  { id: 'thank-you', label: 'A Thank You', icon: '🙏', defaultTone: 'Appreciative, specific, and admiring.' },
];

const THEMES: { id: Theme; label: string; color: string; desc: string }[] = [
  { id: 'obsidian', label: 'Obsidian & Gold', color: '#D4AF37', desc: 'Timeless, Bold, Classic' },
  { id: 'velvet', label: 'Royal Velvet', color: '#9333EA', desc: 'Deep, Mysterious, Spiritual' },
  { id: 'crimson', label: 'Desert Rose', color: '#9F1239', desc: 'Passionate, Warm, Romantic' },
  { id: 'midnight', label: 'Midnight Blue', color: '#1E3A8A', desc: 'Celestial, Infinite, Calm' },
  { id: 'evergreen', label: 'Forest Bronze', color: '#065F46', desc: 'Natural, Grounded, Eternal' },
  { id: 'pearl', label: 'Ethereal Pearl', color: '#F3F4F6', desc: 'Pure, Delicate, Divine' },
];

const MUSIC_PRESETS = [
  { id: 'piano', label: 'Eternal Piano (Satie)', url: 'https://ia800201.us.archive.org/12/items/GymnopedieNo1/GymnopedieNo1.mp3' },
  { id: 'cello', label: 'Deep Cello Suite', url: 'https://ia800305.us.archive.org/24/items/BachCelloSuiteNo.1InGMajor/01-SuiteNo.1InGMajorBwv1007-IPrelude.mp3' },
  { id: 'ambient', label: 'Ethereal Silence', url: 'https://ia902509.us.archive.org/9/items/N5280_Restoration/Restoration.mp3' }
];

const DEFAULT_COUPONS: Coupon[] = [
  { id: 'special', title: 'The Open Invitation', description: 'A quiet morning, or a long walk. Whenever you need me to just be there.', icon: '🕊️', isOpen: false, isSpecial: true },
  { id: '1', title: 'Dinner at Home', description: 'I\'ll cook your favorite thing. No phones, just us.', icon: '🥂', isOpen: false },
  { id: '2', title: 'A Day for You', description: 'I take care of everything else. You just breathe.', icon: '🕯️', isOpen: false },
];

const RITUALS: { id: RevealMethod; title: string; desc: string; icon: string }[] = [
  { id: 'immediate', title: 'Immediate Open', desc: 'Simple and direct. They can open the letter as soon as they receive it. No wait.', icon: '📬' },
  { id: 'remote', title: 'Remote Kiss', desc: 'You control the moment. Use your Master Key to unlock their letter instantly from your phone.', icon: '💋' },
  { id: 'vigil', title: 'Ambient Vigil', desc: 'Set a specific time. Their screen becomes a living countdown art piece until the moment arrives.', icon: '⏳' },
  { id: 'sync', title: 'Soulmate Sync', desc: 'Requires you both to be online. Unlocks only when you both touch your screens at the exact same time.', icon: '⚡' },
];

export const PreparationForm: React.FC<Props> = ({ onComplete }) => {
  const [error, setError] = useState<string | null>(null);
  
  const { step, data, updateData, next, back } = usePreparationState(DEFAULT_COUPONS);
  
  const media = useMediaUploads({
    sessionId: data.sessionId,
    currentMemoryCount: () => data.memoryBoard?.length || 0,
    updateData,
    onError: setError,
  });
  
  const audio = useAudioRecorder({
    sessionId: data.sessionId,
    updateData,
    onError: setError,
  });
  
  const dictation = useDictation({
    onTranscript: (text) => {
      updateData(prev => ({
        finalLetter: (prev.finalLetter || '') + ' ' + text
      }));
    },
    onError: setError,
  });
  const [writingMode, setWritingMode] = useState<'self' | 'assisted'>('assisted');
  
  // UI State for Occasions
  const [showAllOccasions, setShowAllOccasions] = useState(false);
  // UI State for Location Fields (Fix #2)
  const [showLocationFields, setShowLocationFields] = useState(false);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const memoryInputRef = useRef<HTMLInputElement>(null);

  // Preview State
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Scroll lock when photo is zoomed
  useEffect(() => {
    if (activePhoto !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activePhoto]);

  const handleOccasionChange = (occ: Occasion) => {
      const occasionConfig = OCCASIONS.find(o => o.id === occ);
      updateData(prev => ({
          occasion: occ,
          // Auto-inject the tone if it's currently using a default from another occasion or empty
          relationshipIntent: occasionConfig ? occasionConfig.defaultTone : prev.relationshipIntent
      }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    media.uploadCoverImage(file);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    media.uploadVideo(file);
  };

  // --- MEMORY BOARD UPLOAD LOGIC ---
  const handleMemoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    media.uploadMemoryBoard(files);
  };

  const updateMemoryCaption = (index: number, caption: string) => {
    updateData(prev => ({
      memoryBoard: prev.memoryBoard
        ? prev.memoryBoard.map((photo, i) =>
            i === index ? { ...photo, caption } : photo
          )
        : []
    }));
  };

  const removeMemoryPhoto = (index: number) => {
    updateData(prev => ({
      memoryBoard: prev.memoryBoard?.filter((_, i) => i !== index) || []
    }));
  };

  const togglePreview = () => {
    if (!data.audio?.url) return;

    if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio(data.audio.url);
        previewAudioRef.current.onended = () => setIsPreviewPlaying(false);
    } else if (previewAudioRef.current.src !== data.audio.url) {
         previewAudioRef.current.src = data.audio.url;
    }

    if (isPreviewPlaying) {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
    } else {
        previewAudioRef.current.play().catch(e => console.error("Playback failed", e));
        setIsPreviewPlaying(true);
    }
  };

  const handleDeleteRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    audio.deleteRecording();
  };

  const updateCoupon = (index: number, field: keyof Coupon, value: string) => {
    updateData(prev => ({
      coupons: prev.coupons?.map((coupon, i) =>
        i === index ? { ...coupon, [field]: value } : coupon
      ) ?? []
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (step < 3) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      next();
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      onComplete({ ...data, writingMode });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-12 mt-4 mb-32">
      <div className="text-center mb-16 animate-fade-in">
        <h2 className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-luxury-gold/90 font-bold mb-4 text-center w-full">VOW STUDIO</h2>
        
        {/* Ceremonial Progress Framing */}
        <div className="flex flex-col items-center justify-center space-y-4 min-h-[100px]">
            {/* Previous Step Confirmation (Quiet) */}
            {step > 1 && (
                <div className="animate-fade-in text-[9px] uppercase tracking-[0.2em] text-green-400/80 font-bold mb-1 flex items-center gap-2">
                    <span>✓</span>
                    <span>{step === 2 ? "The foundation is complete" : "The narrative is complete"}</span>
                </div>
            )}

            {/* Current Step Description (Ceremonial) */}
            <h1 className="text-3xl md:text-5xl font-serif-elegant italic text-[#E5D0A1] leading-tight animate-fade-in" key={step}>
                {step === 1 && "You are shaping the foundation"}
                {step === 2 && "You are crafting the narrative"}
                {step === 3 && "You are preparing the ceremony"}
            </h1>

            {/* Step Counter (Quiet) */}
            <div className="flex items-center gap-4 mt-2">
                <div className={`h-px bg-luxury-gold/30 transition-all duration-700 ${step >= 1 ? 'w-8 opacity-100' : 'w-2 opacity-30'}`}></div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-luxury-gold/60 font-bold">
                    Step {step} of 3
                </p>
                <div className={`h-px bg-luxury-gold/30 transition-all duration-700 ${step >= 1 ? 'w-8 opacity-100' : 'w-2 opacity-30'}`}></div>
            </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative space-y-12">

        {error && (
          <div className="mx-auto max-w-md p-4 bg-[#2B0A0A]/80 border border-red-400/30 text-red-200 text-[11px] tracking-wide rounded-lg text-center backdrop-blur-sm"
               onClick={() => setError(null)}>
            {error}
            <span className="block text-[9px] text-red-300/50 mt-1 uppercase tracking-widest">Tap to dismiss</span>
          </div>
        )}
        
        {/* PHASE 1: THE FOUNDATION */}
        {step === 1 && (
          <div className="animate-fade-in space-y-12">
            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border border-[#C5B498] p-8 md:p-16 rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-xl"></div>
              <div className="relative z-10 space-y-12">
                
                {/* Visual Theme */}
                <div className="text-center border-b border-luxury-ink/20 pb-12">
                  <div className="mb-8">
                     <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 block mb-2">Select Visual Theme</label>
                     <p className="text-[10px] uppercase tracking-widest text-luxury-ink/60">This sets the colors and atmosphere your partner will see</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {THEMES.map(theme => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => updateData({ theme: theme.id })}
                        className={`relative overflow-hidden p-6 rounded-xl border transition-all duration-300 group text-left ${
                          data.theme === theme.id ? 'border-luxury-gold shadow-lg bg-[#1C1917]' : 'border-luxury-ink/30 hover:border-luxury-gold/60 bg-[#F0ECE4]/30'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full mb-4 shadow-sm border border-black/10" style={{ backgroundColor: theme.color }}></div>
                        <span className={`block text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-1 ${data.theme === theme.id ? 'text-[#E5D0A1]' : 'text-luxury-ink'}`}>
                          {theme.label}
                        </span>
                        <span className={`text-[10px] ${data.theme === theme.id ? 'text-luxury-stone/80' : 'text-luxury-ink/70'}`}>{theme.desc}</span>
                        {data.theme === theme.id && <div className="absolute top-4 right-4 text-luxury-gold text-xs">★</div>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Occasion - UPDATED with Tiered Split */}
                <div className="text-center border-b border-luxury-ink/20 pb-12">
                  <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 mb-8 block">Select Occasion</label>
                  <div className="flex flex-wrap justify-center gap-3 transition-all duration-500 ease-in-out">
                    
                    {/* Primary Tier (Always Visible) */}
                    {OCCASIONS.slice(0, 3).map(occ => (
                      <button
                        key={occ.id}
                        type="button"
                        onClick={() => handleOccasionChange(occ.id)}
                        className={`px-5 py-3 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center space-x-2 border ${
                          data.occasion === occ.id ? 'bg-luxury-ink text-white border-luxury-ink shadow-lg transform scale-105' : 'bg-transparent text-luxury-ink/80 border-luxury-ink/40 hover:border-luxury-ink/70 hover:text-luxury-ink'
                        }`}
                      >
                        <span>{occ.icon}</span>
                        <span>{occ.label}</span>
                      </button>
                    ))}

                    {/* Secondary Tier (Conditional) */}
                    {showAllOccasions && OCCASIONS.slice(3).map(occ => (
                      <button
                        key={occ.id}
                        type="button"
                        onClick={() => handleOccasionChange(occ.id)}
                        className={`px-5 py-3 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center space-x-2 border animate-fade-in ${
                          data.occasion === occ.id ? 'bg-luxury-ink text-white border-luxury-ink shadow-lg transform scale-105' : 'bg-transparent text-luxury-ink/80 border-luxury-ink/40 hover:border-luxury-ink/70 hover:text-luxury-ink'
                        }`}
                      >
                        <span>{occ.icon}</span>
                        <span>{occ.label}</span>
                      </button>
                    ))}

                    {/* Toggle Button */}
                    {!showAllOccasions && (
                        <button
                            type="button"
                            onClick={() => setShowAllOccasions(true)}
                            className="px-5 py-3 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center space-x-2 border bg-luxury-paper/50 text-luxury-ink/50 border-luxury-ink/10 hover:border-luxury-ink/40 hover:text-luxury-ink hover:bg-white/50"
                        >
                            <span className="text-xs">+</span>
                            <span>More</span>
                        </button>
                    )}
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                  <div className="space-y-4 group">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Recipient's Name</label>
                    <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. My Wife" value={data.recipientName} onChange={e => updateData({ recipientName: e.target.value })} required />
                  </div>
                  <div className="space-y-4 group">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Your Name</label>
                    <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="Your Name" value={data.senderName} onChange={e => updateData({ senderName: e.target.value })} required />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div className="animate-fade-in space-y-8">
            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border border-[#C5B498] p-8 md:p-16 rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-xl"></div>
              <div className="relative z-10 flex flex-col items-center space-y-12">
                
                {/* Visual Anchor - RENAMED FOR CLARITY */}
                <div className="flex flex-col items-center space-y-6 w-full border-b border-luxury-ink/20 pb-12">
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-stone/90 text-center">
                    The Cover Image (Optional)
                    <span className="block text-[10px] text-luxury-stone/80 mt-2 font-normal normal-case tracking-normal max-w-sm mx-auto leading-relaxed">
                      This single photo will be the <strong>main cinematic background</strong> for the letter itself. Unlike the Memory Board below (which is a collage), this image sets the mood for the entire experience.
                    </span>
                  </label>
                  <div onClick={() => fileInputRef.current?.click()} className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#D6CDB8] border-2 border-luxury-ink/20 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-luxury-gold-dark/60 transition-all shadow-inner">
                    {data.userImageUrl ? (
                      <img src={data.userImageUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-1000" alt="Preview" />
                    ) : (
                      <div className="text-center p-6 space-y-2">
                        <span className="text-luxury-ink/60 text-3xl block transition-transform group-hover:scale-110">📷</span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-luxury-ink/80 block font-bold group-hover:text-luxury-wine transition-colors">ADD</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </div>

                {/* The Memory Board */}
                <div className="w-full pb-12 border-b border-luxury-ink/20 space-y-6">
                  <div className="text-center">
                     <label className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-stone/90 mb-2 block">
                       The Memory Board (Optional)
                     </label>
                     <p className="text-[10px] uppercase tracking-widest text-luxury-ink/70 mb-6 font-bold max-w-sm mx-auto">
                       Upload up to 10 photos to create a scattered, handwritten polaroid collage. This is a separate <strong>interactive gallery</strong>. Best with 5–10 photos.
                     </p>
                  </div>
                  
                  <div className="flex flex-col items-center">
                     <button 
                       type="button"
                       onClick={() => memoryInputRef.current?.click()}
                       disabled={media.isUploadingMemories || (data.memoryBoard?.length || 0) >= 10}
                       className={`px-8 py-4 border-2 border-luxury-ink/40 text-luxury-ink text-[10px] uppercase tracking-widest font-bold rounded-full hover:bg-luxury-ink/10 transition-all ${media.isUploadingMemories ? 'opacity-60 cursor-wait' : ''}`}
                     >
                       {media.isUploadingMemories ? 'Uploading...' : 'Add Polaroids'}
                     </button>
                     <input 
                       type="file" 
                       ref={memoryInputRef} 
                       onChange={handleMemoryUpload} 
                       accept="image/*" 
                       multiple 
                       className="hidden" 
                     />
                     <p className="text-[10px] mt-4 text-luxury-stone/80 uppercase tracking-widest font-bold">
                       {(data.memoryBoard?.length || 0)} / 10 Uploaded
                     </p>
                  </div>

                  {data.memoryBoard && data.memoryBoard.length > 0 && (
                    <div className="relative w-full mt-8" style={{ minHeight: `${Math.ceil((data.memoryBoard.length) / 2) * 200 + 80}px` }}>

                       {/* Backdrop overlay when a photo is zoomed */}
                       {activePhoto !== null && (
                         <motion.div
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           transition={{ duration: 0.2 }}
                           className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90]"
                           onClick={() => setActivePhoto(null)}
                         />
                       )}

                       {data.memoryBoard.map((photo, idx) => {
                          const col = idx % 2;
                          const row = Math.floor(idx / 2);
                          const baseX = col * 52;
                          const baseY = row * 200;
                          const isActive = activePhoto === idx;

                          return (
                            <motion.div
                              key={`${photo.url}-${idx}`}
                              drag={!isActive}
                              dragMomentum={false}
                              dragElastic={0.15}
                              initial={false}
                              animate={{
                                scale: isActive ? 1.6 : 1,
                                rotate: isActive ? 0 : photo.angle,
                                zIndex: isActive ? 100 : idx + 1,
                              }}
                              transition={{
                                type: 'spring',
                                stiffness: 320,
                                damping: 26,
                              }}
                              onTap={() => setActivePhoto(isActive ? null : idx)}
                              className={`absolute group touch-none ${isActive ? 'cursor-zoom-out' : 'cursor-grab active:cursor-grabbing'}`}
                              style={{
                                left: `${baseX + photo.xOffset * 0.15}%`,
                                top: `${baseY + photo.yOffset}px`,
                                width: '44%',
                              }}
                            >
                              <div className={`bg-white p-2 pb-6 border border-black/5 relative transition-shadow duration-300 ${isActive ? 'shadow-[0_12px_40px_rgba(0,0,0,0.35)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.15)]'}`}>
                                {/* Delete button — only visible when not zoomed */}
                                {!isActive && (
                                  <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); removeMemoryPhoto(idx); }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-luxury-wine text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                                  >
                                    ✕
                                  </button>
                                )}

                                {/* Photo */}
                                <div 
                                  className="aspect-square overflow-hidden bg-gray-100 mb-2"
                                  onPointerDown={(e) => { if (isActive) e.stopPropagation(); }}
                                >
                                  <img 
                                    src={photo.url} 
                                    className="w-full h-full object-cover pointer-events-none select-none" 
                                    alt="Memory" 
                                    draggable={false}
                                  />
                                </div>

                                {/* Caption */}
                                <input 
                                  type="text" 
                                  placeholder="caption..."
                                  value={photo.caption}
                                  onChange={e => updateMemoryCaption(idx, e.target.value)}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  className="w-full bg-transparent border-b border-transparent hover:border-luxury-ink/20 text-center text-[11px] font-romantic text-luxury-ink outline-none focus:border-luxury-gold transition-colors pb-1 placeholder-luxury-ink/30"
                                  maxLength={25}
                                />
                              </div>
                            </motion.div>
                          );
                       })}
                    </div>
                  )}
                </div>

                {/* The Story - COLLAPSED OPTIONAL FIELDS (FIX #2) */}
                <div className="w-full space-y-12">
                  <div className="space-y-3 group">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">How long together?</label>
                    <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. 10 years, or just a few months" value={data.timeShared} onChange={e => updateData({ timeShared: e.target.value })} required />
                  </div>
                  <div className="space-y-3 group">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Key Memory to Mention</label>
                    <textarea className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic h-24 resize-none leading-relaxed text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. When we got lost in Tokyo, or just drinking coffee this morning..." value={data.sharedMoment} onChange={e => updateData({ sharedMoment: e.target.value })} required />
                  </div>

                  {/* Sacred Place Input (Collapsed by Default) */}
                  {!showLocationFields ? (
                      <div className="text-center pt-2">
                          <button
                              type="button"
                              onClick={() => setShowLocationFields(true)}
                              className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-luxury-stone/60 hover:text-luxury-ink transition-colors font-bold border-b border-transparent hover:border-luxury-ink/30 pb-1"
                          >
                              + Want to anchor this to a specific place?
                          </button>
                      </div>
                  ) : (
                      <div className="space-y-6 group animate-fade-in bg-luxury-ink/5 p-6 rounded-lg border border-luxury-ink/10 relative">
                          <button 
                             type="button" 
                             onClick={() => setShowLocationFields(false)}
                             className="absolute top-4 right-4 text-luxury-stone/40 hover:text-luxury-wine transition-colors font-bold text-xs"
                          >
                             ✕
                          </button>
                          <div>
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Your Sacred Place</label>
                            <input type="text" className="w-full bg-white/50 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. The exact spot we met, or the Eiffel Tower" value={data.locationMemory} onChange={e => updateData({ locationMemory: e.target.value })} />
                             <p className="text-[10px] text-luxury-stone/70 italic text-right mt-1 font-bold">We will try to find this on the map for you.</p>
                          </div>

                          {/* Manual Link Override */}
                          <div>
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Google Maps Link (Optional)</label>
                            <input 
                              type="text" 
                              className="w-full bg-white/50 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all text-xs text-luxury-ink placeholder-luxury-ink/50" 
                              placeholder="Paste a direct Google Maps link for 100% accuracy..." 
                              value={data.manualMapLink || ''} 
                              onChange={e => updateData({ manualMapLink: e.target.value })} 
                            />
                             <p className="text-[10px] text-luxury-stone/70 italic text-right mt-1 font-bold">If provided, we will use this exact location instead of searching.</p>
                          </div>
                      </div>
                  )}
                </div>

                {/* Writing Mode */}
                <div className="w-full pt-8 border-t border-luxury-ink/20 space-y-8">
                  <div className="flex flex-col md:flex-row justify-center gap-6">
                    <button type="button" onClick={() => setWritingMode('assisted')} className={`flex-1 py-4 px-4 rounded-xl text-center transition-all duration-300 border-2 ${writingMode === 'assisted' ? 'bg-[#D6CDB8] border-luxury-gold-dark/60 text-luxury-wine shadow-inner' : 'bg-transparent border-luxury-ink/30 text-luxury-ink/80 hover:bg-[#D6CDB8]/50'}`}>
                      <span className="block text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Assisted</span>
                      <span className="block font-serif-elegant italic text-base">Help me write it</span>
                    </button>
                    <button type="button" onClick={() => setWritingMode('self')} className={`flex-1 py-4 px-4 rounded-xl text-center transition-all duration-300 border-2 ${writingMode === 'self' ? 'border-luxury-ink text-luxury-ink bg-[#D6CDB8]' : 'border-luxury-ink/30 text-luxury-ink/80 hover:border-luxury-ink/70 hover:bg-[#D6CDB8]/50'}`}>
                      <span className="block text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Manual</span>
                      <span className="block font-serif-elegant italic text-base">I'll write it myself</span>
                    </button>
                  </div>
                  
                  {writingMode === 'self' ? (
                    <div className="animate-fade-in space-y-4 relative group">
                      <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">Your Letter</label>
                      <div className="relative">
                        <textarea 
                          className="w-full bg-luxury-ink/5 border-l-4 border-luxury-ink/30 pl-6 py-4 pr-12 focus:border-luxury-gold-dark outline-none transition-all font-serif-elegant text-xl italic h-40 resize-none leading-relaxed text-luxury-ink placeholder-luxury-ink/50" 
                          placeholder="Write from the heart..." 
                          value={data.finalLetter} 
                          onChange={e => updateData({ finalLetter: e.target.value })} 
                          required 
                        />
                        {/* Dictation Button */}
                        {dictation.isSupported && (
                          <>
                            <button 
                               type="button"
                               onClick={dictation.isDictating ? dictation.stopDictation : dictation.startDictation}
                               className={`absolute top-4 right-4 p-2 rounded-full transition-all ${dictation.isDictating ? 'text-red-500 animate-pulse bg-red-100' : 'text-luxury-ink/50 hover:text-luxury-gold hover:bg-luxury-ink/10'}`}
                               title="Dictate Letter"
                            >
                               <span className="text-xl">🎙️</span>
                            </button>
                            {dictation.isDictating && <p className="text-[10px] font-bold text-red-500 italic text-right mt-1">Listening... Speak clearly.</p>}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">Your Words</label>
                        <p className="text-[10px] text-luxury-ink/50 leading-relaxed -mt-2">Write a few lines in your own words. Don't worry about grammar or structure. Just say what you feel.</p>
                        <textarea 
                          className="w-full bg-luxury-ink/5 border-l-4 border-luxury-ink/30 pl-6 py-4 pr-4 focus:border-luxury-gold-dark outline-none transition-all font-serif-elegant text-lg italic h-32 resize-none leading-relaxed text-luxury-ink placeholder-luxury-ink/40" 
                          placeholder="I just want to say that... the way you... I feel like..." 
                          value={data.senderRawThoughts || ''} 
                          onChange={e => updateData({ senderRawThoughts: e.target.value })} 
                        />
                        <p className="text-[9px] text-luxury-ink/40 text-right">{(data.senderRawThoughts || '').split(/\s+/).filter(Boolean).length} words</p>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">Relationship Tone</label>
                        <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. Deeply romantic, playful, grateful, apologetic..." value={data.relationshipIntent} onChange={e => updateData({ relationshipIntent: e.target.value })} required />
                      </div>
                    </div>
                    </div>
                  )}

                  {/* Vocal Vow Section (Fix #3) */}
                  <div className="animate-fade-in pt-8 border-t border-luxury-ink/20">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 mb-4 block">Vocal Vow (Optional)</label>
                    <div className="bg-luxury-ink/5 rounded-xl p-6 flex flex-col items-center justify-center border-2 border-luxury-ink/20">
                       {!data.audio?.url ? (
                         <>
                           <button 
                             type="button"
                             onClick={audio.isRecording ? audio.stopRecording : audio.startRecording}
                             className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${audio.isRecording ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] scale-110' : 'bg-luxury-ink text-white hover:bg-luxury-gold'}`}
                           >
                             {audio.isRecording ? (
                                <div className="w-8 h-8 bg-white rounded-sm"></div>
                              ) : (
                                <span className="text-3xl">●</span>
                              )}
                           </button>
                           <p className="mt-4 text-[10px] uppercase tracking-widest text-luxury-ink/70 font-bold">
                             {audio.isRecording ? `Recording... ${audio.formatTime(audio.recordingTime)}` : 'Tap to Record Voice Note'}
                           </p>
                           
                           {!audio.isRecording && (
                               <div className="mt-4 text-center opacity-60 max-w-sm mx-auto">
                                   <p className="text-[10px] font-serif-elegant italic text-luxury-ink">
                                       "Even a few seconds in your real voice can mean more than perfect words."
                                   </p>
                                   <p className="text-[8px] uppercase tracking-widest text-luxury-ink/50 mt-2 font-bold">
                                       Optional — you can skip this
                                   </p>
                               </div>
                           )}
                         </>
                       ) : (
                         <div className="w-full flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <button 
                                  type="button"
                                  onClick={togglePreview}
                                  className="w-12 h-12 rounded-full bg-luxury-gold text-white flex items-center justify-center hover:bg-luxury-gold-dark transition-colors text-xl"
                               >
                                  {isPreviewPlaying ? <span>⏸</span> : <span>▶</span>}
                               </button>
                               <div>
                                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-luxury-ink">Voice Note Recorded</p>
                                  <p className="text-[10px] font-bold text-luxury-ink/60">
                                      {isPreviewPlaying ? 'Playing...' : 'Ready to include in package.'}
                                  </p>
                               </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={handleDeleteRecording}
                              className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 border-b-2 border-red-300"
                            >
                              Delete
                            </button>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div className="animate-fade-in space-y-8">
            
            {/* Reveal Ritual Selection */}
            <div className="bg-[#1C1917] border-2 border-[#3D3530] p-8 md:p-10 rounded-xl relative overflow-hidden group">
               <div className="relative z-10">
                 <h3 className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-luxury-gold font-bold mb-2">Choose Your Ritual</h3>
                 <p className="text-[10px] text-luxury-stone/80 mb-6 font-bold italic">
                   How would you like them to open this gift? Select the delivery experience.
                 </p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {RITUALS.map(ritual => (
                      <button
                        key={ritual.id}
                        type="button"
                        onClick={() =>
                          updateData(prev => ({
                            revealMethod: ritual.id,
                            unlockDate: ritual.id === 'vigil' ? prev.unlockDate : null,
                          }))
                        }
                        className={`p-6 rounded-lg text-left border-2 transition-all duration-300 relative overflow-hidden ${
                          data.revealMethod === ritual.id ? 'bg-[#2A2522] border-luxury-gold shadow-lg' : 'bg-transparent border-[#444] hover:border-[#666]'
                        }`}
                      >
                         <div className="text-3xl mb-3">{ritual.icon}</div>
                         <h4 className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 ${data.revealMethod === ritual.id ? 'text-luxury-gold' : 'text-[#BBB]'}`}>{ritual.title}</h4>
                         <p className="text-[10px] text-white/60 leading-relaxed font-bold">{ritual.desc}</p>
                      </button>
                    ))}
                 </div>

                 {/* Date Picker - Only for Vigil */}
                 {data.revealMethod === 'vigil' && (
                   <div className="animate-fade-in bg-black/40 p-6 rounded-lg border border-luxury-gold/40 flex flex-col md:flex-row gap-6 items-center mt-4">
                       <p className="text-luxury-stone/90 text-sm italic font-bold">When should the vigil end?</p>
                       <input 
                          type="datetime-local" 
                          className="bg-transparent border-2 border-luxury-gold/60 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-luxury-gold transition-colors"
                          onChange={(e) => updateData({ unlockDate: e.target.value })}
                          value={data.unlockDate || ''}
                       />
                   </div>
                 )}
               </div>
            </div>

            {/* Cinematic Background Source */}
            <div className="bg-[#1C1917] border-2 border-[#3D3530] p-8 rounded-xl">
               <h3 className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-luxury-gold font-bold mb-6">Cinematic Backdrop</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Option 1: None */}
                  <button 
                    type="button"
                    onClick={() => updateData({ videoSource: 'none' })}
                    className={`p-6 rounded border-2 transition-all ${data.videoSource === 'none' ? 'bg-[#2A2522] border-white/40' : 'bg-transparent border-white/10 opacity-70'}`}
                  >
                     <span className="text-3xl block mb-2">🌑</span>
                     <span className="text-[10px] uppercase font-bold tracking-widest text-white">None</span>
                  </button>

                  {/* Option 2: Upload (Free) */}
                  <div 
                    onClick={() => {
                        updateData({ videoSource: 'upload' });
                        videoInputRef.current?.click();
                    }}
                    className={`p-6 rounded border-2 transition-all cursor-pointer relative group ${data.videoSource === 'upload' ? 'bg-[#2A2522] border-luxury-gold' : 'bg-transparent border-white/10 opacity-90 hover:opacity-100 hover:border-white/30'}`}
                  >
                     <span className="text-3xl block mb-2">📹</span>
                     <span className="text-[10px] uppercase font-bold tracking-widest text-white block mb-1">Upload Video</span>
                     <span className="text-[10px] uppercase tracking-widest text-green-400 block font-bold">Standard (Free)</span>
                     <span className="text-[9px] uppercase tracking-widest text-green-400 block mt-1">Max 5MB (~15s)</span>
                     {data.video?.url && <span className="absolute top-3 right-3 text-green-400 text-lg font-bold">✓</span>}
                     {media.isUploadingVideo && <span className="absolute top-3 right-3 text-white text-lg animate-spin">⟳</span>}
                     <input 
                        type="file" 
                        ref={videoInputRef} 
                        accept="video/*" 
                        className="hidden" 
                        onChange={handleVideoUpload}
                     />
                  </div>

                  {/* Option 3: Veo AI (Premium) */}
                  <button 
                    type="button"
                    onClick={() => updateData({ videoSource: 'veo' })}
                    className={`p-6 rounded border-2 transition-all ${data.videoSource === 'veo' ? 'bg-luxury-gold/10 border-luxury-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'bg-transparent border-white/10 opacity-90 hover:opacity-100 hover:border-luxury-gold/60'}`}
                  >
                     <span className="text-3xl block mb-2">✨</span>
                     <span className="text-[10px] uppercase font-bold tracking-widest text-white block mb-1">AI Dreamscape</span>
                     <span className="text-[10px] uppercase tracking-widest text-luxury-gold block font-bold">Premium (Veo)</span>
                  </button>
               </div>
               
               {data.videoSource === 'veo' && (
                  <div className="mt-6 p-6 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg space-y-6 animate-fade-in">
                      {/* Style Selection */}
                      <div>
                           <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 block">Director's Cut: Style</label>
                           <div className="grid grid-cols-3 gap-2">
                               {['cinematic', 'dreamy', 'vintage'].map(style => (
                                   <button
                                      key={style}
                                      type="button"
                                      onClick={() => updateData({ videoStyle: style as any })}
                                      className={`py-3 border-2 text-[10px] font-bold uppercase tracking-widest transition-all ${data.videoStyle === style ? 'bg-luxury-gold text-black border-luxury-gold' : 'border-white/20 text-white/70 hover:text-white'}`}
                                   >
                                      {style}
                                   </button>
                               ))}
                           </div>
                      </div>
                      
                      {/* Format Selection */}
                      <div className="flex gap-6">
                          <div className="flex-1">
                               <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 block">Ratio</label>
                               <div className="flex gap-2">
                                   <button type="button" onClick={() => updateData({ videoAspectRatio: '9:16' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoAspectRatio === '9:16' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>Mobile (9:16)</button>
                                   <button type="button" onClick={() => updateData({ videoAspectRatio: '16:9' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoAspectRatio === '16:9' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>TV (16:9)</button>
                               </div>
                          </div>
                          <div className="flex-1">
                               <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 block">Quality</label>
                               <div className="flex gap-2">
                                   <button type="button" onClick={() => updateData({ videoResolution: '720p' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoResolution === '720p' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>720p</button>
                                   <button type="button" onClick={() => updateData({ videoResolution: '1080p' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoResolution === '1080p' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>1080p</button>
                               </div>
                          </div>
                      </div>
                  </div>
               )}

               {data.videoSource === 'upload' && (
                  <div className="mt-4 p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold mb-2">Upload Requirements</h4>
                      <ul className="text-[10px] text-white/80 space-y-1 list-disc list-inside font-bold">
                          <li>Format: MP4 or WebM (Vertical 9:16 preferred)</li>
                          <li>Size Limit: <span className="text-white">Max 5MB</span> (Strict limit)</li>
                          <li>Duration: <span className="text-white">10-15 seconds</span> (Loops automatically)</li>
                      </ul>
                  </div>
               )}
            </div>

            {/* Soundtrack */}
            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border-2 border-[#C5B498] p-8 md:p-12 rounded-xl shadow-sm">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-baseline mb-1 gap-2">
                        <label className="flex items-center space-x-2 text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">
                            <span className="text-xl">🎵</span>
                            <span>Soundtrack (YouTube)</span>
                        </label>
                        <span className="text-[10px] text-luxury-ink/60 font-bold italic">
                            Public video link. No "Shorts", "Mixes" or "Live" streams.
                        </span>
                    </div>
                    
                    <input 
                        type="text" 
                        className="w-full bg-luxury-ink/5 border-2 border-luxury-ink/20 py-3 px-4 rounded-lg focus:border-luxury-gold outline-none text-base text-luxury-ink placeholder-luxury-ink/50"
                        placeholder="e.g. https://www.youtube.com/watch?v=..." 
                        value={data.musicType === 'youtube' ? data.musicUrl : ''}
                        onChange={e => {
                           const val = e.target.value;
                           if (val) {
                             updateData({ musicType: 'youtube', musicUrl: val });
                           } else {
                             updateData({ musicType: 'preset', musicUrl: MUSIC_PRESETS[0].url });
                           }
                        }}
                    />

                    {/* Security/Storage Note */}
                    {data.musicType === 'youtube' && (
                        <div className="flex items-start space-x-2 mt-4 p-3 bg-luxury-ink/5 rounded-lg border border-luxury-ink/10">
                            <span className="text-luxury-gold-dark text-sm mt-0.5">ℹ️</span>
                            <p className="text-[10px] text-luxury-ink/70 font-bold leading-relaxed">
                                <span className="font-extrabold text-luxury-ink">System Note:</span> YouTube audio is streamed directly from their servers. 
                                It does not consume your storage space. However, for the best looping experience, 
                                we recommend tracks between <span className="font-extrabold text-luxury-ink">3-5 minutes</span>.
                                Avoid 1h+ videos to ensure fast loading for the receiver.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Promises */}
            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border-2 border-[#C5B498] p-8 md:p-12 rounded-xl shadow-sm">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/70 mb-6">Three Promises</p>
                <div className="space-y-8">
                  {data.coupons?.map((coupon, idx) => (
                    <div key={coupon.id} className="flex gap-4 items-start border-b-2 border-luxury-ink/10 pb-6 last:border-0">
                        <div className="pt-2 text-sm font-bold text-luxury-gold-dark">{idx + 1}</div>
                        <div className="flex-1 space-y-4">
                           <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block mb-1">Title</label>
                              <input 
                                type="text" 
                                className="w-full bg-transparent border-b-2 border-luxury-ink/20 py-1 focus:border-luxury-ink outline-none font-serif-elegant italic text-luxury-ink text-xl"
                                value={coupon.title}
                                onChange={e => updateCoupon(idx, 'title', e.target.value)}
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block mb-1">Description</label>
                              <textarea 
                                className="w-full bg-luxury-ink/5 border-2 border-luxury-ink/20 p-4 rounded-lg focus:border-luxury-ink outline-none font-sans text-sm text-luxury-ink leading-relaxed resize-none h-24"
                                value={coupon.description}
                                onChange={e => updateCoupon(idx, 'description', e.target.value)}
                              />
                           </div>
                        </div>
                    </div>
                  ))}
                </div>
            </div>

            {/* The Gesture */}
            <div className={`transition-all duration-700 rounded-xl overflow-hidden border-2 ${data.hasGift ? 'border-[#D4C5A5] shadow-xl bg-luxury-paper' : 'border-[#3D3530] bg-[#1C1917]'}`}>
                <div className={`p-8 md:p-10 cursor-pointer transition-colors flex items-center justify-between group ${data.hasGift ? 'bg-gradient-to-r from-[#E8E2D2] to-[#D6CDB8]' : 'bg-[#2A2522] hover:bg-[#332D2A]'}`} onClick={() => updateData(prev => ({ hasGift: !prev.hasGift }))}>
                    <div className="flex items-center space-x-6">
                        <div className={`w-8 h-8 border-2 rounded-full flex items-center justify-center transition-all ${data.hasGift ? 'border-luxury-wine bg-luxury-wine' : 'border-[#A89F91] bg-transparent'}`}>{data.hasGift && <span className="text-white text-sm font-bold">✓</span>}</div>
                        <div>
                            <h3 className={`text-xs md:text-sm font-bold uppercase tracking-[0.2em] mb-1 ${data.hasGift ? 'text-luxury-wine' : 'text-[#A89F91] group-hover:text-[#E5D0A1] transition-colors'}`}>Include a Grand Gesture?</h3>
                            <p className={`text-[10px] md:text-xs font-bold italic ${data.hasGift ? 'text-luxury-stone/80' : 'text-[#888]'}`}>Attach a flight, a dinner reservation, or a gift link.</p>
                        </div>
                    </div>
                </div>
                {data.hasGift && (
                    <div className="bg-luxury-paper border-t-2 border-[#D4C5A5] p-8 space-y-6 animate-fade-in">
                        <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 focus:border-luxury-ink outline-none font-serif-elegant italic text-xl placeholder-luxury-ink/50" placeholder="Gift Title (e.g. Dinner at Nobu)" value={data.giftTitle} onChange={e => updateData({ giftTitle: e.target.value })} />
                        <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 focus:border-luxury-ink outline-none text-base placeholder-luxury-ink/50" placeholder="Link URL..." value={data.giftLink} onChange={e => updateData({ giftLink: e.target.value })} />
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="pt-8 pb-20 flex justify-between items-center border-t border-white/10">
           {step > 1 ? (
             <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); back(); }} className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-luxury-stone hover:text-luxury-gold transition-colors font-bold px-4 py-2">
               ← Back
             </button>
           ) : <div></div>}
           
           <button type="submit" className="px-12 py-5 bg-luxury-wine text-white font-bold rounded-full shadow-2xl hover:bg-[#3D1F1F] transition-all transform hover:-translate-y-1 active:scale-[0.99] uppercase tracking-[0.4em] text-[10px] md:text-xs">
             {step === 3 ? 'Generate Draft' : 'Continue'}
           </button>
        </div>
      </form>
    </div>
  );
};