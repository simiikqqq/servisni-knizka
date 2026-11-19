# Digitální servisní knížka

Jednoduchá česká aplikace v samostatných HTML, CSS a JavaScript souborech. Nepotřebuje účet, internetové připojení, instalaci ani příkazy.

## Spuštění

Otevřete `index.html` dvojklikem v prohlížeči. Aplikace se spustí rovnou. Soubory `styles.css` a `app.js` ponechte ve stejné složce jako HTML.

## Ukládání dat

Vozidla a servisní záznamy se ukládají do úložiště prohlížeče na tomto zařízení. Zůstanou dostupné po zavření a opětovném otevření stránky ve stejném prohlížeči. Neukládají se na server a nesynchronizují se mezi zařízeními ani prohlížeči. Vymazání dat webu v nastavení prohlížeče smaže i servisní knížku; při přechodu na jiné zařízení se data nepřenesou.

## Co aplikace umí

- Přidat, upravit a smazat více vozidel.
- Evidovat pro každé vozidlo oddělené servisní záznamy: předvolbu nebo vlastní úkon, datum, nájezd, cenu a poznámku.
- Upravit a smazat záznam s potvrzením před smazáním.
- Rychle aktualizovat aktuální nájezd vozidla přímo z jeho přehledu.
- Nastavit orientační nebo vlastní interval, zobrazit cílový nájezd a servis po termínu.
- Vyhledávat v servisní historii a zobrazit evidované náklady.
- Používat aplikaci na počítači i mobilu.

Přednastavené intervaly jsou pouze orientační. Rozhodující jsou pokyny výrobce pro konkrétní vozidlo.

## Součásti projektu

- `index.html` — stránka aplikace; otevřete ji dvojklikem.
- `styles.css` — tmavý vzhled a přizpůsobení mobilům.
- `app.js` — formuláře, servisní historie a ukládání dat.

Všechny tři soubory ponechte ve stejné složce. Data aplikace jsou ve stejném místním úložišti prohlížeče jako před rozdělením souborů; úprava souborů uložené záznamy nemaže.

Karta „Další servis“ zůstává zelená, dokud je servis dále než v polovině zadaného intervalu. Poté zežloutne a při nejvýše 2 000 km do dalšího servisu zčervená. Zmeškaný servis je zobrazen červeně.
