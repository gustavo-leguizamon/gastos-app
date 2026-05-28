import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const SUELDOS_ALLOWED_EMAIL = 'gustavoleguizamn@gmail.com'

export async function isSueldosAllowed() {
  const session = await getServerSession(authOptions)
  return session?.user?.email?.toLowerCase() === SUELDOS_ALLOWED_EMAIL
}
