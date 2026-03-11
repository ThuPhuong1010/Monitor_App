import { useState, useEffect } from 'react'
import { onAuthStateChange, getSession } from '../services/supabase'

/**
 * useAuth() — trả về session hiện tại và trạng thái loading.
 *
 * Usage:
 *   const { user, loading } = useAuth()
 *   if (loading) return <Spinner />
 *   if (!user) return <LoginPrompt />
 */
export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = đang check
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check session hiện tại ngay khi mount
    getSession().then(session => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Lắng nghe thay đổi auth (login / logout / token refresh)
    const unsubscribe = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return {
    user,
    loading,
    isLoggedIn: !!user,
    email: user?.email ?? null,
  }
}
