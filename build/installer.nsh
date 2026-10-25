; Idle RPG — une seule installation à la fois.
; L'installateur est « en un clic », toujours pour l'utilisateur courant : une nouvelle version
; remplace l'ancienne au même endroit. Une ancienne installation « pour tous les utilisateurs »
; (choix possible dans les versions 1 à 6) est d'abord désinstallée, pour ne pas avoir deux jeux.
; (customInit s'exécute après check64BitAndSetRegView : la vue 64 bits du registre est active.)
!macro customInit
  ReadRegStr $1 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $1 != ""
  ${andif} ${FileExists} "$1\${UNINSTALL_FILENAME}"
    ; Le désinstallateur « pour tous » a besoin des droits administrateur : lancé avec « runas »,
    ; puis on attend que son inscription disparaisse du registre (60 s au plus).
    ExecShell "runas" "$1\${UNINSTALL_FILENAME}" "/allusers /S" SW_HIDE
    StrCpy $2 0
    ${do}
      Sleep 500
      IntOp $2 $2 + 1
      ReadRegStr $3 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
      ${if} $3 == ""
        ${break}
      ${endif}
    ${loopuntil} $2 >= 120
    Sleep 1000
  ${endif}
!macroend
