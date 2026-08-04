' ============================================================
'  Lanza start-printbridge.bat en SEGUNDO PLANO (sin ventana).
'  Pon un acceso directo a este .vbs en la carpeta de Inicio
'  (shell:startup) para que arranque solo al encender la PC.
' ============================================================
Dim sh, fso, carpeta
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = carpeta
' 0 = ventana oculta ; False = no esperar a que termine
sh.Run """" & carpeta & "\start-printbridge.bat""", 0, False
