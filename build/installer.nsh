; Extra step of the DC Prospect installer: install Claude Code if it is missing (official Anthropic installer).
; Skipped in silent mode (updates) and when Claude Code is already there.
!macro customInstall
  IfSilent claude_fin
  IfFileExists "$PROFILE\.local\bin\claude.exe" claude_fin
  IfFileExists "$APPDATA\npm\claude.cmd" claude_fin
  MessageBox MB_YESNO|MB_ICONQUESTION "DC Prospect a besoin de Claude Code pour chercher les prospects et écrire les e-mails (il utilise ton abonnement Claude).$\r$\n$\r$\nL'installer maintenant avec l'installateur officiel d'Anthropic ?$\r$\n(Sinon, DC Prospect te le proposera au premier lancement.)" IDNO claude_fin
    ; PSModulePath emptied: a value left by PowerShell 7 can break Windows PowerShell
    ExecWait 'cmd.exe /c "set PSModulePath=&& powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $\"irm https://claude.ai/install.ps1 | iex$\""'
    MessageBox MB_OK|MB_ICONINFORMATION "Claude Code est installé. Au premier lancement, clique sur « Se connecter à Claude » dans DC Prospect."
  claude_fin:
!macroend
