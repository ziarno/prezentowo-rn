# Store account-deletion requirements (Apple App Store, Google Play, GDPR)

Resolves [#79](https://github.com/ziarno/prezentowo-rn/issues/79) (map [#78](https://github.com/ziarno/prezentowo-rn/issues/78)). Researched 2026-10-06. Research only: nothing here is a decision, and no app code is touched.

**Question.** What do Apple (App Review Guideline 5.1.1(v)) and Google Play (User Data policy, Data safety form) require of an app that lets users create accounts? Must deletion start in-app, is a web deletion URL required, may we require re-authentication, may we send users to email or support, what may be kept afterwards and for how long, how must it be disclosed, and what must the privacy policy say.

**Applies to us because:** Prezentowo creates accounts in-app (magic-link email sign-in, no third-party login), so both policies apply in full. We have no subscriptions or in-app purchases, and no Sign in with Apple, so those sub-requirements do not apply.

**Method note.** Pages were read through a fetch tool that summarises with a small model, so wording below is mostly paraphrase with short quotes. Before a policy page is cited in the privacy policy or in a store submission, re-read it in a browser. The Play Console help pages are updated over time.

## Sources

Primary, first-party:

- Apple, App Review Guidelines, 5.1.1 and 5.1.2: https://developer.apple.com/app-store/review/guidelines/
- Apple, "Offering account deletion in your app": https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play, User Data policy (Account Deletion Requirements and Privacy Policy sections): https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play, "Understanding Google Play's app account deletion requirements": https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, "Provide information for Google Play's Data safety section": https://support.google.com/googleplay/android-developer/answer/10787469
- GDPR, Regulation (EU) 2016/679, official text: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679 (the Article 12 and 13 wording below was read from the article-per-page transcription at gdpr-info.eu, because the EUR-Lex fetch truncated; confirm against EUR-Lex).

## Apple

### Rule (Guideline 5.1.1(v))

If the app supports account creation, it must also offer account deletion within the app. Source: Guidelines 5.1.1(v).

### Clarifications (Apple's "Offering account deletion in your app" page)

| Point | Requirement |
|---|---|
| In-app initiation | Required. Account deletion must be easy to find, typically in account settings. |
| Scope | Delete the entire account record and associated personal data. Offering only temporary deactivation or disabling is not enough. Includes user-generated content shared with others (Apple lists photos, videos, text posts, reviews). |
| Web link | Only if the person must visit a website to finish deleting: link directly to the page where they can complete it, not to a general home or support page. Sending the user to the browser for account creation still requires in-app deletion. |
| Re-authentication and confirmation | Allowed. Apple says it is appropriate to confirm the user really intends to delete, and you may add identity-verification and confirmation steps, e.g. entering a code from an email or phone number already on the account. Apps that make deletion unnecessarily difficult will not pass review. |
| Email, phone, chat, support flows | Not allowed for apps outside highly regulated industries (5.1.1(ix)). Such apps "should not require people to make a phone call, send an email, use a chat support flow, or go through other support flows". Prezentowo is not regulated, so deletion cannot be "email us". |
| Speed | Deletion need not be instant. A manual or slow process is acceptable if you tell the person how long it takes and confirm when it is done. Follow local law on timing. |
| Retention | If you are legally required to keep some user information, tell people what will and will not be retained. Follow applicable local law on retention and deletion. |
| Everyone, everywhere | Deletion must be available to everyone regardless of location. A flow built for GDPR or CCPA may be offered to all, if it meets 5.1.1(v). |
| Guest and auto-generated accounts | Must also be deletable. |
| Sign in with Apple | If used: revoke the user's tokens via the Sign in with Apple REST API. Not applicable to us. |
| Auto-renewable subscriptions | Must warn that billing continues via Apple and ask the user to cancel first; a deletion scheduled for the subscription's end is allowed if immediate deletion is also offered. Not applicable to us (no IAP). |

### Privacy policy (Guideline 5.1.1(i))

- The policy URL must be in the App Store Connect metadata and in the app, easily accessible.
- It must identify what data is collected, how, and every use of it.
- It must confirm that third parties with access to user data (analytics, SDKs, related entities) give the same or equal protection.
- It must explain data retention and deletion policies and describe how a user can revoke consent and/or request deletion of their data.

Other related Apple rules: 5.1.1(ii) requires consent for collection and an easy way to withdraw it; 5.1.1(iii) requires data minimisation.

## Google Play

### Rule (User Data policy, Account Deletion Requirements)

If the app lets users create an account from within the app, it must also allow users to request deletion of that account. Users must have a readily discoverable option to initiate deletion from within the app and outside the app (the policy's example: visiting a website). When an account is deleted at the user's request, the data associated with it must also be deleted. Temporary deactivation, disabling or "freezing" does not count as deletion. Source: answer/10144311.

### Details (answer/13327111)

| Point | Requirement |
|---|---|
| In-app path | Required: an intuitive, prominent path (e.g. account settings or similar) to delete the account and associated data. |
| Web link | Required: a web link resource where users can request deletion of the account and associated data. This URL is entered in Play Console (App content, Data safety form, "Data deletion" questions). |
| What the web page must be | Functional (loads without error). Relevant in scope: the way to request deletion is prominently featured and easily discoverable on the page. References the app name or developer name as shown on the Play listing. |
| How the web page may take the request | Many ways are acceptable: an additional link that starts deletion, a customer service email, or a submittable form. Unlike Apple's in-app rule, Play explicitly accepts an email or form on the web page. |
| No app needed | Users may have uninstalled the app or be unable to get into it, so the web resource should let them request deletion without sending them back to the app or requiring a re-download. |
| Re-authentication and confirmation | Play's pages do not address re-authentication directly. Because the web path must work for users who cannot open the app, some identity check on that path (such as a code sent to the account's email) is consistent with the policy and is how a form or email request would normally be verified. Treat this as inference, not stated policy. |
| Timing | "You should let users know what to expect and complete their requests within a reasonably quick period of time." No fixed number of days. |
| Retention | You may keep data for legitimate reasons such as security, fraud prevention or regulatory compliance, but you must clearly inform users about the retention practices. |
| Offering partial deletion | Developers can offer deleting some data without deleting the account, and tell users when other data is deleted too. Optional. |
| Exempt | Permanently private apps and enterprise device-management apps. Not us. |
| Enforcement | Apps that do not comply risk enforcement, up to removal from Play (the page's dates, Dec 2023 / May 2024, are long past). |

### Data safety form (answer/10787469)

- The form asks whether the app provides a way for users to request deletion of their data. The deletion badge may be claimed if the app provides a mechanism to request deletion, or automatically deletes or anonymises collected data within 90 days of collection.
- The mechanism is not prescribed, but must be easily discoverable and accessible; examples given include in-app features, contact forms and a dedicated email alias.
- The badge may be claimed even when some data is retained for legal compliance or abuse prevention.
- The developer is solely responsible for complete and accurate declarations, which must remain accurate at all times; Google may take enforcement action on discrepancies between behaviour and declarations.
- A privacy policy link is required to complete the Data safety form.

### Privacy policy (User Data policy)

Must be posted in Play Console and in the app. It must contain:

- developer information and a privacy point of contact or a way to submit inquiries;
- the types of personal and sensitive data accessed, collected, used and shared, and the parties data is shared with;
- secure data-handling procedures;
- the developer's data retention and deletion policy;
- a clear label as a privacy policy.

The entity named on the listing must appear in the policy (or the app must be named in it). The URL must be active, publicly accessible, non-geofenced, not a PDF, and non-editable.

## GDPR points that bear on this (Regulation (EU) 2016/679)

- Art. 17(1): the data subject may obtain erasure of personal data "without undue delay" (on listed grounds). Art. 17(3) exceptions include compliance with a legal obligation and establishment, exercise or defence of legal claims.
- Art. 12(3): the controller must act on the request "without undue delay and in any event within one month of receipt". The same paragraph allows extension by two further months for complex or numerous requests (not re-read in this pass).
- Art. 12(6): if the controller has reasonable doubts about the identity of the requester, it may request additional information needed to confirm identity. This supports an email-code or similar check, and it is the only basis in the sources read for a confirmation step on the web or email path.
- Art. 12(5): handling is free of charge, except manifestly unfounded or excessive requests.
- Art. 13(2)(a) and (b): the privacy notice must state the storage period (or the criteria used to determine it) and the existence of the right to request erasure.
- Art. 5(1)(e): storage limitation, i.e. keep identifiable data no longer than necessary.

GDPR sets the outer time bound (one month by default). The stores do not set a number; Apple only needs the stated timeline and a completion confirmation.

## Answers to the ticket's questions

1. **Must deletion be initiable in-app?** Yes, on both stores. Apple: in the app, easy to find. Play: a prominent in-app path.
2. **Web deletion URL?** Play: yes, always, entered in Play Console. Apple: only required if the user must leave the app to finish, in which case it must deep-link to the deletion page. Because Play needs one anyway, one web page serves both stores.
3. **What must the Play web page do?** Work without app install or sign-in to the app; name the app or developer as on the listing; make requesting deletion prominent. The request itself may be a link, a form or a support email address.
4. **May we require re-authentication or confirmation?** Apple: yes, as long as it is not unnecessarily difficult; its own example is a code from an email or phone already on the account. For us the magic-link email is the natural fit. Play: not addressed; identity checks are permissible under GDPR Art. 12(6).
5. **May the app send users to email or support instead?** Apple: no, not for non-regulated apps. Play: for the web resource, yes (email or form); for the in-app path, an in-app option is required, so use the same in-app flow for both.
6. **What may be retained, and how long?** Both: only for legitimate reasons (legal, security, fraud, abuse). Apple additionally requires telling the user what is and is not retained. Neither store gives a retention period. GDPR gives one month to act (extendable) and requires the privacy policy to state storage periods or criteria. Neither store's pages address backups; that question is outside the sources read and needs a decision of ours.
7. **How must it be disclosed?** Play: the Data safety form (deletion badge and web URL) plus the retention practices stated to users. Apple: the retention information shown to users, and the privacy policy's retention and deletion section; the policy URL goes in App Store Connect metadata and in the app.
8. **What must the privacy policy say?** Apple and Play together require: what data is collected, how and what for; who it is shared with (and that they protect it equally); retention and deletion policy; how to revoke consent and request deletion; developer or entity name and a privacy contact. It must be publicly reachable at a stable, non-PDF URL, titled as a privacy policy, linked in-app and in both store consoles.
9. **EU/GDPR.** Erasure on request (Art. 17); one-month response (Art. 12(3)); identity checks allowed (Art. 12(6)); privacy notice must state retention and the erasure right (Art. 13(2)). Apple's "everyone, everywhere" rule means one flow, not an EU-only one.

## Implications to carry into the account-deletion grilling

These are open design points surfaced by the research, not decisions.

- **Two entry points, one backend operation.** An in-app "Delete account" (Apple and Play) and a public web page (Play, and Apple if the in-app flow ever hands off to the web). The web page is on the landing site `prezentowo.jarno.pl`; check against ADR 0005 (web is an invite landing page) since this adds a second job for it.
- **Confirmation fits magic link.** Re-auth by emailing a code or link to the account address is explicitly the kind of step Apple allows; the web page can use the same step, which also satisfies GDPR Art. 12(6).
- **No "email us" in the app**, and the web request must not require the app. If the web page offers only a mailto, it is Play-acceptable but a fully self-service web flow keeps both stores simple.
- **Shared content.** Apple says deleting an account includes user-generated content shared with others. What happens to the user's events, wishlists, claims on others' gifts, participant placeholders, uploaded photos, and pending offline-queue writes needs defining, along with what, if anything, is retained and why. Anything retained must be shown to the user.
- **Timing.** Instant deletion avoids needing a stated timeline and a completion notice; if deletion is delayed (grace period, backups), state the duration and send a completion confirmation. A grace period must not replace real deletion (Apple and Play both reject deactivation-only).
- **Privacy policy content** (feeds #78's "Privacy policy and terms" fog): data collected (email, name, photo, avatar, wishlists, events, claims, push tokens if push lands), third parties (mail provider, hosting), retention and deletion policy with periods, how to request deletion in-app and on the web, contact, and the controller's name as on both store listings.
- **Store forms.** Play Data safety: deletion questions answered with the web URL; Apple: privacy policy URL in App Store Connect plus the App Privacy answers. The answers must match what the deletion actually does.
