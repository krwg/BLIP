; BLIP NSIS — electron-builder include
; https://www.electron.build/nsis.html
; Assisted wizard: Language → Welcome → Tips → License → Install mode → Directory → Install → Finish
; Uninstall: Welcome → optional Remove AppData → Remove files → Finish

!include "nsDialogs.nsh"

Var BlipTipsDialog
Var BlipTipsLabel

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to BLIP Setup"
  !define MUI_WELCOMEPAGE_TEXT "BLIP is a LAN-only P2P messenger — text, voice, video, and mesh files.$\r$\n$\r$\n• No cloud, no accounts, no mandatory internet$\r$\n• Same Wi‑Fi / Hamachi / Radmin / Tailscale mesh$\r$\n• Publisher: krwg · License: GNU GPL v3$\r$\n$\r$\nClick Next to review network tips, choose install mode, and pick a folder."
  !insertmacro MUI_PAGE_WELCOME
  Page custom BlipTipsPage
!macroend

Function BlipTipsPage
  nsDialogs::Create 1018
  Pop $BlipTipsDialog
  ${If} $BlipTipsDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 180u "Before you install$\r$\n$\r$\n1. Firewall — allow BLIP for private networks (UDP 42069 discovery, TCP 42070 chat/signaling).$\r$\n$\r$\n2. One copy per PC — two BLIP windows on the same machine cannot share those ports; use a VM or a second device to test.$\r$\n$\r$\n3. Install mode — per-user (no admin) or per-machine (all users, elevation).$\r$\n$\r$\n4. Folder — on the next pages you can change the install location.$\r$\n$\r$\n5. After install — .blip seed files and blip:// links open in BLIP automatically."
  Pop $BlipTipsLabel

  nsDialogs::Show
FunctionEnd

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "BLIP is ready"
  !define MUI_FINISHPAGE_TEXT "Setup finished.$\r$\n$\r$\n• Start BLIP and pick a free BLIP ID (1–64)$\r$\n• Open UDP 42069 / TCP 42070 if peers stay invisible$\r$\n• Portable builds do not use this Setup — use the *-Portable.exe instead$\r$\n$\r$\nDocs: https://krwg.github.io/blip/"
  !define MUI_FINISHPAGE_RUN_TEXT "Launch BLIP now"
  !define MUI_FINISHPAGE_LINK "Open BLIP site"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://krwg.github.io/blip/"

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

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Remove BLIP"
  !define MUI_WELCOMEPAGE_TEXT "This wizard uninstalls BLIP from this computer.$\r$\n$\r$\nChat history and settings live under your Windows user profile (AppData). You can optionally delete that data on the components page."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customUnInstallSection
  Section /o "un.Remove BLIP settings and chat data"
    RMDir /r "$APPDATA\BLIP"
    RMDir /r "$LOCALAPPDATA\BLIP"
  SectionEnd
!macroend
