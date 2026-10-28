; Idle RPG — une seule installation à la fois.
; L'installateur est « en un clic », toujours pour l'utilisateur courant : une nouvelle version
; remplace l'ancienne au même endroit. Une ancienne installation « pour tous les utilisateurs »
; (choix possible dans les versions 1 à 6) est d'abord désinstallée, pour ne pas avoir deux jeux.
; (customInit s'exécute après check64BitAndSetRegView : la vue 64 bits du registre est active.)
!macro customInit
  ; v8.9.2 — « Extraction : erreur d'écriture du fichier …\app-64.7z » : le disque (dossier Temp) était plein.
  ; 1) On supprime les installateurs des mises à jour précédentes laissés dans Temp (≈ 120 Mo chacun ;
  ;    celui qui tourne est verrouillé et reste). 2) On vérifie la place libre et on l'explique clairement.
  FindFirst $4 $5 "$TEMP\IdleRPG-*-setup.exe"
  ${do}
    ${if} $5 == ""
      ${break}
    ${endif}
    Delete "$TEMP\$5"
    FindNext $4 $5
  ${loop}
  FindClose $4
  ClearErrors
  ${GetRoot} "$TEMP" $6
  ${DriveSpace} "$6\" "/D=F /S=M" $7
  ${ifNot} ${Errors}
  ${andif} $7 < 700
    MessageBox MB_OK|MB_ICONEXCLAMATION "Espace disque insuffisant sur $6 : $7 Mo libres, il en faut environ 700 Mo pour installer Idle RPG.$\r$\n$\r$\nVidez la Corbeille ou supprimez des fichiers (Parametres Windows > Stockage), puis relancez l'installation. Votre partie est conservee." /SD IDOK
    SetErrorLevel 3
    Quit
  ${endif}
  ClearErrors
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

; v8.9.1 — mise à jour depuis le jeu : l'installateur était lancé pendant que le jeu se fermait (sauvegarde).
; En silencieux, l'installateur d'origine abandonnait sans rien dire s'il ne parvenait pas à fermer le jeu
; (ou si l'ancien désinstallateur échouait) : jeu à moitié installé, ou processus fantôme qui empêchait
; tout nouveau lancement. Ici : on laisse le jeu finir sa sauvegarde (10 s au plus), puis on ferme de force
; tous ses processus, et on n'abandonne jamais.
!macro idleKillApp
  nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
  Pop $0
!macroend

!macro idleAppRunning _RETURN
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
  Pop ${_RETURN}
!macroend

!macro customCheckAppRunning
  StrCpy $R1 0
  ${do}
    !insertmacro idleAppRunning $R0
    ${if} $R0 != 0
      ${break}
    ${endif}
    ${if} $R1 == 4
      ; Demande polie (le jeu sauvegarde puis se ferme), comme un clic sur la croix.
      nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
      Pop $0
    ${endif}
    ${if} $R1 >= 20
      DetailPrint `Closing "${PRODUCT_NAME}"...`
      !insertmacro idleKillApp
    ${endif}
    Sleep 500
    IntOp $R1 $R1 + 1
  ${loopuntil} $R1 >= 60
  ; Laisse Windows libérer les fichiers.
  Sleep 800
!macroend

; L'ancien désinstallateur a échoué (fichier encore ouvert…) : on installe quand même par-dessus au lieu
; d'abandonner (les fichiers sont remplacés, la sauvegarde est ailleurs et n'est jamais touchée).
!macro customUnInstallCheck
  ClearErrors
  ${if} $R0 != 0
    DetailPrint `Old version: uninstall incomplete (code $R0), installing over it.`
    !insertmacro idleKillApp
    Sleep 800
  ${endif}
!macroend
!macro customUnInstallCheckCurrentUser
  !insertmacro customUnInstallCheck
!macroend
