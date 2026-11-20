# Little Chick

En responsiv webbplats med en liten gul kyckling. Barn och vuxna kan läsa en bildsaga, lyssna på vaggvisor och spela ett fruktspel. Webbplatsen har ljust och mörkt tema samt ett enkelt vuxenkonto.

## Öppna webbplatsen

[Öppna granskningsversionen](https://mumipo-website.malirnsh.workers.dev/)

Använd länken ovan vid bedömningen. Den vanliga domänen är tillfälligt avstängd.

## Starta lokalt

Du behöver Git, Python 3 och en webbläsare. Ingen byggprocess krävs.

```sh
git clone https://github.com/Malishaah/mumipo-website.git
cd mumipo-website
python3 -m http.server 8766 --bind 127.0.0.1
```

Öppna http://127.0.0.1:8766 och avsluta servern med Ctrl+C.
Du kan även hämta koden som ZIP från GitHub, packa upp den och köra samma serverkommando i mappen med `index.html`.

## Använd och testa

1. Välj **Stories**, öppna boken och prova **Next**, **Back** och **Read again**.
2. Välj **Play**. Hoppa med mellanslag eller tryck på spelplanen. Hoppa en gång till i luften för ett dubbelhopp. Målet är 15 frukter. Landa på en svamp för att studsa; en kollision från sidan kostar ett hjärta.
3. Prova paus, ljudknapp och återgång från spelet.
4. Spela och pausa en vaggvisa. Växla mellan ljust och mörkt tema.
5. Prova samma flöden i en smal mobilvy och en bred datorvy.

Vuxenkontot, e-postkod och sparade stjärnor kräver den konfigurerade servermiljön. De fungerar inte fullt ut med den enkla lokala servern. Inloggning testas i den driftade versionen med en e-postadress som du själv kan ta emot kod på.

## Teknisk struktur

- `index.html` och `design.css`: gränssnitt och anpassning till skärmstorlek.
- `storybook.js`: boknavigation.
- `game.js` och `game-audio.js`: spel, hopp, hinder och ljud.
- `account.js`: vuxenkontots gränssnitt.
- `workers/`: serverfunktioner och databasscheman för Cloudflare Workers och D1.
- `chick.webp`, `chick-icon.png` och `chick-share.jpg`: webbplatsens tillfälliga kycklingbilder.

Inloggning använder Supabase och e-post via Resend. Hemliga nycklar hör till serverns konfiguration och ska aldrig läggas i Git eller klientkod.

## Avgränsning

Detta är granskningsversionen med en tillfällig kycklingfigur. Ingen färgläggningsdel eller nedladdning av tidigare illustrationer ingår. Butiken visar en kommande produkt; riktig försäljning är inte öppen och spelstjärnor ger ännu ingen rabatt.

Den tidigare betalningsprototypen är separat från den lokala webbplatsen. Testbetalningar med kort och PayPal har utförts, men hela kedjan till automatisk orderregistrering återstår att verifiera. Använd inte riktiga betalningsuppgifter i testläge.
