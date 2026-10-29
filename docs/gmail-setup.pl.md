# Darmowa wysyłka kodów przez Gmail API

Instrukcja dla właściciela wdrożenia. Osoby sprawdzające wycieki nie muszą
autoryzować aplikacji w Google. Korzystamy z osobnej skrzynki projektu, bez
kupowania domeny. Nie wpisuj prywatnego adresu ani sekretów do kodu lub README.

## 1. Projekt Google Cloud

1. Zaloguj się na konto skrzynki projektu w https://console.cloud.google.com/.
2. Utwórz projekt, np. `ExposureGuard Mail`.
3. W **APIs & Services → Library** wyszukaj **Gmail API** i wybierz **Enable**.
4. W **Google Auth Platform** skonfiguruj aplikację OAuth. Użyj nazwy projektu
   i skrzynki projektu jako adresu kontaktowego. Zwykły Gmail wymaga typu
   użytkowników **External**.
5. W **Data Access / Scopes** dodaj wyłącznie
   `https://www.googleapis.com/auth/gmail.send`.
6. Na czas konfiguracji, w **Audience → Test users**, dodaj skrzynkę projektu.
   Odbiorców kodów nie dodaje się do tej listy.

## 2. Klient OAuth i jednorazowa zgoda

1. W **Clients / Credentials** utwórz klienta **OAuth client ID → Web application**.
2. Jako **Authorized redirect URI** dodaj dokładnie
   `https://developers.google.com/oauthplayground`.
3. Otwórz https://developers.google.com/oauthplayground na tym samym koncie.
4. W ustawieniach (koło zębate) zaznacz **Use your own OAuth credentials**.
   Wpisz tam Client ID i Client secret utworzonego klienta. Nie używaj
   współdzielonych domyślnych danych Playground.
5. Wybierz dostęp offline, jeśli ustawienie jest widoczne. W kroku 1 wpisz
   zakres `https://www.googleapis.com/auth/gmail.send` i wybierz **Authorize APIs**.
6. Sprawdź, że logujesz się na skrzynkę projektu i zgoda dotyczy wyłącznie
   wysyłania poczty. Zatwierdź dostęp do własnego projektu.
7. W kroku 2 wybierz **Exchange authorization code for tokens**.
8. Zachowaj **Refresh token** w menedżerze haseł lub bezpośrednio w sekretach
   hostingu. Krótkotrwały Access token nie jest potrzebny do konfiguracji.

Nie wysyłaj tych wartości w rozmowie, issue ani pull requeście. Zrzut ekranu
Playground może zawierać tokeny, więc również nie publikuj go w repozytorium.

## 3. Ważność dostępu

Przy typie External i statusie **Testing** refresh token z zakresem Gmail wygasa
po **7 dniach**. To nadaje się do pierwszego testu, ale wymaga potem ponownej
autoryzacji. Do utrzymywania wdrożenia przejdź przez ustawienia **Audience →
Publish app / In production**, a następnie ponownie uzyskaj refresh token.

Zmiana statusu nie oznacza automatycznej weryfikacji aplikacji przez Google.
Google może pokazać ostrzeżenie lub wymagać dodatkowej weryfikacji zależnie od
konfiguracji i sposobu udostępniania. Nie poszerzaj zakresów, żeby rozwiązać
problem konfiguracji. Ten klient OAuth służy wyłącznie właścicielowi nadawcy.
Token może też przestać działać po cofnięciu zgody lub zmianie hasła Gmail.

## 4. Konfiguracja hostingu

Dodaj wartości w ustawieniach runtime Sites, a następnie wdróż wersję ponownie:

| Nazwa | Wartość | Sekret |
| --- | --- | --- |
| `MAIL_PROVIDER` | `gmail` | nie |
| `MAIL_FROM` | adres skrzynki projektu autoryzowanej powyżej | według preferencji |
| `GMAIL_CLIENT_ID` | Client ID własnego klienta | tak |
| `GMAIL_CLIENT_SECRET` | Client secret | tak |
| `GMAIL_REFRESH_TOKEN` | Refresh token uzyskany z własnym klientem | tak |
| `VERIFICATION_SECRET` | losowy sekret min. 32 znaków | tak |

W tych ustawieniach nie używa się hasła skrzynki. W repozytorium nie trzeba
zapisywać nawet adresu nadawcy. Odbiorcy wiadomości zobaczą adres projektu w polu
From. Autor własnej kopii repozytorium konfiguruje swoje konto i swoje sekrety.

Po konfiguracji przeprowadź jeden test na własnej skrzynce: wyślij kod,
potwierdź go, uruchom wyszukiwanie i zakończ sesję. Samo `available: true`
potwierdza obecność konfiguracji, nie ważność tokenów ani dostarczenie poczty.

## Limity i problemy

- Limity Gmail oraz własne limity aplikacji nadal obowiązują. To rozwiązanie
  służy niewielkiemu ruchowi, nie masowej wysyłce.
- `MAIL_UNAVAILABLE`: sprawdź włączenie Gmail API, ważność refresh tokena,
  zgodność klienta i autoryzowaną skrzynkę. Aplikacja celowo nie pokazuje
  użytkownikowi odpowiedzi Google zawierających szczegóły konfiguracji.
- Jeśli zgoda została cofnięta, uzyskaj nowy refresh token i zmień sekret.

Dokumentacja Google, sprawdzona 2026-10-29:

- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/identity/protocols/oauth2/web-server#offline
- https://developers.google.com/identity/protocols/oauth2#expiration
