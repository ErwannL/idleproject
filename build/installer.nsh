; Idle RPG — une seule installation à la fois.
; L'installateur est « en un clic », toujours pour l'utilisateur courant : une nouvelle version
; remplace l'ancienne au même endroit. Une ancienne installation « pour tous les utilisateurs »
; (choix possible dans les versions 1 à 6) est d'abord désinstallée, pour ne pas avoir deux jeux.
!macro customInit
  StrCpy $5 "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  ReadRegStr $1 HKLM "$5" "InstallLocation"
  ${if} $1 == ""
    StrCpy $5 "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
    ReadRegStr $1 HKLM "$5" "InstallLocation"
  ${endif}
  ${if} $1 != ""
  ${andif} ${FileExists} "$1\Uninstall ${PRODUCT_FILENAME}.exe"
    ; Le désinstallateur « pour tous » a besoin des droits administrateur : lancé avec « runas »,
    ; puis on attend que son entrée disparaisse (60 s au plus).
    ExecShell "runas" "$1\Uninstall ${PRODUCT_FILENAME}.exe" "/allusers /S" SW_HIDE
    StrCpy $2 0
    ${do}
      Sleep 500
      IntOp $2 $2 + 1
      ReadRegStr $3 HKLM "$5" "InstallLocation"
      ${if} $3 == ""
        ${break}
      ${endif}
    ${loopuntil} $2 >= 120
  ${endif}
!macroend
