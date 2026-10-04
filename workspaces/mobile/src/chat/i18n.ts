import plLocale from 'dayjs/locale/pl'
import { Streami18n } from 'stream-chat-expo'

import i18n from '@/localization/i18n'

// Stream's UI strings, in the app's language. The SDK ships no Polish, so its
// keys (the English strings in stream-chat-react-native-core/src/i18n/en.json)
// get the ones a text-only chat shows; any other falls back to English.
const pl = {
  // Composer
  'Send a message': 'Napisz wiadomość',
  "You can't send messages in this channel": 'Nie możesz pisać na tym czacie',
  'Editing Message': 'Edycja wiadomości',
  'Reply to Message': 'Odpowiedź na wiadomość',
  'Reply to {{name}}': 'Odpowiedź dla: {{name}}',
  'Also send to channel': 'Wyślij też na czat',
  'Sending links is not allowed in this conversation':
    'Na tym czacie nie można wysyłać linków',
  'Slow mode ON': 'Tryb powolny włączony',
  'Slow mode, wait {{seconds}}s...': 'Tryb powolny, poczekaj {{seconds}} s...',
  'Emoji matching': 'Pasujące emoji',
  'Instant Commands': 'Polecenia',
  'Command not available': 'Polecenie niedostępne',
  'Command not available while editing': 'Polecenie niedostępne podczas edycji',
  'Command not available while replying':
    'Polecenie niedostępne podczas odpowiadania',
  'Notify all {{ role }} members': 'Powiadom wszystkich: {{ role }}',
  'mention/Channel Description': 'Powiadom wszystkich na tym czacie',
  'mention/Here Description': 'Powiadom wszystkich, którzy są teraz online',

  // Message list
  'No chats here yet…': 'Nie ma tu jeszcze wiadomości…',
  "Let's start chatting!": 'Zacznijcie rozmowę!',
  'Nothing yet...': 'Jeszcze nic...',
  'No messages yet': 'Brak wiadomości',
  'Loading...': 'Ładowanie...',
  'Loading messages...': 'Ładowanie wiadomości...',
  'Error loading': 'Błąd ładowania',
  'Error loading messages for this channel...':
    'Nie udało się wczytać wiadomości...',
  'Error while loading, please reload/refresh':
    'Błąd ładowania, odśwież i spróbuj ponownie',
  'Unread Messages': 'Nieprzeczytane wiadomości',
  '{{count}} new messages': 'Nowe wiadomości: {{count}}',
  '{{count}} unread': 'Nieprzeczytane: {{count}}',
  'Failed to jump to the first unread message':
    'Nie udało się przejść do pierwszej nieprzeczytanej wiadomości',
  'Reconnecting...': 'Ponowne łączenie...',
  'Network error': 'Błąd sieci',
  Offline: 'Offline',
  Online: 'Online',

  // Messages
  You: 'Ty',
  Edited: 'Edytowano',
  'Message deleted': 'Wiadomość usunięta',
  'Empty message...': 'Pusta wiadomość...',
  'Only visible to you': 'Widoczne tylko dla ciebie',
  'Message failed to send': 'Nie udało się wysłać wiadomości',
  'Send message request failed': 'Nie udało się wysłać wiadomości',
  'Edit message request failed': 'Nie udało się zapisać zmian',
  'Unknown User': 'Nieznany użytkownik',
  'Pinned by': 'Przypięte przez',
  'replied to': 'odpowiada na',
  'The source message was deleted': 'Oryginalna wiadomość została usunięta',
  'This reply was deleted': 'Ta odpowiedź została usunięta',
  'Also sent in channel': 'Wysłane też na czat',
  'Replied to a thread': 'Odpowiedź w wątku',
  'Thread Reply': 'Odpowiedź w wątku',
  '1 Reply': '1 odpowiedź',
  '1 Thread Reply': '1 odpowiedź w wątku',
  '{{ replyCount }} Replies': 'Odpowiedzi: {{ replyCount }}',
  'Links are disabled': 'Linki są wyłączone',
  'Unsupported Attachment': 'Nieobsługiwany załącznik',
  '🏙 Attachment...': '🏙 Załącznik...',
  Draft: 'Wersja robocza',

  // Typing indicator
  Typing: 'Pisze',
  '{{ user }} is typing': '{{ user }} pisze',
  '{{ firstUser }} and {{ secondUser }} are typing':
    '{{ firstUser }} i {{ secondUser }} piszą',
  '{{ firstUser }} and {{ nonSelfUserLength }} more are typing':
    '{{ firstUser }} i inni ({{ nonSelfUserLength }}) piszą',
  '{{ numberOfUsers }} people are typing': 'Osoby piszące: {{ numberOfUsers }}',

  // Message menu
  Reply: 'Odpowiedz',
  'Copy Message': 'Kopiuj',
  'Edit Message': 'Edytuj',
  'Delete Message': 'Usuń',
  'Delete for me': 'Usuń u mnie',
  Resend: 'Wyślij ponownie',
  'Mark as Unread': 'Oznacz jako nieprzeczytane',
  'Pin to Conversation': 'Przypnij',
  'Unpin from Conversation': 'Odepnij',
  'Flag Message': 'Zgłoś',
  'Mute User': 'Wycisz użytkownika',
  'Unmute User': 'Wyłącz wyciszenie',
  'Block User': 'Zablokuj użytkownika',
  'Unblock User': 'Odblokuj użytkownika',
  'Message Reactions': 'Reakcje',
  'Tap to remove': 'Stuknij, aby usunąć',
  '{{count}} Reactions_one': '{{count}} reakcja',
  '{{count}} Reactions_few': '{{count}} reakcje',
  '{{count}} Reactions_many': '{{count}} reakcji',
  '{{count}} Reactions_other': '{{count}} reakcji',

  // Confirmations and notices
  Cancel: 'Anuluj',
  Delete: 'Usuń',
  Ok: 'OK',
  Flag: 'Zgłoś',
  'Are you sure?': 'Na pewno?',
  'Are you sure you want to permanently delete this message?':
    'Na pewno usunąć tę wiadomość na zawsze?',
  'Do you want to send a copy of this message to a moderator for further investigation?':
    'Wysłać kopię tej wiadomości do moderatora?',
  'Cannot Flag Message': 'Nie można zgłosić wiadomości',
  'Flag action failed either due to a network issue or the message is already flagged':
    'Nie udało się zgłosić: błąd sieci albo wiadomość jest już zgłoszona.',
  'The message has been reported to a moderator.':
    'Wiadomość została zgłoszona moderatorowi.',
  'Message has been successfully flagged': 'Wiadomość została zgłoszona',
  'Message flagged': 'Wiadomość zgłoszona',
  'Message copied to clipboard': 'Skopiowano wiadomość',
  'Failed to copy message': 'Nie udało się skopiować wiadomości',
  'Message marked as unread': 'Oznaczono jako nieprzeczytane',
  'Message pinned': 'Wiadomość przypięta',
  'Message unpinned': 'Wiadomość odpięta',
  'Error deleting message': 'Nie udało się usunąć wiadomości',
  'Error pinning message': 'Nie udało się przypiąć wiadomości',
  'Error removing message pin': 'Nie udało się odpiąć wiadomości',
  'Error adding flag': 'Nie udało się zgłosić wiadomości',
  'Error fetching reactions': 'Nie udało się wczytać reakcji',
  'Error marking message unread. Cannot mark unread messages older than the newest 100 channel messages.':
    'Nie można oznaczyć jako nieprzeczytanej wiadomości starszej niż 100 najnowszych.',
  'Error muting a user ...': 'Nie udało się wyciszyć użytkownika...',
  'Error unmuting a user ...': 'Nie udało się wyłączyć wyciszenia...',
  '{{ user }} has been muted': '{{ user }}: wyciszono',
  '{{ user }} has been unmuted': '{{ user }}: wyłączono wyciszenie',
  'User blocked': 'Użytkownik zablokowany',
  'User unblocked': 'Użytkownik odblokowany',
  'Failed to block user': 'Nie udało się zablokować użytkownika',

  // Screen reader labels
  'a11y/Send message': 'Wyślij wiadomość',
  'a11y/Connected': 'Połączono',
  'a11y/Reconnecting': 'Ponowne łączenie',
  'a11y/Offline': 'Offline',
  'a11y/Loading': 'Ładowanie',
  'a11y/Loading failed': 'Błąd ładowania',
  'a11y/Sending': 'Wysyłanie',
  'a11y/Sent': 'Wysłano',
  'a11y/Sent by you': 'Wysłane przez ciebie',
  'a11y/Delivered': 'Dostarczono',
  'a11y/Delivered, sent by you': 'Dostarczono, wysłane przez ciebie',
  'a11y/Read': 'Przeczytano',
  'a11y/Read, sent by you': 'Przeczytano, wysłane przez ciebie',
  'a11y/Message from you': 'Twoja wiadomość',
  'a11y/Message from {{sender}}': 'Wiadomość od: {{sender}}',
  'a11y/New message from {{user}}': 'Nowa wiadomość od: {{user}}',
  'a11y/Avatar of {{name}}': 'Awatar: {{name}}',
  'a11y/Message actions': 'Akcje wiadomości',
  'a11y/Open message actions': 'Otwórz akcje wiadomości',
  'a11y/Double tap and hold to activate contextual menu':
    'Stuknij dwukrotnie i przytrzymaj, aby otworzyć menu',
  'a11y/Editing message': 'Edycja wiadomości',
  'a11y/Editing message: {{text}}': 'Edycja wiadomości: {{text}}',
  'a11y/Save edited message': 'Zapisz zmiany',
  'a11y/Remove edit': 'Anuluj edycję',
  'a11y/Reply to {{user}}': 'Odpowiedz: {{user}}',
  'a11y/Replying to {{user}}': 'Odpowiedź dla: {{user}}',
  'a11y/Replying to {{user}}: {{text}}': 'Odpowiedź dla: {{user}}: {{text}}',
  'a11y/Remove reply': 'Anuluj odpowiedź',
  'a11y/Scroll to bottom': 'Przewiń na dół',
  'a11y/Scroll to bottom, {{count}} new messages':
    'Przewiń na dół, nowe wiadomości: {{count}}',
  'a11y/Scroll to latest': 'Przewiń do najnowszych',
  'a11y/Scroll to latest, {{count}} unread':
    'Przewiń do najnowszych, nieprzeczytane: {{count}}',
  'a11y/{{count}} new messages': 'Nowe wiadomości: {{count}}',
  'a11y/{{count}} unread messages': 'Nieprzeczytane wiadomości: {{count}}',
  'a11y/Dismiss unread messages': 'Ukryj nieprzeczytane',
  'a11y/Double tap to view reactions':
    'Stuknij dwukrotnie, aby zobaczyć reakcje',
  'a11y/Reaction {{emoji}} by {{count}} users':
    'Reakcja {{emoji}}, osoby: {{count}}',
  'a11y/and {{count}} more reactions': 'i więcej reakcji: {{count}}',
  'a11y/you reacted': 'twoja reakcja',
  'a11y/Open more reactions': 'Więcej reakcji',
  'a11y/Pinned': 'Przypięta',
  'a11y/Close': 'Zamknij',
  'a11y/Back': 'Wstecz',
  'a11y/Notifications': 'Powiadomienia',
  'a11y/Dismiss notification': 'Zamknij powiadomienie',
  'a11y/Hide Overlay': 'Zamknij',
  'a11y/Bottom sheet opened. Activate the close action or use the escape gesture to dismiss.':
    'Otwarto panel. Zamknij go przyciskiem lub gestem powrotu.',
  'a11y/Mention suggestions available': 'Dostępne podpowiedzi wzmianek',
  'a11y/Emoji suggestions available': 'Dostępne podpowiedzi emoji',
  'a11y/Command suggestions available': 'Dostępne podpowiedzi poleceń',
  'a11y/Open commands': 'Otwórz polecenia',
}

// Date separators ("Today", "Yesterday", weekdays). The SDK keeps its own
// copy of dayjs, so the locale goes in through Stream rather than an import.
const plDayjs = {
  ...plLocale,
  calendar: {
    sameDay: '[Dzisiaj]',
    lastDay: '[Wczoraj]',
    nextDay: '[Jutro]',
    lastWeek: 'dddd',
    nextWeek: 'dddd [o] LT',
    sameElse: 'L',
  },
}

// One instance for the app, so its translators survive every chat screen.
// English fallback, not the raw key: some keys are templates (`timestamp/…`).
export const chatI18n = new Streami18n(
  { language: 'en' },
  { fallbackLng: 'en' },
)
chatI18n.registerTranslation('pl', pl, plDayjs)
void chatI18n.setLanguage(i18n.language)
i18n.on('languageChanged', language => void chatI18n.setLanguage(language))
