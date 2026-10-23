param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line.Trim() -eq '' -or $line.TrimStart().StartsWith('#')) { continue }
        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) { throw 'Linha inválida no arquivo .env.' }
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, 'Process'))) {
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
}
if ([string]::IsNullOrWhiteSpace($env:ConnectionStrings__UsersDb)) {
    throw 'Defina ConnectionStrings__UsersDb no ambiente ou copie .env.example para .env.'
}
Push-Location (Join-Path $projectRoot 'backend')
try {
    $runArgs = @('run', '--no-launch-profile')
    if ($NoBuild) { $runArgs += '--no-build' }
    & dotnet @runArgs
    if ($LASTEXITCODE -ne 0) { throw 'A API encerrou com erro.' }
} finally { Pop-Location }
