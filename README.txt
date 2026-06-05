ZOMBIE HANGMAN 1117 - pliki do podmiany

Podmień całą zawartość paczki na GitHubie.

Zmiana względem wersji 1116:
- podłączono Multiplayer do Firebase Realtime Database projektu wisielec-3b28b,
- host i drugi gracz po wpisaniu tego samego kodu widzą się jednocześnie w tym samym pokoju,
- lista graczy, status pokoju, rozpoczęcie rundy, hasło, użyte litery, kolej gracza, licznik, punkty, punkty zombie i błędy są synchronizowane między urządzeniami,
- pokój jest ograniczony do dwóch graczy,
- tylko host może rozpocząć grę, a przycisk jest aktywny po dołączeniu drugiego gracza,
- gra pojedyncza pozostaje bez zmian.

WAŻNE — reguły Realtime Database:
W Firebase Console otwórz Realtime Database > Rules i upewnij się, że aplikacja webowa ma prawo odczytu i zapisu ścieżki rooms. Na czas testów można użyć pliku firebase-realtime-database-rules.json dołączonego do paczki. Po zakończeniu testów należy zabezpieczyć reguły.
