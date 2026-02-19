import React, { useEffect, useRef, useState } from 'react';

export default function BackgroundAudio({ src, autoplay = true }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const audioSrc = src || (import.meta.env.BASE_URL || '/') + 'shade_theme.mp3';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = true;
    audio.preload = 'auto';
    audio.src = audioSrc;
    if (autoplay) {
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => setPlaying(true)).catch(() => setBlocked(true));
      }
    }
  }, [autoplay, audioSrc]);

  useEffect(() => {
    const handler = async () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        await audio.play();
        setPlaying(true);
        setBlocked(false);
      } catch (e) {
        setBlocked(true);
      }
    };
    window.addEventListener('start-background-audio', handler);
    return () => window.removeEventListener('start-background-audio', handler);
  }, []);

  return (
    <>
      <audio ref={audioRef} style={{ display: 'none' }} />
    </>
  );
}
