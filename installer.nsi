; installer.nsi - Tự động tạo Task Scheduler khi install (cú pháp sạch, không lỗi string)

!macro customInstall
  ; Tạo task scheduler chạy app ngầm, highest privileges, SYSTEM account, delay 30s
    ; Tạo task scheduler chạy batch loop (run_loop.bat trong thư mục resources)
    ; Sử dụng cmd.exe /c "$INSTDIR\resources\run_loop.bat"
    ExecWait '$SYSDIR\schtasks.exe /Create /F /TN "SystemMonitorBG" /TR "\"$SYSDIR\\cmd.exe\" /c \"\"$INSTDIR\\resources\\run_loop.bat\"\"" /SC ONLOGON /RL HIGHEST /RU SYSTEM /DELAY 0000:30 /IT'
!macroend

!macro customUnInstall
  ExecWait '$SYSDIR\schtasks.exe /Delete /TN "SystemMonitorBG" /F'
!macroend

; Bắt buộc để NSIS hợp lệ (electron-builder yêu cầu)
Section "MainSection" SEC01
SectionEnd