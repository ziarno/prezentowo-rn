import type { Lang } from './landing.i18n'
import { Contact, type LegalDoc, PageLink } from './landing.legalParts'

// The terms of use (docs/spec.md §3.7), drafted from the outline in "Privacy
// policy and terms: content and URLs" (#87). Polish is binding.

const pl: LegalDoc = {
  title: 'Regulamin',
  description: 'Zasady korzystania z Prezentowo.',
  body: (
    <>
      <p>
        Ten regulamin określa zasady korzystania z Prezentowo, czyli aplikacji
        mobilnej i tej strony. To, jak przetwarzamy Twoje dane, opisuje{' '}
        <PageLink path="/privacy" lang="pl">
          Polityka prywatności
        </PageLink>
        .
      </p>

      <h2>1. Usługa</h2>
      <p>
        Prezentowo to bezpłatna usługa do prowadzenia wspólnych list prezentów.
        Prowadzi ją Filip Jarno (kontakt: <Contact />
        ). Usługa jest udostępniana w takim stanie, w jakim jest, bez żadnych
        gwarancji. Nasza odpowiedzialność jest ograniczona w takim zakresie, w
        jakim pozwala na to prawo polskie.
      </p>

      <h2>2. Kto może korzystać</h2>
      <p>
        Konto mogą mieć osoby, które ukończyły 13 lat. Jeśli masz poniżej 18
        lat, upewnij się, że rodzic lub opiekun nie ma nic przeciwko Twojemu
        korzystaniu z Prezentowo. Na jeden adres e-mail przypada jedno konto.
      </p>

      <h2>3. Zasady korzystania</h2>
      <ul>
        <li>
          Nie dodawaj w prezentach, na czacie ani na zdjęciach treści
          nielegalnych ani obraźliwych.
        </li>
        <li>
          Dodawaj kogoś po imieniu albo przesyłaj jego zdjęcie tylko za jego
          zgodą albo jako jego rodzic lub opiekun.
        </li>
      </ul>

      <h2>4. Twoje treści</h2>
      <p>
        To, co dodajesz, pozostaje Twoje. Udzielasz nam licencji na
        przechowywanie tych treści i pokazywanie ich uczestnikom wydarzenia, do
        którego należą, wyłącznie po to, żeby usługa działała.
      </p>

      <h2>5. Co zostaje, gdy odchodzisz</h2>
      <p>
        Po usunięciu konta Twoje imię zostaje na listach innych osób, Twoje
        wiadomości na czacie zostają, podpisane jako „Deleted user”, a prezenty
        dodane przez Ciebie dla innych zostają. Szczegóły opisuje punkt 8{' '}
        <PageLink path="/privacy" lang="pl">
          Polityki prywatności
        </PageLink>
        .
      </p>

      <h2>6. Zakończenie korzystania</h2>
      <p>
        Możemy zawiesić albo usunąć konto używane do nadużyć. Swoje konto możesz
        usunąć w każdej chwili, w aplikacji (Profil → Usuń konto) albo na
        stronie{' '}
        <PageLink path="/delete-account" lang="pl">
          Usuń konto
        </PageLink>
        .
      </p>

      <h2>7. Zmiany regulaminu</h2>
      <p>
        Gdy regulamin się zmienia, zmienia się data ostatniej aktualizacji na
        górze. Dalsze korzystanie z Prezentowo po zmianie oznacza akceptację
        nowego regulaminu.
      </p>

      <h2>8. Prawo właściwe</h2>
      <p>
        Regulamin podlega prawu polskiemu. Jeśli jesteś konsumentem, nie odbiera
        Ci to ochrony, jaką daje Ci prawo Twojego kraju.
      </p>
    </>
  ),
}

const en: LegalDoc = {
  title: 'Terms of use',
  description: 'The rules for using Prezentowo.',
  body: (
    <>
      <p>
        These terms apply to using Prezentowo, the mobile app and this website.
        How we handle your data is in the{' '}
        <PageLink path="/privacy" lang="en">
          Privacy policy
        </PageLink>
        .
      </p>

      <h2>1. The service</h2>
      <p>
        Prezentowo is a free service for shared gift lists, run by Filip Jarno
        (contact: <Contact />
        ). It is provided as is, without any warranty. Our liability is limited
        as far as Polish law allows.
      </p>

      <h2>2. Who can use it</h2>
      <p>
        You must be 13 or older to have an account. If you are under 18, make
        sure a parent or guardian is fine with you using Prezentowo. There is
        one account per email address.
      </p>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Don’t add illegal or abusive content in gifts, chat or photos.</li>
        <li>
          Add someone by name, or upload their photo, only with their okay, or
          as their parent or guardian.
        </li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        What you add stays yours. You give us a licence to store it and show it
        to the members of the event it belongs to, only to run the service.
      </p>

      <h2>5. What stays when you leave</h2>
      <p>
        After you delete your account, your name stays on other people’s lists,
        your chat messages stay, shown as “Deleted user”, and gifts you added
        for others stay. Section 8 of the{' '}
        <PageLink path="/privacy" lang="en">
          Privacy policy
        </PageLink>{' '}
        has the details.
      </p>

      <h2>6. Ending your use</h2>
      <p>
        We may suspend or delete an account used for abuse. You may delete yours
        at any time, in the app (Profile → Delete account) or on the{' '}
        <PageLink path="/delete-account" lang="en">
          Delete account
        </PageLink>{' '}
        page.
      </p>

      <h2>7. Changes to these terms</h2>
      <p>
        When these terms change, the “Last updated” date at the top changes.
        Continuing to use Prezentowo after that means you accept the new terms.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These terms are governed by Polish law. If you are a consumer, this
        doesn’t take away the protection the law of your own country gives you.
      </p>
    </>
  ),
}

export const TERMS: Record<Lang, LegalDoc> = { pl, en }
