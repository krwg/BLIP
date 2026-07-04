; BLIP NSIS — electron-builder include (see https://www.electron.build/nsis.html)
; customWelcomePage / customFinishPage must insert MUI pages (defines alone are not enough).

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "BLIP Setup"
  !define MUI_WELCOMEPAGE_TEXT "LAN-only P2P messenger — text, voice, and video.$\r$\n$\r$\nNo cloud. No accounts. Your mesh, your rules.$\r$\n$\r$\nPublisher: krwg"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "BLIP installed"
  !define MUI_FINISHPAGE_TEXT "BLIP is ready on your network.$\r$\n$\r$\nAllow UDP 42069 and TCP 42070 in the firewall if peers are not discovered.$\r$\n$\r$\nFiles .blip open in BLIP automatically after install."
  !define MUI_FINISHPAGE_RUN_TEXT "Launch BLIP"

  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend
