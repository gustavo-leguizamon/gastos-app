export { default } from 'next-auth/middleware'

// `api/cron/*` queda fuera de la sesión: lo llama Vercel Cron (sin cookies) y se
// autentica con `Authorization: Bearer $CRON_SECRET` dentro del handler.
export const config = {
  matcher: [
    '/((?!api/auth|api/cron|login|manifest.json|sw.js|icon-.*\\.png|favicon.ico|_next/static|_next/image).*)',
  ],
}
