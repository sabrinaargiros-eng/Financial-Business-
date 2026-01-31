# Guida: Mettere il Sito Online con GitHub e Netlify 🚀

Segui questi passaggi per pubblicare il tuo sito e avere gli **aggiornamenti automatici**.

## Fase 1: Crea la Repository su GitHub 🐙
1.  Vai su [github.com](https://github.com) e accedi (o registrati).
2.  Clicca sul **"+"** in alto a destra -> **"New repository"**.
3.  **Repository name**: scrivi `business-patatine-manager` (o quello che vuoi).
4.  Lascia "Public".
5.  **NON** spuntare "Add a README", ".gitignore" o "License" (abbiamo già tutto noi).
6.  Clicca **"Create repository"**.
7.  Nella pagina successiva, copia il link che finisce con `.git` (es. `https://github.com/TuoNome/business-patatine-manager.git`).

## Fase 2: Collega il tuo PC a GitHub 💻
Apri il terminare (in VS Code: premi `Ctrl` + `ò` o vai su Terminal -> New Terminal) e scrivi questi comandi **uno alla volta**:

1.  Inizializza Git (se non l'hai fatto):
    ```bash
    git init
    git add .
    git commit -m "Primo salvataggio"
    ```

2.  Collega la repository remota (incolla il TUO link):
    ```bash
    git remote add origin https://github.com/IL-TUO-NOME-UTENTE/business-patatine-manager.git
    ```
3.  Rinomina il ramo principale:
    ```bash
    git branch -M main
    ```
4.  Carica il codice online:
    ```bash
    git push -u origin main
    ```

## Fase 3: Netlify (Il Passo Finale) 🌐
1.  Vai su [netlify.com](https://www.netlify.com/) e accedi.
2.  Clicca **"Add new site"** -> **"Import an existing project"**.
3.  Scegli **GitHub**.
4.  Cerca `business-patatine-manager` e selezionalo.
5.  Clicca **"Deploy business-patatine-manager"**.

**Fatto!** 🎉
