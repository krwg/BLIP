; BLIP NSIS customizations — welcome / finish copy (en + ru via electron-builder languages)

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "BLIP Setup"
  !define MUI_WELCOMEPAGE_TEXT "LAN-only P2P messenger — text, voice, and video.$\r$\n$\r$\nNo cloud. No accounts. Your mesh, your rules.$\r$\n$\r$\nPublisher: krwg"
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "BLIP installed"
  !define MUI_FINISHPAGE_TEXT "BLIP is ready on your network.$\r$\n$\r$\nOpen firewall UDP 42069 and TCP 42070 if peers are not discovered."
!macroend
