; ============================================================
;  Medical Centre Stock Register — Windows installer
;
;  Built with NSIS. Installs per-user (no administrator rights
;  needed), creates Desktop and Start Menu shortcuts, and
;  registers a proper entry in Apps & Features.
;
;  Build:  makensis -DVERSION=1.0.0 build/installer.nsi
; ============================================================

Unicode true
SetCompressor /SOLID lzma

!ifndef VERSION
  !define VERSION "1.0.0"
!endif

!define APP_NAME    "Medical Centre Stock Register"
!define SHORT_NAME  "MedicalCentreStockRegister"
!define EXE_NAME    "Medical Centre Stock Register.exe"
!define PUBLISHER   "Medical Centre Stock Register"
!define REG_UNINST  "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SHORT_NAME}"
!define SOURCE_DIR  "..\dist\win-unpacked"

Name "${APP_NAME}"
OutFile "..\dist\${SHORT_NAME}-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${SHORT_NAME}"
InstallDirRegKey HKCU "Software\${SHORT_NAME}" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUnInstDetails show

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName"     "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey "FileVersion"     "${VERSION}"
VIAddVersionKey "ProductVersion"  "${VERSION}"
VIAddVersionKey "CompanyName"     "${PUBLISHER}"
VIAddVersionKey "LegalCopyright"  "${PUBLISHER}"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON   "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT  "This will install the stock register for medicines, disposable items and permanent assets on this computer.$\r$\n$\r$\nNo administrator rights are needed, and nothing is sent over the internet — the register is kept in a file on this computer.$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE_NAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Open the Stock Register now"
!define MUI_FINISHPAGE_TEXT "${APP_NAME} has been installed.$\r$\n$\r$\nStart it from the Desktop shortcut or the Start Menu. Open Settings & Backup first and enter the name of your medical centre — it is printed on every report."
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ------------------------------------------------------------

Section "Install"
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; remove files from any previous version before laying down the new one
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"

  File /r "${SOURCE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortCut "$DESKTOP\Stock Register.lnk" "$INSTDIR\${EXE_NAME}" "" "$INSTDIR\${EXE_NAME}" 0
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Stock Register.lnk" "$INSTDIR\${EXE_NAME}" "" "$INSTDIR\${EXE_NAME}" 0
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\${SHORT_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\${SHORT_NAME}" "Version"    "${VERSION}"

  WriteRegStr HKCU "${REG_UNINST}" "DisplayName"     "${APP_NAME}"
  WriteRegStr HKCU "${REG_UNINST}" "DisplayVersion"  "${VERSION}"
  WriteRegStr HKCU "${REG_UNINST}" "Publisher"       "${PUBLISHER}"
  WriteRegStr HKCU "${REG_UNINST}" "DisplayIcon"     "$INSTDIR\${EXE_NAME}"
  WriteRegStr HKCU "${REG_UNINST}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "${REG_UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "${REG_UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${REG_UNINST}" "NoRepair" 1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${REG_UNINST}" "EstimatedSize" "$0"
SectionEnd

; ------------------------------------------------------------

Section "Uninstall"
  Delete "$DESKTOP\Stock Register.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Stock Register.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
  RMDir  "$SMPROGRAMS\${APP_NAME}"

  RMDir /r "$INSTDIR"

  DeleteRegKey HKCU "${REG_UNINST}"
  DeleteRegKey HKCU "Software\${SHORT_NAME}"

  ; The register itself lives in %APPDATA%\Medical Centre Stock Register and is
  ; deliberately left in place — uninstalling the program must never destroy
  ; the stock records. Delete that folder by hand if it is really not needed.
  MessageBox MB_OK|MB_ICONINFORMATION "The program has been removed.$\r$\n$\r$\nYour stock register data has been kept at:$\r$\n$APPDATA\${APP_NAME}$\r$\n$\r$\nDelete that folder yourself if you no longer need the records."
SectionEnd
