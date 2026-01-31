@echo off
echo 1/3: Raccolgo le modifiche...
"C:\Program Files\Git\cmd\git.exe" add .

echo 2/3: Salvo le modifiche...
"C:\Program Files\Git\cmd\git.exe" commit -m "Aggiornamento automatico"

echo 3/3: Carico su GitHub...
"C:\Program Files\Git\cmd\git.exe" push -u origin main

echo.
echo ==========================================
echo TUTTO FATTO! Il sito si aggiornera' a breve.
echo ==========================================
pause
