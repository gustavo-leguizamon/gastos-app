---
description: Corre el typecheck (tsc --noEmit) y reporta solo los errores
---

Verificá que el proyecto compila sin errores de tipos.

1. Corré: `npx tsc --noEmit 2>&1 | Select-Object -First 40; Write-Output "EXIT: $LASTEXITCODE"`
2. Si `EXIT` es `0` y no hay errores → confirmá en una línea que está todo OK.
3. Si hay errores → listalos agrupados por archivo y proponé el fix de cada uno. No los apliques sin confirmar salvo que sean triviales y evidentes.

No corras `npm run build` salvo que te lo pida explícitamente (es más lento); el typecheck alcanza para la mayoría de los casos.
