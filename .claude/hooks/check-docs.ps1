$ErrorActionPreference = 'SilentlyContinue'

# Read stop_hook_active so we don't re-trigger when Stop already fired in this loop
$stdin = [Console]::In.ReadToEnd()
try {
    $payload = $stdin | ConvertFrom-Json
    if ($payload.stop_hook_active -eq $true) { exit 0 }
} catch {}

$root = (Get-Location).Path
$claudeMd = Join-Path $root 'CLAUDE.md'
if (-not (Test-Path $claudeMd)) { exit 0 }

# Tomar el mtime mas reciente entre CLAUDE.md y cualquier doc en docs/claude/*.md
$docFiles = @(Get-Item $claudeMd)
$docsDir = Join-Path $root 'docs\claude'
if (Test-Path $docsDir) {
    $docFiles += Get-ChildItem -Path $docsDir -Filter '*.md' -File
}
$cmMtime = ($docFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime

# Cooldown: if hook already reminded in the last 3 minutes, skip
$sentinel = Join-Path $root '.claude\.docs-reminded'
if (Test-Path $sentinel) {
    $age = (Get-Date) - (Get-Item $sentinel).LastWriteTime
    if ($age.TotalSeconds -lt 180) { exit 0 }
}

$watchDirs = @('src', 'prisma') | Where-Object { Test-Path (Join-Path $root $_) }
if ($watchDirs.Count -eq 0) { exit 0 }

$newer = Get-ChildItem -Path $watchDirs -Recurse -File |
    Where-Object {
        $_.LastWriteTime -gt $cmMtime -and
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\\.next\\' -and
        $_.Extension -in @('.ts', '.tsx', '.js', '.jsx', '.prisma')
    } |
    Select-Object -First 5

if (-not $newer) { exit 0 }

# Mark sentinel to avoid loops
New-Item -ItemType File -Path $sentinel -Force | Out-Null

$files = ($newer | ForEach-Object { $_.FullName.Substring($root.Length + 1) }) -join ', '
$reason = "Se detectaron cambios de codigo posteriores a la ultima edicion de la documentacion (CLAUDE.md o docs/claude/*.md) en: $files. Revisa si el comportamiento de la app cambio (nuevas funcionalidades, campos, rutas API, calculos, dialogs, filtros, etc.) y actualiza la seccion correspondiente (el archivo de docs/claude/ que aplique, o CLAUDE.md) antes de terminar. Si los cambios son puramente cosmeticos o refactor sin cambio de comportamiento observable, tocale el mtime a CLAUDE.md (por ejemplo agregando una linea en blanco al final) y confirma explicitamente que la doc sigue vigente."

$out = @{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress
Write-Output $out
exit 0
