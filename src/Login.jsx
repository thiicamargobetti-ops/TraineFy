import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleLogin() {
    if (!email.trim() || !password) return
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) setError('Email ou senha incorretos.')
  }

  async function handleSignup() {
    if (!email.trim() || !password) return
    if (password.length !== 6) { setError('A senha deve ter exatamente 6 dígitos.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setError('Erro ao criar conta. Tenta novamente.')
    } else {
      setSuccess('Conta criada! Entrando...')
      await supabase.auth.signInWithPassword({ email: email.trim(), password })
    }
  }

  async function handleGoogle() {
    setLoadingGoogle(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setError('Erro ao conectar com Google.'); setLoadingGoogle(false) }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Digite seu email primeiro.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (error) {
      setError('Erro ao enviar email de recuperação.')
    } else {
      setSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.')
    }
  }

  const isLogin = mode === 'login'

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0f1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#a3e635', letterSpacing: '3px' }}>TRAINEFY</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563' }}>Seu treino. Sempre com você.</p>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          disabled={loadingGoogle}
          style={{
            width: '100%', background: '#fff', border: 'none',
            borderRadius: 12, padding: '14px 0', cursor: 'pointer',
            fontSize: 15, fontWeight: 700, color: '#1f2937',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 16, opacity: loadingGoogle ? 0.7 : 1,
          }}
        >
          {/* Google logo SVG */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loadingGoogle ? 'Aguarde...' : 'Entrar com Google'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#374151' }} />
          <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 500 }}>ou use seu email</span>
          <div style={{ flex: 1, height: 1, background: '#374151' }} />
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#1f2937', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          <button onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
            style={{ flex: 1, background: isLogin ? '#374151' : 'transparent', border: 'none', borderRadius: 9, padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: isLogin ? '#f9fafb' : '#6b7280', transition: 'all 0.2s' }}>
            Entrar
          </button>
          <button onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
            style={{ flex: 1, background: !isLogin ? '#374151' : 'transparent', border: 'none', borderRadius: 9, padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: !isLogin ? '#f9fafb' : '#6b7280', transition: 'all 0.2s' }}>
            Criar conta
          </button>
        </div>

        {/* Email */}
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>EMAIL</p>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (isLogin ? handleLogin() : handleSignup())}
          placeholder="nome@email.com"
          style={{ width: '100%', background: '#1f2937', border: '1.5px solid #374151', borderRadius: 12, padding: '14px 16px', color: '#f9fafb', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

        {/* Password */}
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>SENHA — 6 dígitos</p>
        <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6}
          value={password}
          onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v.length <= 6) setPassword(v); }}
          onKeyDown={e => e.key === 'Enter' && (isLogin ? handleLogin() : handleSignup())}
          placeholder="000000"
          style={{ width: '100%', background: '#1f2937', border: '1.5px solid #374151', borderRadius: 12, padding: '14px 16px', color: '#f9fafb', fontSize: 22, fontWeight: 800, letterSpacing: '8px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

        {/* Error / Success */}
        {error && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{error}</p>}
        {success && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#a3e635', fontWeight: 600 }}>{success}</p>}

        {/* Main button */}
        <button onClick={isLogin ? handleLogin : handleSignup}
          disabled={loading || !email.trim() || !password}
          style={{ width: '100%', background: email.trim() && password ? '#a3e635' : '#1f2937', border: 'none', borderRadius: 12, padding: '15px 0', cursor: email.trim() && password ? 'pointer' : 'default', fontSize: 15, fontWeight: 800, color: email.trim() && password ? '#0a0a0a' : '#4b5563', transition: 'all 0.2s', marginBottom: 14 }}>
          {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
        </button>

        {/* Forgot password */}
        {isLogin && (
          <button onClick={handleForgotPassword} disabled={loading}
            style={{ width: '100%', background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 13, textAlign: 'center' }}>
            Esqueci minha senha
          </button>
        )}
      </div>
    </div>
  )
}
