/**
 * components/Chat/VoiceRecorder.jsx — Robust Voice Note Recorder with Live Meter
 */

import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(20);
  const [isReady, setIsReady] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    async function startRecording() {
      try {
        // Request microphone permission explicitly
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Setup audio visualizer meter
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateVolume = () => {
              if (isCancelled) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setVolumeLevel(Math.min(100, Math.max(15, avg * 1.5)));
              animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
          }
        } catch (e) {
          console.warn('Audio visualizer fallback:', e);
        }

        // Determine supported audio mime type
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        const options = mimeType ? { mimeType } : undefined;
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        // Collect audio chunks every 250ms
        mediaRecorder.start(250);
        setIsReady(true);

        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone access error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          toast.error(
            'Microphone access blocked! Please click the lock 🔒 icon in your browser address bar and set Microphone to "Allow".',
            { duration: 6000 },
          );
        } else {
          toast.error(`Microphone error: ${err.message || 'Device not ready'}`);
        }
        if (onCancel) onCancel();
      }
    }

    startRecording();

    return () => {
      isCancelled = true;
      cleanupAudio();
    };
  }, [onCancel]);

  const cleanupAudio = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleStopAndSend = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      if (audioBlob.size === 0) {
        toast.error('No audio captured. Please speak into your microphone.');
        if (onCancel) onCancel();
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result;
        const mins = Math.floor(recordingSeconds / 60);
        const secs = recordingSeconds % 60;
        const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        onSendVoice(base64Audio, durationStr);
      };
      reader.readAsDataURL(audioBlob);
      cleanupAudio();
    };

    mediaRecorder.stop();
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
    if (onCancel) onCancel();
  };

  const mins = Math.floor(recordingSeconds / 60);
  const secs = recordingSeconds % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        width: '100%',
        padding: '0.35rem 0.6rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderRadius: '24px',
        border: '1px solid rgba(239, 68, 68, 0.25)',
      }}
    >
      {/* Live recording indicator & waveform bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            display: 'inline-block',
            boxShadow: '0 0 10px #ef4444',
            animation: 'pulse 1s infinite alternate',
          }}
        />
        <span style={{ fontSize: '0.9rem', color: '#f87171', fontWeight: 600 }}>
          {isReady ? `Recording ${timeFormatted}` : 'Connecting mic...'}
        </span>
      </div>

      {/* Live dynamic sound wave visualization */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '0.5rem' }}>
        {[0.6, 1.2, 0.8, 1.4, 0.9, 1.1].map((factor, idx) => (
          <div
            key={idx}
            style={{
              width: '3px',
              height: `${Math.max(6, Math.min(22, volumeLevel * factor * 0.35))}px`,
              backgroundColor: '#ef4444',
              borderRadius: '2px',
              transition: 'height 0.08s ease',
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Cancel button */}
      <button
        type="button"
        onClick={handleCancelRecording}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'var(--text-secondary, #8888a0)',
          borderRadius: '20px',
          padding: '0.4rem 0.85rem',
          fontSize: '0.82rem',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>

      {/* Send Voice Button */}
      <button
        type="button"
        onClick={handleStopAndSend}
        style={{
          background: 'var(--accent-gradient, linear-gradient(135deg, #6c3ce0, #a78bfa))',
          border: 'none',
          color: '#fff',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontWeight: 600,
          boxShadow: '0 2px 10px rgba(108, 60, 224, 0.4)',
        }}
        title="Send Voice Message"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
