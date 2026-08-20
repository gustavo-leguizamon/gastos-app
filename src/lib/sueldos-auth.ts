import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { emailPuedeVerSueldos } from '@/lib/sueldos-compute'

// Re-export por conveniencia de las routes, que ya importan de acá.
export { emailPuedeVerSueldos, periodoDe, sueldosEmails } from '@/lib/sueldos-compute'

/**
 * Guard server-side de la sección Sueldos. Es el control de acceso real: la lista
 * `NEXT_PUBLIC_SUELDOS_EMAILS` sólo decide a quién se le muestra el link del menú.
 */
export async function isSueldosAllowed() {
  const session = await getServerSession(authOptions)
  return emailPuedeVerSueldos(session?.user?.email)
}
