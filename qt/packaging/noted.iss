; noted for Windows: Inno Setup script. Built by scripts\release.ps1:
;
;   ISCC /DVersion=2.0.0 /DSource=..\dist\noted packaging\noted.iss
;
; Installs for the current user only (no admin prompt) into the folder the
; Electron build used, %LOCALAPPDATA%\Programs\noted, after quietly removing
; that build if it's there. The notes themselves live in %APPDATA%\noted and
; are never touched by installing or uninstalling.
;
; Silent updates: noted runs this with /VERYSILENT /RELAUNCH and quits; the
; [Run] entry below opens it again at the end. The Electron build's updater
; runs it with its own NSIS switches (--updated /S), which Inno ignores, so
; that first move to this version shows the normal wizard.

#ifndef Version
  #define Version "0.0.0"
#endif
#ifndef Source
  #define Source "..\dist\noted"
#endif

[Setup]
AppId={{6F1C2A9E-3B7D-4E58-9A40-0C8D5E2F7B13}
AppName=noted
AppVersion={#Version}
AppVerName=noted {#Version}
AppPublisher=Voyager Technologies Limited
AppPublisherURL=https://github.com/vygr-labs/noted-desktop-app
AppCopyright=Copyright (c) 2026 Voyager Technologies Limited
VersionInfoVersion={#Version}
DefaultDirName={localappdata}\Programs\noted
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=noted-win-x64
SetupIconFile=noted.ico
UninstallDisplayIcon={app}\noted.exe
UninstallDisplayName=noted
LicenseFile=..\..\LICENSE
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no

[Messages]
WelcomeLabel2=This installs noted [name/ver] on your computer.%n%nIf you have the older version of noted, it's replaced. Your notes stay exactly where they are.

[Tasks]
Name: "desktopicon"; Description: "Put noted on the desktop"; GroupDescription: "Shortcuts:"

[Files]
Source: "{#Source}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\noted"; Filename: "{app}\noted.exe"
Name: "{autodesktop}\noted"; Filename: "{app}\noted.exe"; Tasks: desktopicon

[Registry]
; "Open with" for markdown and text files (Windows' default-apps settings pick it up).
Root: HKCU; Subkey: "Software\Classes\Applications\noted.exe"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "noted"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Applications\noted.exe\shell\open\command"; ValueType: string; ValueData: """{app}\noted.exe"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\Applications\noted.exe\SupportedTypes"; ValueType: string; ValueName: ".md"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\Applications\noted.exe\SupportedTypes"; ValueType: string; ValueName: ".markdown"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\Applications\noted.exe\SupportedTypes"; ValueType: string; ValueName: ".txt"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\Applications\noted.exe\SupportedTypes"; ValueType: string; ValueName: ".text"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\.md\OpenWithList\noted.exe"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\.markdown\OpenWithList\noted.exe"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\.txt\OpenWithList\noted.exe"; Flags: uninsdeletekey

[Run]
Filename: "{app}\noted.exe"; Description: "Open noted"; Flags: nowait postinstall skipifsilent
Filename: "{app}\noted.exe"; Flags: nowait; Check: Relaunch

[Code]
const
  UninstallKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall';

function Relaunch: Boolean;
begin
  Result := WizardSilent and (Pos('/RELAUNCH', UpperCase(GetCmdTail)) > 0);
end;

{ The Electron build (electron-builder's NSIS installer): its uninstall entry
  says "noted 1.x" and points at "Uninstall noted.exe". }
function FindElectron(var Uninstaller: String): Boolean;
var
  Names: TArrayOfString;
  I: Integer;
  Name, Display, Cmd: String;
begin
  Result := False;
  if not RegGetSubkeyNames(HKCU, UninstallKey, Names) then Exit;
  for I := 0 to GetArrayLength(Names) - 1 do
  begin
    Name := Names[I];
    if Pos('_is1', Name) > 0 then Continue;
    if not RegQueryStringValue(HKCU, UninstallKey + '\' + Name, 'DisplayName', Display) then Continue;
    if (Pos('noted ', LowerCase(Display)) <> 1) and (LowerCase(Display) <> 'noted') then Continue;
    if not RegQueryStringValue(HKCU, UninstallKey + '\' + Name, 'UninstallString', Cmd) then Continue;
    if Pos('uninstall noted.exe', LowerCase(Cmd)) = 0 then Continue;
    { "C:\...\Uninstall noted.exe" /currentuser -> the path alone }
    if (Length(Cmd) > 0) and (Cmd[1] = '"') then
    begin
      Delete(Cmd, 1, 1);
      Cmd := Copy(Cmd, 1, Pos('"', Cmd) - 1);
    end;
    if FileExists(Cmd) then
    begin
      Uninstaller := Cmd;
      Result := True;
      Exit;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Uninstaller, Dir: String;
  Code: Integer;
begin
  Result := '';
  if FindElectron(Uninstaller) then
  begin
    Dir := ExtractFileDir(Uninstaller);
    Log('Removing the Electron build at ' + Dir);
    { _?= runs the NSIS uninstaller in place, so waiting on it waits for the
      uninstall itself. It leaves its own exe behind, which goes next. }
    if Exec(Uninstaller, '/currentuser /S _?=' + Dir, '', SW_HIDE, ewWaitUntilTerminated, Code) then
      DeleteFile(Uninstaller)
    else
      Log('The Electron uninstaller did not start: ' + SysErrorMessage(Code));
  end;
end;
