import { ACCOUNT_DELETION_CONSEQUENCES } from '@prezentowo/types'

import type { Lang } from './landing.i18n'
import {
  Contact,
  ExternalLink,
  type LegalDoc,
  PageLink,
} from './landing.legalParts'

// The privacy policy (docs/spec.md §3.7), drafted from the outline in
// "Privacy policy and terms: content and URLs" (#87), which fixes every fact
// and period in it. Polish is binding. Section 2's table is also the source
// for the stores' App Privacy and Data safety answers.

const pl: LegalDoc = {
  title: 'Polityka prywatności',
  description:
    'Jakie dane przetwarza Prezentowo, po co, komu je powierza i jak długo je przechowuje.',
  body: (
    <>
      <p>
        Ta polityka opisuje, co Prezentowo, czyli aplikacja mobilna i ta strona,
        robi z Twoimi danymi osobowymi.
      </p>

      <aside className="note summary">
        <p>
          <b>W skrócie, prostymi słowami</b>
        </p>
        <ul>
          <li>
            Konto możesz mieć od 13 lat. Przy pierwszym logowaniu pytamy o datę
            urodzenia i ją zapisujemy. Widzisz ją tylko Ty, nikt inny.
          </li>
          <li>
            Trzymamy Twój adres e-mail, imię, awatar albo zdjęcie i to, co
            dodajesz w wydarzeniach. Nie mamy reklam ani śledzenia i niczego nie
            sprzedajemy.
          </li>
          <li>
            Masz poniżej 16 lat? Nie wysyłamy Ci powiadomień push, a osoby,
            które Cię nie znają, nie znajdą Cię po imieniu. Zmieni się to samo w
            dniu 16. urodzin. Ktoś znajomy nadal może dodać Cię do wydarzenia
            albo wysłać Ci link z zaproszeniem.
          </li>
          <li>
            Masz mniej niż 18 lat? Upewnij się, że rodzic lub opiekun wie, że
            korzystasz z Prezentowo, i się na to zgadza.
          </li>
          <li>
            Konto usuniesz sam w aplikacji (Profil → Usuń konto). Możesz też
            napisać na <Contact />.
          </li>
        </ul>
      </aside>

      <h2>1. Kim jesteśmy</h2>
      <p>
        Administratorem Twoich danych osobowych jest Filip Jarno, który prowadzi
        Prezentowo. We wszystkich sprawach dotyczących tej polityki i Twoich
        danych pisz na <Contact />.
      </p>

      <h2>2. Co zbieramy i po co</h2>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Dane</th>
              <th>Co dokładnie</th>
              <th>Po co i na jakiej podstawie</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Twoje konto</td>
              <td>
                Adres e-mail, imię, wybrany awatar albo Twoje własne zdjęcie,
                data urodzenia, kopia imienia przygotowana do wyszukiwania oraz
                tokeny logowania.
              </td>
              <td>
                Żeby logować Cię linkiem z e-maila i pokazywać Cię osobom w
                Twoich wydarzeniach. Datę urodzenia zapisujemy, żeby wiedzieć,
                czy możesz mieć konto (od 13 lat) i od którego dnia dostajesz
                powiadomienia push i możesz być wyszukany (od 16 lat, pkt 10).
                Liczymy to z niej za każdym razem, więc zmienia się samo w dniu
                urodzin. Widzisz ją tylko Ty, nikt inny, a usuwamy ją razem z
                kontem. Kopia do wyszukiwania pozwala innym znaleźć Cię po
                imieniu, jeśli masz co najmniej 16 lat (pkt 4). Umowa.
              </td>
            </tr>
            <tr>
              <td>To, co tworzysz</td>
              <td>
                Wydarzenia (tytuł, data, tło), ich uczestnicy, prezenty (nazwa,
                opis, link, zdjęcie), rezerwacje prezentów, wiadomości i zdjęcia
                na czacie oraz wynikające z nich aktywność i powiadomienia w
                aplikacji.
              </td>
              <td>To jest sama usługa. Umowa.</td>
            </tr>
            <tr>
              <td>
                Twoje urządzenia, jeśli masz co najmniej 16 lat i włączysz
                powiadomienia push
              </td>
              <td>
                Tokeny push od Expo i od systemu telefonu, platforma (iOS albo
                Android), język aplikacji i Twoje ustawienia powiadomień.
              </td>
              <td>Żeby wysyłać Ci powiadomienia, które wybierzesz. Zgoda.</td>
            </tr>
            <tr>
              <td>Logi serwera i proxy</td>
              <td>
                Metadane żądań, takie jak adres IP i identyfikator przeglądarki
                (user agent).
              </td>
              <td>
                Bezpieczeństwo i zapobieganie nadużyciom. Prawnie uzasadniony
                interes.
              </td>
            </tr>
            <tr>
              <td>Na Twoim urządzeniu</td>
              <td>
                Zaszyfrowana kopia Twoich danych, dzięki której aplikacja działa
                bez internetu, oraz zmiany czekające na wysłanie.
              </td>
              <td>
                Żeby aplikacja działała offline. Kopia zostaje w telefonie i
                jest kasowana, gdy się wylogujesz albo usuniesz konto. Umowa.
              </td>
            </tr>
            <tr>
              <td>Import z linku</td>
              <td>
                Gdy dodajesz prezent z linku do sklepu, stronę sklepu pobiera
                nasz serwer, więc sklep widzi adres IP serwera, a nie Twój.
                Zapisujemy tylko domenę sklepu i to, czy import się udał.
              </td>
              <td>Żeby uzupełnić prezent za Ciebie. Umowa.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Podstawy prawne (art. 6 ust. 1 RODO): większość tych danych jest
        potrzebna, żeby świadczyć usługę, z której korzystasz (wykonanie umowy,
        lit. b). Bezpieczeństwo i zapobieganie nadużyciom, czyli limity zapytań,
        limity próśb o usunięcie konta i logi serwera, opierają się na naszym
        prawnie uzasadnionym interesie w ochronie usługi (lit. f). Tylko
        powiadomienia push opierają się na Twojej zgodzie (lit. a). Wyrażasz ją
        w okienku aplikacji i w uprawnieniach telefonu, a wycofujesz w każdej
        chwili przełącznikami „Powiadomienia push” w aplikacji albo w
        ustawieniach telefonu. Osoby poniżej 16 lat nie mogą jej wyrazić
        samodzielnie, więc nie dostają powiadomień push (pkt 10).
      </p>

      <h2>3. Osoby, które nie korzystają z aplikacji</h2>
      <p>
        Twórca wydarzenia może dodać do niego kogoś po imieniu, na przykład
        dziecko albo babcię bez aplikacji, i dać tej osobie zdjęcie. Te dane
        podaje twórca wydarzenia. Widzą je uczestnicy wydarzenia i każdy, kto ma
        link z zaproszeniem do niego (pkt 4).
      </p>
      <p>
        Dane te są usuwane razem z wydarzeniem albo gdy twórca usunie tę osobę z
        wydarzenia. Zdjęcie jest usuwane także wtedy, gdy ta osoba dołączy do
        wydarzenia i zajmie swoje miejsce. Każdy może poprosić o usunięcie
        swojego imienia albo zdjęcia, pisząc na <Contact />.
      </p>

      <h2>4. Kto co widzi</h2>
      <ul>
        <li>
          <b>Uczestnicy wydarzenia</b> widzą wydarzenie, jego uczestników i ich
          listy prezentów, z dwiema zasadami. Na swojej liście widzisz tylko
          prezenty dodane przez siebie, nigdy te zaproponowane dla Ciebie przez
          innych, i nigdy nie widzisz, kto kupuje Twoje prezenty. Pozostali
          uczestnicy widzą wszystkie prezenty na Twojej liście i to, kto je
          kupuje, żeby nikt nie kupił tego samego dwa razy.
        </li>
        <li>
          <b>Każdy, kto ma link z zaproszeniem</b> do wydarzenia, także bez
          logowania, widzi jego tytuł i datę oraz imiona, awatary i zdjęcia
          uczestników.
        </li>
        <li>
          <b>Zalogowani użytkownicy mogą znaleźć Cię po imieniu</b>, jeśli masz
          co najmniej 16 lat, i zobaczyć Twój awatar i zdjęcie, ale nigdy Twój
          adres e-mail. Osób poniżej 16 lat nie da się w ten sposób znaleźć. Na
          razie nie da się wyłączyć tego wyszukiwania.
        </li>
        <li>
          <b>Data urodzenia:</b> widzisz ją tylko Ty. Nie pokazujemy jej nikomu
          innemu, ani w wyszukiwarce, w wydarzeniach, w aktywności ani na
          czacie.
        </li>
        <li>
          <b>Linki do zdjęć</b> są długie i losowe, więc nie da się ich
          odgadnąć, ale nie są w żaden inny sposób chronione: każdy, kto ma link
          do zdjęcia, może je otworzyć.
        </li>
      </ul>

      <h2>5. Komu powierzamy dane</h2>
      <p>
        Te firmy przetwarzają dane w naszym imieniu (podmioty przetwarzające),
        tylko po to, żeby Prezentowo działało:
      </p>
      <ul>
        <li>
          <b>Scaleway</b> (Transactional Email) wysyła e-maile z linkiem do
          logowania. Dostaje Twój adres e-mail i treść wiadomości.{' '}
          <ExternalLink href="https://www.scaleway.com/en/privacy-policy/">
            Polityka prywatności Scaleway
          </ExternalLink>
          .
        </li>
        <li>
          <b>Stream</b> (GetStream) obsługuje czat. Dostaje Twój identyfikator
          użytkownika, imię, wiadomości i zdjęcia z czatu, a jeśli włączysz
          powiadomienia push, także token push Twojego telefonu i język
          aplikacji.{' '}
          <ExternalLink href="https://getstream.io/legal/privacy/">
            Polityka prywatności Stream
          </ExternalLink>
          .
        </li>
        <li>
          <b>Expo</b> wysyła powiadomienia push z aplikacji (poza czatem).
          Dostaje tokeny push i treść powiadomień, w której mogą być nazwy
          prezentów.{' '}
          <ExternalLink href="https://expo.dev/privacy">
            Polityka prywatności Expo
          </ExternalLink>
          .
        </li>
        <li>
          <b>Apple</b> (Apple Push Notification service) i <b>Google</b>{' '}
          (Firebase Cloud Messaging) doręczają powiadomienia push na iPhone’y i
          telefony z Androidem.{' '}
          <ExternalLink href="https://www.apple.com/legal/privacy/">
            Polityka prywatności Apple
          </ExternalLink>
          ,{' '}
          <ExternalLink href="https://policies.google.com/privacy">
            polityka prywatności Google
          </ExternalLink>
          .
        </li>
        <li>
          <b>Cloudflare</b> przekazuje ruch do tej strony i połączenie aplikacji
          z serwerem. Widzi metadane żądań, takie jak adres IP i identyfikator
          przeglądarki.{' '}
          <ExternalLink href="https://www.cloudflare.com/privacypolicy/">
            Polityka prywatności Cloudflare
          </ExternalLink>
          .
        </li>
      </ul>
      <p>
        Treść powiadomień push i tokeny urządzeń trafiają do Expo i Stream jako
        podmiotów przetwarzających. Serwer, bazę danych i przesłane zdjęcia
        administrator utrzymuje samodzielnie, na własnym serwerze.
      </p>

      <h2>6. Przekazywanie danych poza EOG</h2>
      <ul>
        <li>Expo: USA.</li>
        <li>Apple: USA.</li>
        <li>Google: USA.</li>
        <li>Cloudflare: USA.</li>
      </ul>
      <p>
        Scaleway (Francja) i Stream (nasz czat działa w jego regionie EU West)
        przechowują dane w UE, więc nie przekazują ich poza EOG.
      </p>
      <p>
        Przekazanie danych do USA opiera się na ramach ochrony danych UE–USA
        (EU–US Data Privacy Framework), jeśli dana firma ma certyfikat, a jeśli
        nie ma, na standardowych klauzulach umownych zatwierdzonych przez
        Komisję Europejską.
      </p>

      <h2>7. Jak długo przechowujemy dane</h2>
      <ul>
        <li>
          <b>Konto i to, co tworzysz:</b> dopóki nie usuniesz konta (pkt 8).
          Sesje logowania nie wygasają. Kończy je wylogowanie albo usunięcie
          konta.
        </li>
        <li>
          <b>Konta, na które nikt się nie zalogował:</b> wpisanie adresu e-mail
          w aplikacji od razu zakłada dla niego konto, żeby dało się wysłać link
          do logowania. Jeśli nikt się na nie nie zaloguje, usuwamy je po 7
          dniach. Jeśli ktoś odpowie przy pierwszym logowaniu, że ma poniżej 13
          lat, konto jest usuwane od razu.
        </li>
        <li>
          <b>Logi serwera i proxy:</b> 14 dni.
        </li>
        <li>
          <b>Przesłane zdjęcia, które nie zostały do niczego dodane:</b> 24
          godziny.
        </li>
        <li>
          <b>Obrazki podglądu linków z zaproszeniem:</b> usuwane razem z
          wydarzeniem. Nieaktualne są usuwane na bieżąco.
        </li>
        <li>
          <b>Kopie zapasowe</b> bazy danych i zdjęć znikają w ciągu 30 dni.
        </li>
      </ul>

      <h2>8. Usunięcie konta</h2>
      <p>
        Konto usuniesz w aplikacji (Profil → Usuń konto) albo na stronie{' '}
        <PageLink path="/delete-account" lang="pl">
          Usuń konto
        </PageLink>
        . W obu przypadkach dzieje się to od razu i nie da się tego cofnąć. Co
        się wtedy dzieje:
      </p>
      <ul>
        {ACCOUNT_DELETION_CONSEQUENCES.pl.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>
        Możesz też poprosić o usunięcie konta, pisząc na <Contact />. Na takie
        prośby odpowiadamy w ciągu miesiąca.
      </p>

      <h2>9. Twoje prawa</h2>
      <ul>
        <li>
          <b>Sprostowanie:</b> imię i zdjęcie zmienisz w aplikacji.
        </li>
        <li>
          <b>Usunięcie danych:</b> pkt 8.
        </li>
        <li>
          <b>Dostęp do danych i ich przeniesienie:</b> napisz na <Contact />. W
          ciągu miesiąca dostaniesz swoje dane jako plik JSON, przygotowany
          ręcznie. W aplikacji nie ma eksportu danych.
        </li>
        <li>
          <b>Sprzeciw i ograniczenie przetwarzania:</b> napisz na <Contact />.
        </li>
        <li>
          <b>Skarga:</b> do{' '}
          <ExternalLink href="https://uodo.gov.pl/">
            Prezesa Urzędu Ochrony Danych Osobowych
          </ExternalLink>
          .
        </li>
      </ul>

      <h2>10. Dzieci</h2>
      <p>
        Konto mogą mieć osoby od 13 lat. Przy pierwszym logowaniu pytamy o datę
        urodzenia i zapisujemy Twoją datę urodzenia. Widzisz ją tylko Ty i
        trzymamy ją do usunięcia konta. Nie sprawdzamy jej niczym poza tym, że
        jest prawdziwą datą z ostatnich 120 lat. Osobom poniżej 13 lat nie
        zakładamy konta i niczego o nich nie zapisujemy, a gdy dowiemy się o
        takim koncie, usuwamy je.
      </p>
      <p>
        Osoby poniżej 16 lat nie dostają powiadomień push (zgodę na nie musiałby
        wyrazić rodzic, art. 8 RODO) i inni użytkownicy nie mogą ich znaleźć po
        imieniu. Liczymy to z daty urodzenia za każdym razem, więc jedno i
        drugie zaczyna działać samo w dniu 16. urodzin. Kto jeszcze nie podał
        daty urodzenia, też nie jest wyszukiwany. Powiadomienia w aplikacji
        działają u wszystkich tak samo. Dzieci biorą udział w wydarzeniach także
        jako osoby dodane po imieniu (pkt 3).
      </p>

      <h2>11. Czego nie robimy</h2>
      <p>
        Nie mamy analityki, raportowania awarii, reklam ani śledzenia, i nigdy
        nie sprzedajemy Twoich danych. Ta strona nie zapisuje żadnych plików
        cookie.
      </p>

      <h2>12. Zmiany tej polityki</h2>
      <p>
        Gdy ta polityka się zmienia, zmienia się data ostatniej aktualizacji na
        górze. O istotnych zmianach, takich jak nowy podmiot przetwarzający albo
        nowy rodzaj danych, informujemy w aplikacji. Zmianę dotyczącą tego, co
        opiera się na zgodzie (powiadomień push), ogłaszamy, zanim zacznie
        obowiązywać. Zobacz też{' '}
        <PageLink path="/terms" lang="pl">
          Regulamin
        </PageLink>
        .
      </p>
    </>
  ),
}

const en: LegalDoc = {
  title: 'Privacy policy',
  description:
    'What data Prezentowo processes, why, who processes it for us and how long it is kept.',
  body: (
    <>
      <p>
        This policy explains what Prezentowo, the mobile app and this website,
        does with your personal data.
      </p>

      <aside className="note summary">
        <p>
          <b>In short, in plain words</b>
        </p>
        <ul>
          <li>
            You can have an account if you are 13 or older. At first sign-in we
            ask for your date of birth and keep it. Only you can see it, no one
            else.
          </li>
          <li>
            We keep your email address, name, avatar or photo, and what you add
            in events. There are no ads or tracking, and we never sell anything.
          </li>
          <li>
            Under 16? We don’t send you push notifications, and people who don’t
            know you can’t find you by name. That changes by itself on your 16th
            birthday. Someone who knows you can still add you to an event or
            send you an invite link.
          </li>
          <li>
            Under 18? Make sure a parent or guardian knows you use Prezentowo
            and is fine with it.
          </li>
          <li>
            You can delete your account yourself in the app (Profile → Delete
            account), or write to <Contact />.
          </li>
        </ul>
      </aside>

      <h2>1. Who we are</h2>
      <p>
        Prezentowo is run by Filip Jarno, who is the controller of your personal
        data. For anything about this policy or your data, write to <Contact />.
      </p>

      <h2>2. What we collect, and why</h2>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>What exactly</th>
              <th>Why, and on what basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Your account</td>
              <td>
                Your email address, your name, a stock avatar or your own photo,
                your date of birth, a copy of your name prepared for search, and
                sign-in tokens.
              </td>
              <td>
                To sign you in with an emailed link and show you to the people
                in your events. We keep the date of birth to know whether you
                can have an account (13 or older) and from which day you get
                push notifications and can be found by name (16 or older,
                section 10). It is worked out from the date every time, so it
                changes by itself on your birthday. Only you can see it, and it
                is deleted with your account. The search copy lets others find
                you by name if you are 16 or older (section 4). Contract.
              </td>
            </tr>
            <tr>
              <td>What you create</td>
              <td>
                Events (title, date, background), their participants, gifts
                (title, description, link, image), claims, chat messages and
                chat photos, and the activity and in-app notifications they
                produce.
              </td>
              <td>This is the service itself. Contract.</td>
            </tr>
            <tr>
              <td>
                Your devices, if you are 16 or older and turn on push
                notifications
              </td>
              <td>
                Push tokens from Expo and from your phone’s system, your
                platform (iOS or Android), the app’s language, and your push
                preferences.
              </td>
              <td>To send you the notifications you choose. Consent.</td>
            </tr>
            <tr>
              <td>Server and proxy logs</td>
              <td>Request metadata, such as IP address and user agent.</td>
              <td>Security and abuse prevention. Legitimate interest.</td>
            </tr>
            <tr>
              <td>On your device</td>
              <td>
                An encrypted copy of your data, so the app works without the
                internet, and the changes waiting to be sent.
              </td>
              <td>
                So the app works offline. It stays on your phone and is wiped
                when you sign out or delete your account. Contract.
              </td>
            </tr>
            <tr>
              <td>Link import</td>
              <td>
                When you add a gift from a shop link, our server fetches the
                shop’s page, so the shop sees our server’s IP address, not
                yours. We log only the shop’s domain and whether the import
                worked.
              </td>
              <td>To fill in the gift for you. Contract.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Legal bases (GDPR Art. 6(1)): most of this is needed to provide the
        service you use (performance of a contract, point b). Security and abuse
        prevention, meaning rate limits, limits on deletion requests and server
        logs, rest on our legitimate interest in protecting the service (point
        f). Only push notifications rest on your consent (point a). You give it
        through the app’s prompt and your phone’s permission, and you can
        withdraw it at any time with the Push notifications switches in the app
        or in your phone’s settings. People under 16 can’t give it on their own,
        so they get no push notifications (section 10).
      </p>

      <h2>3. People who aren’t users</h2>
      <p>
        An event’s creator can add someone to it by name, such as a child or a
        grandparent without the app, and give them a photo. The creator provides
        that data. It is visible to the event’s members and to anyone with the
        event’s invite link (section 4).
      </p>
      <p>
        It is deleted with the event, or when the creator removes that person
        from it. The photo is also deleted when the person joins the event and
        takes over their place. Anyone can ask to have their name or photo
        removed by writing to <Contact />.
      </p>

      <h2>4. Who sees what</h2>
      <ul>
        <li>
          <b>Event members</b> see the event, its participants and their gift
          lists, with two rules. On your own list you see only the gifts you
          added yourself, never the ones others suggest for you, and you never
          see who is buying your gifts. Other members see every gift on your
          list and who is buying it, so nobody buys the same thing twice.
        </li>
        <li>
          <b>Anyone with an event’s invite link</b>, even without signing in,
          sees its title and date and its participants’ names, avatars and
          photos.
        </li>
        <li>
          <b>Signed-in users can find you by name</b> if you are 16 or older,
          and see your avatar and photo, but never your email address. People
          under 16 can’t be found this way. For now there’s no way to opt out of
          search.
        </li>
        <li>
          <b>Your date of birth:</b> only you can see it. We don’t show it to
          anyone else, not in search, events, activity or chat.
        </li>
        <li>
          <b>Photo links</b> are long and random, so they can’t be guessed, but
          they aren’t protected in any other way: anyone who has a photo’s link
          can open it.
        </li>
      </ul>

      <h2>5. Who processes your data for us</h2>
      <p>
        These companies process data on our behalf (processors), only to run
        Prezentowo:
      </p>
      <ul>
        <li>
          <b>Scaleway</b> (Transactional Email) sends the sign-in emails. It
          gets your email address and the email’s content.{' '}
          <ExternalLink href="https://www.scaleway.com/en/privacy-policy/">
            Scaleway’s privacy policy
          </ExternalLink>
          .
        </li>
        <li>
          <b>Stream</b> (GetStream) runs the chat. It gets your user id, name,
          messages and chat photos and, if you turn on push notifications, your
          phone’s push token and the app’s language.{' '}
          <ExternalLink href="https://getstream.io/legal/privacy/">
            Stream’s privacy policy
          </ExternalLink>
          .
        </li>
        <li>
          <b>Expo</b> sends the app’s push notifications, other than chat. It
          gets push tokens and the notification text, which can include gift
          titles.{' '}
          <ExternalLink href="https://expo.dev/privacy">
            Expo’s privacy policy
          </ExternalLink>
          .
        </li>
        <li>
          <b>Apple</b> (Apple Push Notification service) and <b>Google</b>{' '}
          (Firebase Cloud Messaging) deliver push notifications to iPhones and
          Android phones.{' '}
          <ExternalLink href="https://www.apple.com/legal/privacy/">
            Apple’s privacy policy
          </ExternalLink>
          ,{' '}
          <ExternalLink href="https://policies.google.com/privacy">
            Google’s privacy policy
          </ExternalLink>
          .
        </li>
        <li>
          <b>Cloudflare</b> carries the traffic to this website and the app’s
          connection to our server. It sees request metadata, such as IP address
          and user agent.{' '}
          <ExternalLink href="https://www.cloudflare.com/privacypolicy/">
            Cloudflare’s privacy policy
          </ExternalLink>
          .
        </li>
      </ul>
      <p>
        Push content and device tokens go to Expo and Stream as processors. The
        server, the database and uploaded photos are self-hosted by the
        controller.
      </p>

      <h2>6. Transfers outside the EEA</h2>
      <ul>
        <li>Expo: USA.</li>
        <li>Apple: USA.</li>
        <li>Google: USA.</li>
        <li>Cloudflare: USA.</li>
      </ul>
      <p>
        Scaleway (France) and Stream (our chat runs in its EU West region) keep
        the data in the EU, so they don’t transfer it outside the EEA.
      </p>
      <p>
        Transfers to the USA rely on the EU–US Data Privacy Framework where the
        company is certified under it, and on the European Commission’s Standard
        Contractual Clauses where it isn’t.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>
          <b>Your account and what you create:</b> until you delete your account
          (section 8). Sign-in sessions don’t expire. Signing out or deleting
          your account ends them.
        </li>
        <li>
          <b>Accounts nobody signed in to:</b> typing an email address into the
          app creates an account for it right away, so the sign-in link can be
          sent. If nobody signs in with it, it is deleted after 7 days. If
          someone answers at first sign-in that they are under 13, the account
          is deleted at once.
        </li>
        <li>
          <b>Server and proxy logs:</b> 14 days.
        </li>
        <li>
          <b>Uploaded photos never added to anything:</b> 24 hours.
        </li>
        <li>
          <b>Preview images for invite links:</b> deleted with their event.
          Outdated ones are pruned.
        </li>
        <li>
          <b>Backups</b> of the database and photos rotate out within 30 days.
        </li>
      </ul>

      <h2>8. Deleting your account</h2>
      <p>
        You can delete your account in the app (Profile → Delete account) or on
        the{' '}
        <PageLink path="/delete-account" lang="en">
          Delete account
        </PageLink>{' '}
        page. Either way it happens at once and can’t be undone. What happens:
      </p>
      <ul>
        {ACCOUNT_DELETION_CONSEQUENCES.en.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>
        You can also ask for your account to be deleted by writing to{' '}
        <Contact />. We answer such requests within one month.
      </p>

      <h2>9. Your rights</h2>
      <ul>
        <li>
          <b>Rectification:</b> change your name or photo in the app.
        </li>
        <li>
          <b>Erasure:</b> section 8.
        </li>
        <li>
          <b>Access and portability:</b> write to <Contact />. Within a month
          you get your data as a JSON file, compiled by hand. There’s no export
          in the app.
        </li>
        <li>
          <b>Objection and restriction:</b> write to <Contact />.
        </li>
        <li>
          <b>Complaints:</b> to the Polish supervisory authority, the{' '}
          <ExternalLink href="https://uodo.gov.pl/">
            President of the Personal Data Protection Office (Prezes UODO)
          </ExternalLink>
          .
        </li>
      </ul>

      <h2>10. Children</h2>
      <p>
        Accounts are for people aged 13 and over. At first sign-in we ask for
        your date of birth and we store your date of birth until the account is
        deleted; only you can see it. We check nothing about it except that it
        is a real date within the last 120 years. For anyone under 13 we don’t
        make an account and keep nothing, and we delete one when we learn of it.
      </p>
      <p>
        People under 16 get no push notifications (a parent would have to give
        that consent, GDPR Art. 8), and other users can’t find them by name.
        This is worked out from the date of birth every time, so both start by
        themselves on their 16th birthday. Anyone who hasn’t given a date of
        birth yet can’t be found either. In-app notifications work the same for
        everyone. Children also take part in events as people added by name
        (section 3).
      </p>

      <h2>11. What we don’t do</h2>
      <p>
        No analytics, no crash reporting, no ads, no tracking, and we never sell
        your data. This website sets no cookies.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        When this policy changes, the “Last updated” date at the top changes.
        Material changes, such as a new processor or a new kind of data, are
        announced in the app. A change to anything based on consent (push
        notifications) is announced before it takes effect. See also the{' '}
        <PageLink path="/terms" lang="en">
          Terms of use
        </PageLink>
        .
      </p>
    </>
  ),
}

export const PRIVACY: Record<Lang, LegalDoc> = { pl, en }
