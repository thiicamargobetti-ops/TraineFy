import { supabase } from './supabaseClient'

// ── Workouts ───────────────────────────────────────────────────────────────

export async function loadWorkoutsFromCloud(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.data ?? null
}

export async function saveWorkoutsToCloud(userId, workouts) {
  const { error } = await supabase
    .from('workouts')
    .upsert(
      { user_id: userId, data: workouts, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

// ── History ────────────────────────────────────────────────────────────────

export async function loadHistoryFromCloud(userId) {
  const { data, error } = await supabase
    .from('history')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.data ?? null
}

export async function saveHistoryToCloud(userId, history) {
  const { error } = await supabase
    .from('history')
    .upsert(
      { user_id: userId, data: history, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}
