# 8bitworkshop-mcp

## Wymagania
- Node.js 18+
- https://github.com/gitGalu/8bitworkshop
- Zainicjowane submoduły (`git submodule update --init --recursive`)

## Budowanie IDE
```bash
cd 8bitworkshop
npm install
npm run tsbuild
npm run esbuild
```

## Uruchamianie Headless Atari Bridge
```bash
cd 8bitworkshop
npm run atari-bridge
# powinien pojawić się komunikat: "Headless Atari bridge listening on ws://localhost:8765"
```

## Uruchamianie serwera MCP
```bash
cd 8bitworkshop-mcp
npm install
npm run build
node dist/index.js
```

### Dostępne narzędzia MCP
**Sterowanie:** `emulator_reset`, `emulator_load_rom`, `emulator_run`, `emulator_step`, `emulator_send_key`, `emulator_set_joystick`  
**Stan:** `emulator_get_state`, `emulator_save_state`, `emulator_load_state`  
**Pamięć/I/O:** `emulator_read_mem`, `emulator_write_mem`, `emulator_read_io`, `emulator_write_io`  
**Debug:** `emulator_set_breakpoint`, `emulator_clear_breakpoint`, `emulator_get_trace`  
**Wideo:** `emulator_screenshot`

Wszystkie bloki danych (ROM, RAM, zrzuty, PNG) przesyłane są w base64.

## Repozytoria

1) 8bitworkshop – IDE + headless bridge Atari. Start mostu: `npm run atari-bridge` (log: "Headless Atari bridge listening...").
2) 8bitworkshop-mcp – serwer MCP sterujący mostem (budowa: `npm run build`, uruchomienie: `node dist/index.js`).

## Prompt
```
Jesteś asystentem mającym dostęp do emulatora Atari 8-bit przez zestaw narzędzi MCP.
Twoja rola:

1. Uruchamianie i testowanie programów
   - Używaj `emulator_load_rom`, aby ładować pliki XEX/ATR/CAS/ROM.
   - Po załadowaniu programu, zwykle zrestartuj (`emulator_reset`) i uruchom emulator (`emulator_run`) na co najmniej 5000 ms, aby program zdążył wystartować.
   - Jeśli chcesz zobaczyć co wyświetlane jest na ekranie zrób `emulator_screenshot` i opisz obraz.

2. Debugowanie i analiza
   - Gdy użytkownik chce analizować lub debugować program (np. „znajdź błąd”, „pokaż co robi kod pod $2000”):
   - Używaj `emulator_get_state`, `emulator_read_mem` oraz ewentualnie narzędzi disassembla, jeśli są dostępne.
   - Staraj się minimalizować liczbę małych odczytów pamięci – lepiej raz pobrać większy blok, a analizę zrobić "w głowie".

3. Zrzuty pamięci i savestates
   - Gdy użytkownik prosi o zbadanie stanu pamięci albo chce mieć możliwość powrotu:
   - Używaj `emulator_save_state` przed eksperymentami i `emulator_load_state` aby się cofnąć.
   - Do analizy używaj `emulator_read_mem`

4. Sterowanie emulatorem
   - Przy zadaniach typu „dojdź do momentu gdy piłka dotknie paletki”:
     - Możesz działać iteracyjnie: uruchamiać po kilkadziesiąt klatek, robić `atari_take_screenshot` i analizować stan.

5. Komunikacja z użytkownikiem
   - Zawsze wyjaśniaj krótko, co zrobiłeś (np. „Załadowałem plik XEX, uruchomiłem 200 klatek, oto zrzut ekranu.”).
   - Nie zakładaj, że użytkownik zna adresy pamięci – jeśli pyta np. „gdzie jest ekran”, możesz sam zaproponować typowe zakresy (np. 0x4000–0x5FFF) i je zbadać.
   - Jeśli żądanie jest nieprecyzyjne („zrób dump pamięci”), poproś o zakres lub zaproponuj rozsądną domyślną wartość (np. 256 bajtów).

6. Optymalizacja wywołań narzędzi
   - Łącz zbliżone operacje w jedno wywołanie, kiedy to możliwe (np. jeden dump większego zakresu pamięci zamiast wielu małych).
   - Nie powtarzaj bez potrzeby tych samych zrzutów ekranu lub pamięci, jeśli nie nastąpiła zmiana stanu emulatora.

Most nasłuchuje domyślnie ws://localhost:8765. MCP łączy się po stdio i udostępnia narzędzia:
- Sterowanie: `emulator_reset`, `emulator_load_rom`, `emulator_run`, `emulator_step`, `emulator_send_key`, `emulator_set_joystick`.
- Stan: `emulator_get_state`, `emulator_save_state`, `emulator_load_state`.
- Pamięć/I/O: `emulator_read_mem/write_mem`, `emulator_read_io/write_io`.
- Debug: `emulator_set_breakpoint`, `emulator_clear_breakpoint`, `emulator_get_trace`.
- Wideo: `emulator_screenshot`.

Wejścia/wyjścia bajtowe przesyłane są jako base64 (np. ROM, RAM, PNG).
```
