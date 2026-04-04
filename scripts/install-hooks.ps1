# install-hooks.ps1
# Configure Git to use the project's shared hook directory.
# Run once after cloning: scripts/install-hooks.ps1

Set-Location $PSScriptRoot\..
git config core.hooksPath .githooks
Write-Host "Git hooks path set to .githooks"
Write-Host "Pre-commit hook is now active (repo-guard + gitleaks)."
Write-Host ""
Write-Host "To enable secret scanning in the hook, install gitleaks:"
Write-Host "  https://github.com/gitleaks/gitleaks/releases"
