; ── noted. — Custom NSIS installer script ──────────────────
; Included by electron-builder during NSIS compilation

!macro customHeader
  !system "echo 'noted. installer customization loaded'"
!macroend

; Branding text shown at bottom of installer
!macro customInit
  BrandingText "noted. — by Voyager Technologies Limited"
!macroend

; Run app after install
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
