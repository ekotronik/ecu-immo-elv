# ECU • IMMO • ELV

## Opis
Projekt informacyjny poświęcony zagadnieniom **elektroniki samochodowej**, w szczególności:
- sterownikom silnika (**ECU**),
- systemom immobilizera (**IMMO**),
- blokadom kolumny kierowniczej (**ELV / ESCL**).

Strona ma charakter **przeglądowy i informacyjny**. Jej celem jest przedstawienie zakresu zagadnień technicznych oraz **weryfikacja zainteresowania tematyką**, bez prowadzenia działalności handlowej.

## Zakres tematyczny
- architektura i funkcje sterowników ECU,
- podstawy programowania i konfiguracji modułów elektronicznych,
- systemy zabezpieczeń pojazdu (immobilizer),
- blokady kolumny kierowniczej ELV/ESCL – zasada działania i typowe problemy,
- diagnostyka elektroniczna pojazdów.

## Charakter projektu
- statyczna strona HTML,
- brak sprzedaży online,
- brak cenników i formularzy zamówień,
- projekt **nie stanowi oferty handlowej**.

## Przeznaczenie
Projekt pełni rolę:
- strony informacyjnej,
- wizytówki kompetencji technicznych,
- narzędzia do analizy zainteresowania tematyką elektroniki samochodowej.

## Technologia
- HTML / CSS / JavaScript (frontend),
- brak backendu i bazy danych.

## Status
Projekt w fazie pilotażowej.

---
Repozytorium ma charakter informacyjny i dokumentacyjny.

## Szybkie dodawanie zdjęć do galerii (bez edycji HTML)

1. Wrzucaj zdjęcia do folderów (wg kategorii):
   - `assets_v8/galeria_auto/ECU/`
   - `assets_v8/galeria_auto/IMMO/`
   - `assets_v8/galeria_auto/ELV/`
   - `assets_v8/galeria_auto/DIAG/`
   - `assets_v8/galeria_auto/PCB/`

2. Po każdym pushu do gałęzi `main` GitHub Actions automatycznie:
   - przeskanuje powyższe foldery
   - zaktualizuje `gallery.json`
   - zrobi commit `Auto-update gallery.json`

3. Na stronie kliknij „Podgląd” w danej kategorii, a lightbox pokaże zdjęcia z tej kategorii.

Uwaga: Nazwy plików sortowane są alfabetycznie. Obsługiwane rozszerzenia: jpg/jpeg/png/webp/gif.
## Turbo dodawanie zdjęć (bez folderów kategorii)

1) Wrzucasz zdjęcia do jednego folderu:
   `assets_v8/galeria_auto/`

2) Nazwij pliki prefiksem kategorii (wielkość liter bez znaczenia):
- `ECU_...jpg`  (albo `ECU-...jpg`)
- `IMMO_...jpg`
- `ELV_...jpg`
- `DIAG_...jpg`
- `PCB_...jpg`

Przykłady:
- `ECU_bmw_e60_dde.jpg`
- `immo-ford_focus_key.webp`
- `PCB mercedes ecu board.png`

3) Commitujesz (lub uploadujesz przez GitHub z telefonu).
GitHub Actions automatycznie zaktualizuje `gallery.json`.

> Kompatybilność: jeśli nadal trzymasz podfoldery `assets_v8/galeria_auto/ECU/` itp., to też działa.
