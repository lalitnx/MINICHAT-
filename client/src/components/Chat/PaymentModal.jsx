/**
 * components/Chat/PaymentModal.jsx — Real Razorpay Checkout Integration
 */

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function PaymentModal({
  conversationId,
  recipientName,
  isOpen,
  onClose,
  onPaymentSuccess,
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [customKeyId, setCustomKeyId] = useState(
    localStorage.getItem('minichat_razorpay_key') || '',
  );
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (customKeyId) {
      localStorage.setItem('minichat_razorpay_key', customKeyId);
    }
  }, [customKeyId]);

  if (!isOpen) return null;

  const quickAmounts = [50, 100, 200, 500];

  // Helper to load Razorpay checkout script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async (e) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Load Razorpay official SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Could not load Razorpay SDK. Please check your internet connection.');
        setIsProcessing(false);
        return;
      }

      // 2. Create order on server
      const { data: orderData } = await api.post('/payment/create-order', {
        conversationId,
        amount: numericAmount,
        note: note.trim(),
      });

      // Key to use: custom key from user, or orderData.keyId
      const activeKey =
        customKeyId.trim() ||
        (orderData.keyId !== 'rzp_test_placeholder' ? orderData.keyId : '');

      if (!activeKey) {
        setShowKeyConfig(true);
        setIsProcessing(false);
        toast('Please enter your Razorpay Key ID below to launch the real payment gateway!', {
          icon: '🔑',
          duration: 5000,
        });
        return;
      }

      // 3. Open Real Razorpay Checkout Window
      const options = {
        key: activeKey,
        amount: Math.round(numericAmount * 100), // in paise
        currency: 'INR',
        name: 'MiniChat Pay',
        description: note || `Payment transfer to ${recipientName}`,
        image: 'https://cdn-icons-png.flaticon.com/512/9334/9334547.png',
        order_id: orderData.isDemo ? undefined : orderData.orderId,
        prefill: {
          name: 'MiniChat User',
          email: 'user@minichat.app',
          contact: '9999999999',
        },
        handler: async (response) => {
          try {
            await api.post('/payment/verify', {
              conversationId,
              orderId: response.razorpay_order_id || `order_${Date.now()}`,
              paymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
              signature: response.razorpay_signature || '',
              amount: numericAmount,
              note: note.trim(),
              isDemo: orderData.isDemo,
            });
            toast.success(`Payment of ₹${numericAmount} sent successfully!`);
            setIsProcessing(false);
            onClose();
            if (onPaymentSuccess) onPaymentSuccess();
          } catch (err) {
            toast.error(err.response?.data?.error || 'Verification failed');
            setIsProcessing(false);
          }
        },
        theme: {
          color: '#6c3ce0',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error?.description || 'Cancelled'}`);
        setIsProcessing(false);
      });

      razorpayInstance.open();
    } catch (err) {
      console.error('Payment initiation error:', err);
      toast.error(err.response?.data?.error || 'Could not initiate Razorpay payment');
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(6, 6, 11, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #12121e)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
          borderRadius: 'var(--radius-lg, 20px)',
          padding: '1.75rem',
          maxWidth: '400px',
          width: '100%',
          boxShadow: 'var(--shadow-lg, 0 10px 40px rgba(0, 0, 0, 0.7))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.35rem' }}>💳</span>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #e4e4ef)', margin: 0 }}>
                MiniChat Pay
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                Powered by Official Razorpay Gateway
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #55556a)',
              fontSize: '1.3rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #8888a0)', marginBottom: '1.25rem' }}>
          Direct UPI / Card / NetBanking payment to <strong>{recipientName}</strong>.
        </p>

        <form onSubmit={handlePay}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #8888a0)', marginBottom: '0.35rem' }}>
              Amount (₹)
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--accent-primary, #a78bfa)',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                }}
              >
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.75rem 0.7rem 2.2rem',
                  backgroundColor: 'var(--bg-elevated, #1a1a2e)',
                  border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
                  borderRadius: 'var(--radius-md, 12px)',
                  color: '#fff',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q.toString())}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  backgroundColor: 'var(--bg-elevated, #1a1a2e)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  borderRadius: 'var(--radius-sm, 8px)',
                  color: 'var(--accent-primary, #a78bfa)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                +₹{q}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #8888a0)', marginBottom: '0.35rem' }}>
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="What is this for? e.g. Lunch 🍕"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                backgroundColor: 'var(--bg-elevated, #1a1a2e)',
                border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
                borderRadius: 'var(--radius-md, 10px)',
                color: '#fff',
                fontSize: '0.88rem',
              }}
            />
          </div>

          {/* Razorpay Key Settings Accordion */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary, #a78bfa)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{showKeyConfig ? '▼' : '▶'}</span>
              <span>Razorpay Key Settings {customKeyId ? '✓ (Key active)' : '(Required for live gateway)'}</span>
            </button>

            {showKeyConfig && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-elevated, #1a1a2e)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #8888a0)', marginBottom: '0.25rem' }}>
                  Your Razorpay Key ID:
                </label>
                <input
                  type="text"
                  placeholder="rzp_test_... or rzp_live_..."
                  value={customKeyId}
                  onChange={(e) => setCustomKeyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#0f0f1c',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #777)', marginTop: '0.4rem' }}>
                  Get free test key: <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary, #a78bfa)' }}>Razorpay Dashboard → API Keys</a>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
                borderRadius: 'var(--radius-md, 12px)',
                color: 'var(--text-secondary, #8888a0)',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || !amount}
              style={{
                flex: 1.6,
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 'var(--radius-md, 12px)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isProcessing || !amount ? 'not-allowed' : 'pointer',
                opacity: isProcessing || !amount ? 0.6 : 1,
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              {isProcessing ? 'Launching Razorpay...' : `Pay ₹${amount || '0'} via Razorpay`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
