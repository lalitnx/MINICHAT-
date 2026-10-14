/**
 * components/Chat/CallModal.jsx — WebRTC Voice & Video Calling (WhatsApp style)
 */

import React, { useEffect, useRef, useState } from 'react';
import socket from '../../services/socket';
import toast from 'react-hot-toast';

export default function CallModal({
  isOpen,
  isIncoming,
  callType, // 'audio' | 'video'
  partner,
  incomingSignal,
  onClose,
}) {
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'calling'); // 'calling' | 'incoming' | 'connected'
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);

  const partnerId = partner?._id || partner?.from;
  const partnerName = partner?.username || partner?.fromUsername || 'User';

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Synthesized phone ringtone using Web Audio API
  const startRingtone = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playBeep = () => {
        if (ctx.state === 'closed') return;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440; // A4
        osc2.frequency.value = 480; // B4

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      };

      playBeep();
      ringtoneIntervalRef.current = setInterval(playBeep, 2500);
    } catch (e) {
      console.warn('Ringtone sound bypassed:', e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setCallStatus(isIncoming ? 'incoming' : 'calling');

    if (isIncoming) {
      startRingtone();
    }

    let isCleanedUp = false;

    async function setupMediaAndCall() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });

        if (isCleanedUp) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(iceServers);
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // When remote track arrives
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Send ICE candidate
        pc.onicecandidate = (event) => {
          if (event.candidate && partnerId) {
            socket.emit('ice_candidate', {
              to: partnerId,
              candidate: event.candidate,
            });
          }
        };

        // If caller: create offer and send to partner
        if (!isIncoming && partnerId) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('call_user', {
            userToCall: partnerId,
            signalData: offer,
            callType,
          });
        }
      } catch (err) {
        console.error('Call media setup error:', err);
        toast.error('Could not access microphone/camera');
      }
    }

    setupMediaAndCall();

    // Socket listeners for call signaling
    const handleCallAccepted = async ({ signal }) => {
      stopRingtone();
      setCallStatus('connected');
      if (peerConnectionRef.current && signal) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    };

    const handleCallEnded = () => {
      stopRingtone();
      toast('Call ended', { icon: '📞' });
      handleCleanup();
      if (onClose) onClose();
    };

    const handleCallRejected = () => {
      stopRingtone();
      toast.error(`${partnerName} declined the call`);
      handleCleanup();
      if (onClose) onClose();
    };

    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_rejected', handleCallRejected);

    return () => {
      isCleanedUp = true;
      stopRingtone();
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);
      handleCleanup();
    };
  }, [isOpen, isIncoming, partnerId, callType]);

  const handleAcceptCall = async () => {
    stopRingtone();
    try {
      const pc = peerConnectionRef.current;
      if (!pc || !incomingSignal) {
        // Fallback: connect directly in test mode
        setCallStatus('connected');
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', {
        to: partnerId,
        signal: answer,
      });

      setCallStatus('connected');
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Accept call error:', err);
      // Fallback: connect anyway so user can test local audio/video
      setCallStatus('connected');
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleEndCall = () => {
    stopRingtone();
    if (partnerId) {
      if (callStatus === 'incoming') {
        socket.emit('reject_call', { to: partnerId });
      } else {
        socket.emit('end_call', { to: partnerId });
      }
    }
    handleCleanup();
    if (onClose) onClose();
  };

  const handleSimulateConnected = () => {
    stopRingtone();
    setCallStatus('connected');
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    toast.success('Call connected! Testing camera & mic.');
  };

  const handleCleanup = () => {
    stopRingtone();
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setDuration(0);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  if (!isOpen) return null;

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(6, 6, 11, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-surface, #12121e)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Call Header */}
        <div
          style={{
            padding: '1.25rem',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              color: 'var(--accent-primary, #a78bfa)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: '0.35rem 0' }}>
            {partnerName}
          </h2>
          <div style={{ fontSize: '0.9rem', color: callStatus === 'connected' ? '#34d399' : 'var(--text-secondary, #8888a0)', fontWeight: 500 }}>
            {callStatus === 'calling' && 'Calling (Waiting for answer)...'}
            {callStatus === 'incoming' && '🔔 Incoming Call... Ringing!'}
            {callStatus === 'connected' && `Connected (${timeFormatted})`}
          </div>
        </div>

        {/* Video / Avatar Container */}
        <div
          style={{
            position: 'relative',
            height: '320px',
            backgroundColor: '#0a0a14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: callType === 'video' && callStatus === 'connected' ? 'block' : 'none',
            }}
          />

          {/* Voice Call Avatar or Ringing state */}
          {(callType === 'audio' || callStatus !== 'connected') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  background: 'var(--accent-gradient, linear-gradient(135deg, #6c3ce0, #a78bfa))',
                  color: '#fff',
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 35px rgba(167, 139, 250, 0.4)',
                  animation: callStatus !== 'connected' ? 'pulse 1.2s infinite' : 'none',
                }}
              >
                {partnerName?.charAt(0).toUpperCase() || '?'}
              </div>

              {callStatus === 'calling' && (
                <button
                  type="button"
                  onClick={handleSimulateConnected}
                  style={{
                    backgroundColor: 'rgba(108, 60, 224, 0.25)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    color: 'var(--accent-primary, #a78bfa)',
                    borderRadius: '20px',
                    padding: '0.45rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Click to Answer Call Here (Demo / Self Test)
                </button>
              )}
            </div>
          )}

          {/* Local Picture-in-Picture Video */}
          {callType === 'video' && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                width: '110px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '10px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
                display: isVideoDisabled ? 'none' : 'block',
              }}
            />
          )}
        </div>

        {/* Controls Bar */}
        <div
          style={{
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          }}
        >
          {/* Incoming Call: Big Accept (Green) and Decline (Red) buttons */}
          {callStatus === 'incoming' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={handleEndCall}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.5)',
                  }}
                  title="Decline"
                >
                  ✕
                </button>
                <span style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600 }}>Decline</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={handleAcceptCall}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(34, 197, 94, 0.5)',
                    animation: 'pulse 1s infinite alternate',
                  }}
                  title="Accept Call"
                >
                  📞
                </button>
                <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>Accept</span>
              </div>
            </div>
          ) : (
            <>
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isMuted ? '#ef4444' : 'var(--bg-elevated, #1a1a2e)',
                  border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
                  color: '#fff',
                  fontSize: '1.15rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={isMuted ? 'Unmute' : 'Mute Microphone'}
              >
                {isMuted ? '🔇' : '🎙️'}
              </button>

              {/* Toggle Video Button (if video call) */}
              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: isVideoDisabled ? '#ef4444' : 'var(--bg-elevated, #1a1a2e)',
                    border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '1.15rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  📹
                </button>
              )}

              {/* End Call Button */}
              <button
                onClick={handleEndCall}
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(239, 68, 68, 0.5)',
                }}
                title="Hang Up"
              >
                📞
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
