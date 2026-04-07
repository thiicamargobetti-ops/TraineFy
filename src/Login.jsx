import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSendCode() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setError('Erro ao enviar o código. Tenta novamente.')
    } else {
      setStep('code')
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setError('Código inválido ou expirado. Tenta novamente.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#a3e635', letterSpacing: '3px', textTransform: 'uppercase' }}>
            TRAINEFY
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563' }}>
            Seu treino. Sempre com você.
          </p>
        </div>

        {step === 'email' ? (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
              SEU EMAIL
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendCode()}
              placeholder="nome@email.com"
              style={{
                width: '100%',
                background: '#1f2937',
                border: '1.5px solid #374151',
                borderRadius: 12,
                padding: '14px 16px',
                color: '#f9fafb',
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 12,
              }}
            />
            {error && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#ef4444' }}>{error}</p>
            )}
            <button
              onClick={handleSendCode}
              disabled={loading || !email.trim()}
              style={{
                width: '100%',
                background: email.trim() ? '#a3e635' : '#1f2937',
                border: 'none',
                borderRadius: 12,
                padding: '15px 0',
                cursor: email.trim() ? 'pointer' : 'default',
                fontSize: 15,
                fontWeight: 800,
                color: email.trim() ? '#0a0a0a' : '#4b5563',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
            <p style={{ marginTop: 20, fontSize: 12, color: '#4b5563', textAlign: 'center', lineHeight: 1.6 }}>
              Você receberá um código de 6 dígitos no email.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
              CÓDIGO DE VERIFICAÇÃO
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4b5563' }}>
              Enviado para <strong style={{ color: '#d1d5db' }}>{email}</strong>
            </p>
            <input
              type="number"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
              placeholder="000000"
              style={{
                width: '100%',
                background: '#1f2937',
                border: '1.5px solid #374151',
                borderRadius: 12,
                padding: '14px 16px',
                color: '#f9fafb',
                fontSize: 28,
                fontWeight: 800,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 12,
                textAlign: 'center',
                letterSpacing: '8px',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            {error && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#ef4444' }}>{error}</p>
            )}
            <button
              onClick={handleVerifyCode}
              disabled={loading || code.length < 6}
              style={{
                width: '100%',
                background: code.length >= 6 ? '#a3e635' : '#1f2937',
                border: 'none',
                borderRadius: 12,
                padding: '15px 0',
                cursor: code.length >= 6 ? 'pointer' : 'default',
                fontSize: 15,
                fontWeight: 800,
                color: code.length >= 6 ? '#0a0a0a' : '#4b5563',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
            <button
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              style={{ marginTop: 16, width: '100%', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}
            >
              Usar outro email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
