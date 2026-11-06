import React, { useState, useEffect, useRef } from 'react';
import { WeatherSnapshot, Location } from '../types/api';
import { Headphones, Play, Pause, Volume2, VolumeX, Sliders, Sparkles, Wind, CloudRain, Sun, Moon } from 'lucide-react';

interface AmbientSoundscapeCardProps {
  location?: Location | null;
  weather?: WeatherSnapshot | null;
  isLoading?: boolean;
}

type SoundPreset = 'auto_sync' | 'gentle_rain' | 'wind_whistle' | 'night_crickets' | 'deep_focus';

export const AmbientSoundscapeCard: React.FC<AmbientSoundscapeCardProps> = ({
  location,
  weather,
  isLoading = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [activePreset, setActivePreset] = useState<SoundPreset>('auto_sync');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);

  // Always run cleanup effect unconditionally at top-level to satisfy Rules of Hooks
  useEffect(() => {
    return () => {
      try {
        if (noiseSourceRef.current) {
          noiseSourceRef.current.stop();
          noiseSourceRef.current.disconnect();
          noiseSourceRef.current = null;
        }
        if (lfoRef.current) {
          lfoRef.current.stop();
          lfoRef.current.disconnect();
          lfoRef.current = null;
        }
      } catch (e) {
        // Ignored
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  if (isLoading || !weather) return null;

  const cityName = location?.name ?? 'your city';
  const temp = Math.round(weather.temperature);
  const windSpeed = weather.wind_speed ?? 12;
  const precip = weather.precipitation ?? 0;
  const isDay = weather.is_day ?? 1;

  // Initialize or resume procedural Web Audio generator
  const startAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      audioCtxRef.current = new AudioCtx();
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Stop existing nodes if any
    stopAudioNodes();

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // 1. Generate 5-second seamless White/Pink Noise buffer
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise algorithm
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSourceRef.current = noiseSource;

    // 2. Wind Engine: Bandpass filter modulated by LFO
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(320, ctx.currentTime);
    windFilter.Q.setValueAtTime(3.0, ctx.currentTime);

    // LFO for natural gust variations
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.25 + (windSpeed / 50), ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(140 + (windSpeed * 3), ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();
    lfoRef.current = lfo;

    const windGain = ctx.createGain();
    const targetWindLevel = activePreset === 'wind_whistle' ? 0.7 : activePreset === 'auto_sync' ? Math.min(0.6, (windSpeed / 35)) : 0.2;
    windGain.gain.setValueAtTime(targetWindLevel, ctx.currentTime);
    windGainRef.current = windGain;

    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);

    // 3. Rain Drops Engine: High-shelf / Highpass filtered noise
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(1200, ctx.currentTime);

    const rainGain = ctx.createGain();
    const targetRainLevel = activePreset === 'gentle_rain' ? 0.65 : activePreset === 'auto_sync' ? (precip > 0 ? 0.7 : 0.0) : 0.0;
    rainGain.gain.setValueAtTime(targetRainLevel, ctx.currentTime);
    rainGainRef.current = rainGain;

    noiseSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);

    // 4. Night Resonance Sine Tone (for night calm / deep focus)
    if (activePreset === 'night_crickets' || (activePreset === 'auto_sync' && !isDay)) {
      const droneOsc = ctx.createOscillator();
      droneOsc.type = 'sine';
      droneOsc.frequency.setValueAtTime(108, ctx.currentTime); // 108Hz soothing grounding drone
      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.08, ctx.currentTime);
      droneOsc.connect(droneGain);
      droneGain.connect(masterGain);
      droneOsc.start();
    }

    noiseSource.start();
    setIsPlaying(true);
  };

  const stopAudioNodes = () => {
    try {
      if (noiseSourceRef.current) {
        noiseSourceRef.current.stop();
        noiseSourceRef.current.disconnect();
        noiseSourceRef.current = null;
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
    } catch (e) {
      // Ignored if already stopped
    }
  };

  const stopAudio = () => {
    stopAudioNodes();
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend();
    }
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  // Update volume in real-time
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  };

  // Switch presets
  const handleSelectPreset = (preset: SoundPreset) => {
    setActivePreset(preset);
    if (isPlaying) {
      setTimeout(() => startAudio(), 50);
    }
  };



  return (
    <section
      aria-label="Sound of Atmosphere - Real-Time Procedural Soundscape"
      style={{
        background: 'linear-gradient(135deg, rgba(17, 27, 46, 0.95), rgba(11, 18, 32, 0.98))',
        border: '1px solid #1E2A44',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>🎧</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.01em',
              }}
            >
              Sound of Atmosphere · Procedural Weather Audio
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              Web Audio Synthesizer
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Generative real-time nature soundscapes synthesized from actual {cityName} wind speed ({windSpeed} km/h) & precipitation metrics.
          </p>
        </div>

        {/* Big Play / Pause Action Button */}
        <button
          onClick={togglePlayback}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '10px',
            background: isPlaying ? 'linear-gradient(90deg, #EF4444, #DC2626)' : 'linear-gradient(90deg, #0284C7, #38BDF8)',
            border: 'none',
            color: isPlaying ? '#FFFFFF' : '#0B1220',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isPlaying ? '0 0 16px rgba(239, 68, 68, 0.4)' : '0 0 16px rgba(56, 189, 248, 0.3)',
          }}
        >
          {isPlaying ? (
            <>
              <Pause style={{ width: 14, height: 14, fill: '#FFFFFF' }} />
              <span>Pause Soundscape</span>
            </>
          ) : (
            <>
              <Play style={{ width: 14, height: 14, fill: '#0B1220' }} />
              <span>Listen to Weather</span>
            </>
          )}
        </button>
      </div>

      {/* Preset Sound Modes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {[
          { key: 'auto_sync', label: 'Live Weather Sync', icon: isDay ? '☀️' : '🌙', desc: `Synced to ${cityName}` },
          { key: 'gentle_rain', label: 'Gentle Rain Drops', icon: '🌧️', desc: 'Rain & droplet frequencies' },
          { key: 'wind_whistle', label: 'Aerodynamic Breeze', icon: '💨', desc: `${windSpeed} km/h wind whistle` },
          { key: 'night_crickets', label: 'Deep Night Calm', icon: '🌌', desc: '108Hz grounding drone' },
          { key: 'deep_focus', label: 'Study & Sleep Focus', icon: '🧠', desc: 'Subtle brown noise' },
        ].map((item) => {
          const isSelected = activePreset === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleSelectPreset(item.key as SoundPreset)}
              style={{
                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(17, 27, 46, 0.6)',
                border: isSelected ? '1px solid #38BDF8' : '1px solid #1E2A44',
                borderRadius: '10px',
                padding: '8px 10px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px' }}>{item.icon}</span>
                {isSelected && isPlaying && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10B981',
                      boxShadow: '0 0 6px #10B981',
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? '#38BDF8' : '#F8FAFC',
                }}
              >
                {item.label}
              </span>
              <span style={{ fontSize: '9.5px', color: '#64748B' }}>{item.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Controls & Sound Waveform Display */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid #1E2A44',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Animated Real-Time Spectrum Waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '22px' }}>
            {[10, 18, 14, 22, 12, 26, 18, 20, 12, 16, 24, 14, 18, 10].map((barHeight, idx) => (
              <span
                key={idx}
                style={{
                  width: '3px',
                  height: isPlaying ? `${Math.max(4, Math.round(barHeight * (volume / 0.5)))}px` : '4px',
                  background: isPlaying ? '#38BDF8' : '#475569',
                  borderRadius: '2px',
                  transition: 'height 0.15s ease',
                  animation: isPlaying ? `soundPulse 0.8s ease-in-out infinite alternate ${idx * 0.08}s` : 'none',
                }}
              />
            ))}
          </div>

          <span style={{ fontSize: '12px', color: isPlaying ? '#F8FAFC' : '#94A3B8', fontWeight: 600 }}>
            {isPlaying ? 'Synthesizing Live Atmospheric Atmosphere' : 'Soundscape in Standby'}
          </span>
        </div>

        {/* Volume Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {volume === 0 ? (
            <VolumeX style={{ width: 15, height: 15, color: '#64748B' }} />
          ) : (
            <Volume2 style={{ width: 15, height: 15, color: '#38BDF8' }} />
          )}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            style={{
              width: '100px',
              accentColor: '#38BDF8',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '11px', color: '#94A3B8', minWidth: '32px', textAlign: 'right' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes soundPulse {
          0% { height: 4px; }
          100% { height: 22px; }
        }
      `}</style>
    </section>
  );
};
