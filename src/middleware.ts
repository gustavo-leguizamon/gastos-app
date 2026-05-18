export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!api/auth|login|manifest.json|sw.js|icon-.*\\.png|favicon.ico|_next/static|_next/image).*)',
  ],
}
