import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import WorkoutTracker from './WorkoutTracker'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = ainda carregando

  useEffect(() => {
    // Lê a sessão atual (inclusive do magic link ao voltar pro app)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuta mudanças: login, logout, refresh de token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Ainda verificando sessão
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0f1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <p style={{ color: '#4b5563', fontSize: 13 }}>Carregando...</p>
      </div>
    )
  }

  // Não logado
  if (!session) return <Login />

  // Logado — passa o userId para o WorkoutTracker
  return <WorkoutTracker userId={session.user.id} userEmail={session.user.email} />
}
