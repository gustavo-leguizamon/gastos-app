// Node 16 no expone los globals web (Request/Response/Headers/fetch) que
// `next/server` (NextRequest/NextResponse) necesita al importarse. Los
// polyfilleamos desde undici antes de cualquier import de las routes.
import { fetch, Headers, Request, Response } from 'undici'

const g = globalThis as any
if (!g.fetch) g.fetch = fetch
if (!g.Headers) g.Headers = Headers
if (!g.Request) g.Request = Request
if (!g.Response) g.Response = Response
