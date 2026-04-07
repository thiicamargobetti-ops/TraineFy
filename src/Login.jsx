import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    setLoading(false)
    if (error) {
      setError('Erro ao enviar o link. Tenta novamente.')
    } else {
      setSent(true)
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

        {/* Logo */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#a3e635', letterSpacing: '3px', textTransform: 'uppercase' }}>
            TRAINEFY
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563' }}>
            Seu treino. Sempre com você.
          </p>
        </div>

        {sent ? (
          /* Estado pós-envio */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' }}>
              Link enviado!
            </p>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
              Abre o email <strong style={{ color: '#d1d5db' }}>{email}</strong> e toca no link para entrar.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              style={{ marginTop: 24, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
            >
              Usar outro email
            </button>
          </div>
        ) : (
          /* Formulário */
          <>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
              SEU EMAIL
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
              onClick={handleLogin}
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
              {loading ? 'Enviando...' : 'Entrar com link por email'}
            </button>
            <p style={{ marginTop: 20, fontSize: 12, color: '#4b5563', textAlign: 'center', lineHeight: 1.6 }}>
              Sem senha. Você recebe um link seguro no email toda vez que quiser entrar.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
