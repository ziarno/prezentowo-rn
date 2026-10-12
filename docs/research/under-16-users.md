# Users under 16: legal and store-policy consequences

Research note, 2026-10-12. Research only: nothing here is a decision, and no app code, policy text or terms text is touched. Not legal advice; the last section lists where a lawyer is worth paying.

**Question.** The owner wants to allow users under 16 (maybe 13+, maybe no minimum) because the app is harmless to children. What does that change legally and in the App Store / Google Play, and what is the minimum set of changes (policy text, terms text, store questionnaires, app behaviour)?

## Summary

1. GDPR Art. 8 (age 16 in Poland) only bites on processing based on **consent**. Prezentowo's only consent-based processing is push, so for everything else lowering the age does not trigger a parental-consent duty; push for under-16s is the one real GDPR knock-on.
2. The bigger legal friction is **contract law**: under the Polish Civil Code a 13-17-year-old has limited capacity, and under 13 none. A free app's terms are not clearly an "everyday contract", but the practical risk falls on us (we cannot enforce), not on the child.
3. **13 is a hard practical floor.** Below it: no capacity to contract (KC art. 12), COPPA "actual knowledge" risk in US stores, and Google Play treats the app as child-directed. At 13 and above none of those bite as hard.
4. **Stores:** Apple needs the age-rating override to match whatever minimum age the terms state, plus the 1.2 UGC controls (report, block, filter, contact) that chat already requires; Google needs the target-audience declaration changed, and "13-15" is flagged as possibly including children, which brings Families Policy duties (neutral age screen, social-feature rules).
5. **App behaviour that matters more than any text:** people search lets any signed-in adult find any named user by name prefix with no opt-out (spec §2.2), and an invite pushes to the found user. That is the weakest point if minors are allowed.

## Recommendation

Option (b-plus): **lower the minimum to 13, do not build a parental-consent flow**, and make these changes (detail in section 8):

- First-login neutral age screen (birth year or "13-15 / 16+"; store only the band, not a birth date). Under 13: no account, nothing stored.
- Under-16 band: **no push** (the only consent-based processing), no push pre-prompt. A parent-authorised push path can be added later.
- Under-16 band: excluded from `users.search` (and so from being invited by strangers). This is a small server change, and it is the single most useful child-safety measure.
- Terms: age 13+, and "if you are under 18, make sure a parent or guardian is fine with you using the app" (sets expectations; it does not claim to verify consent).
- Privacy policy: 13+; plain-language "for young users" summary at the top (Art. 12(1)); push consent for under-16 explained.
- Stores: Apple age-rating override to 13+ (and answer the social-media question No); Google target audience 13-15, 16-17, 18+ with a neutral age screen already in the app. Confirm chat has working report and block (both stores require it).
- Do **not** pick "no minimum" or "for kids" positioning: it pulls in COPPA verifiable parental consent, Google Families as a child-directed app, and a full parental-consent system, which is disproportionate for a free gift list.

## Method note

Primary sources were read through fetch tools that summarise with a small model, plus direct text extraction where the source allowed:

- EUR-Lex pages return a bot challenge to scripted clients, so the GDPR and DSA text was fetched from the Publications Office (EU official publisher of EUR-Lex): `https://publications.europa.eu/resource/celex/32016R0679` and `.../32022R2065` with `Accept: application/xhtml+xml`. That is the same official text as `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679`.
- ISAP is behind a bot wall; Polish statutes were read through the Sejm's own ELI API (`https://api.sejm.gov.pl/eli/acts/...`), same acts as isap.sejm.gov.pl.
- EDPB and UODO PDFs were text-extracted locally. Quotes below from those are verbatim; quotes from store pages are short and come via the summarising fetch tool, so re-read them in a browser before citing in a store submission.
- Anything not confirmed at a primary source is marked **UNVERIFIED**.

## What the app does today (relevant facts)

From `workspaces/backend/imports/landing/landing.privacy.tsx` (§2, §3, §10), `landing.terms.tsx` (§2, §3) and `docs/spec.md`:

- Privacy §10 and Terms §2: accounts for 16+; "we don't knowingly hold an account of anyone under 16, and we delete one when we learn of it". There is **no age gate**; sign-in is an emailed link.
- Legal bases (privacy §2): contract (Art. 6(1)(b)), legitimate interest for security (6(1)(f)), **consent only for push** (6(1)(a)).
- Children appear only as by-name placeholders added by an adult (privacy §3); the creator supplies the data.
- Spec §3.7: "16+" is one of the facts fixed by issue #87, so changing it means editing the spec and that issue's outline too.
- Spec §2.2: `users.search` returns any user with a name, from a 3-character prefix, to any signed-in user; "no opt-out in v1" (opting out is out of scope, §8). Spec §1.2/§2.2: a found user can be added as `invited`; they become a member only by accepting (`events.join`), but they get an `invited` notification and push.
- Spec §1.10/§1.3: a profile photo or stock avatar is visible to anyone holding an invite code (signed out).
- Chat is GetStream (`event_thread`, `secret_thread`); users cannot create channels. `workspaces/mobile/src/chat/i18n.ts` contains Polish strings for Stream's "Flag Message" and "Block User" actions, but whether those actions are actually enabled in the UI and routed to anyone was **not checked** here (UNVERIFIED).

## 1. GDPR Art. 8 and Poland's age of digital consent

**Text of Art. 8** (verbatim, EUR-Lex via Publications Office, Regulation (EU) 2016/679):

- Art. 8(1): "Where point (a) of Article 6(1) applies, in relation to the offer of information society services directly to a child, the processing of the personal data of a child shall be lawful where the child is at least 16 years old. Where the child is below the age of 16 years, such processing shall be lawful only if and to the extent that consent is given or authorised by the holder of parental responsibility over the child. Member States may provide by law for a lower age for those purposes provided that such lower age is not below 13 years."
- Art. 8(2): "The controller shall make reasonable efforts to verify in such cases that consent is given or authorised by the holder of parental responsibility over the child, taking into consideration available technology."
- Art. 8(3): "Paragraph 1 shall not affect the general contract law of Member States such as the rules on the validity, formation or effect of a contract in relation to a child."

**Poland's age is 16.** Poland did not use the Art. 8(1) derogation:

- The Polish implementing act, ustawa z 10 maja 2018 r. o ochronie danych osobowych (Dz.U. 2018 poz. 1000), contains no provision on a child's consent or on information society services. I searched its full announced text (`https://api.sejm.gov.pl/eli/acts/DU/2018/1000/text.html`) for "16 lat", "13 lat", "dziec", "wiek", "społeczeństwa informacyjnego": no relevant hit. The other act that adapted sectoral laws to the GDPR, Dz.U. 2019 poz. 730 (`.../DU/2019/730/text.html`), also has no hit for Art. 8, "usług społeczeństwa informacyjnego" or an age-of-consent phrase. The act's later amendments (Dz.U. 2026 poz. 252, 548, 1003) are by title about cybersecurity, data governance and AI; I did not read them. So no Polish statute found that lowers the age. A negative result; a lawyer can confirm no other act does.
- UODO's own training material states the default: "Zgodnie z art. 8 RODO dziecko, które ukończyło 16 lat, może samodzielnie wyrazić zgodę na przetwarzanie swoich danych, korzystając tzw. usług społeczeństwa informacyjnego." (`https://www.uodo.gov.pl/pl/file/3502`, slide 3).
- The European Commission's data-protection page for individuals states the threshold is set per Member State between 13 and 16 (seen in a search result for `https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en`; not read in full, UNVERIFIED as a direct read).

**Does Art. 8 apply given our legal bases? Only to the push consent.** The EDPB says "Article 8 shall only apply when" two conditions are met: the processing relates to the offer of information society services directly to a child, **and "The processing is based on consent."** (EDPB Guidelines 05/2020 on consent v1.1, section 7.1, p. 26: `https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf`). Account, gifts, claims, chat, security logs rest on contract and legitimate interest, so Art. 8 does not govern them. Push is consent (Art. 6(1)(a)), so for a user under 16 the push consent would need to be "given or authorised by the holder of parental responsibility", with reasonable verification (Art. 8(2)). Consequence: either no push for under-16s, or a parent-authorisation step. Note the OS permission prompt is not a substitute: the policy already treats the in-app prompt plus OS permission as our consent.

Two caveats on scope:

- "Information society service" is defined by reference to Directive 2015/1535 as a service "normally provided for remuneration" (quoted in the EDPB consent guidelines, footnote 62). A free app with no ads is arguably not normally provided for remuneration. I found no primary source settling that for a free, ad-free app (the EDPB guidelines cite CJEU C-108/09 Ker-Optika only for online services generally). **UNVERIFIED**; do not rely on it to skip Art. 8.
- Art. 8 and national contract law are separate regimes (Art. 8(3); EDPB consent guidelines p. 29: "Both legal regimes may apply simultaneously"). See section 2.

**"Offered directly to a child".** EDPB (section 7.1.2, p. 27): the wording "indicates that Article 8 is intended to apply to some, not all information society services"; a provider who "makes it clear to potential users that it is only offering its service to persons aged 18 or over, and this is not undermined by other evidence (such as the content of the site or marketing plans)" is not offering directly to a child. A 16+ rule does not take the service out of Art. 8 (16-17-year-olds are children), but in Poland a 16-year-old consents alone, so today it never triggers. Lowering to 13 does put 13-15-year-olds squarely in scope. I found no UODO document defining "offered directly to a child" beyond the EDPB's; UODO republishes the EDPB and WP29 material (e.g. `https://uodo.gov.pl/pl/file/5912`, the Polish version of Statement 1/2025).

**Reasonable verification efforts.** EDPB (section 7.1.3, pp. 27-28):

- "Controllers will be expected to make reasonable efforts to verify that the user is over the age of digital consent, and these measures should be proportionate to the nature and risks of the processing activities."
- "If the user states that he/she is below the age of digital consent then the controller can accept this statement without further checks, but will need to go on to obtain parental authorisation and verify that the person providing that consent is a holder of parental responsibility."
- "In some low-risk situations, it may be appropriate to require a new subscriber to a service to disclose their year of birth or to fill out a form stating they are (not) a minor." "Age verification should not lead to excessive data processing."
- For parental authorisation (section 7.1.4): "In low-risk cases, verification of parental responsibility via email may be sufficient." Example 23 (p. 28): ask whether under or over 16, collect a parent's email, email the parent, take reasonable steps to confirm responsibility.

EDPB Statement 1/2025 on age assurance (adopted 11 February 2025; `https://www.edpb.europa.eu/system/files/2025-04/edpb_statement_20250211ageassurance_v1-2_en.pdf`) adds: age assurance must be risk-based and proportionate, and "should not provide additional means for service providers to identify, locate, profile or track". It lists self-declaration as one of three categories (estimation, verification, self-declaration). For a low-risk, no-ads, no-tracking app a self-declared age band is the proportionate end of this; it does not support asking for ID.

## 2. Capacity to contract (Kodeks cywilny) and the terms

Read in the consolidated Kodeks cywilny announced 27 May 2026 (Dz.U. 2026 poz. 795, status in force; `https://api.sejm.gov.pl/eli/acts/DU/2026/795/text.pdf`):

| Art. | Text (Polish, quoted) | Effect |
|---|---|---|
| 10 § 1 | "Pełnoletnim jest, kto ukończył lat osiemnaście." | Adult at 18. |
| 12 | "Nie mają zdolności do czynności prawnych osoby, które nie ukończyły lat trzynastu…" | Under 13: no capacity. |
| 14 § 1-2 | A legal act by an incapacitated person "jest nieważna". But a contract "należąca do umów powszechnie zawieranych w drobnych bieżących sprawach życia codziennego" "staje się ważna z chwilą jej wykonania, chyba że pociąga za sobą rażące pokrzywdzenie". | Under-13 contract void unless a typical everyday contract, then valid on performance. |
| 15 | "Ograniczoną zdolność do czynności prawnych mają małoletni, którzy ukończyli lat trzynaście…" | 13-17: limited capacity. |
| 17 | Consent of the statutory representative is needed for a legal act by which the person "zaciąga zobowiązanie lub rozporządza swoim prawem". | 13-17 need parental consent for obligations. |
| 18 § 1-3 | Validity of a contract made without consent "zależy od potwierdzenia umowy przez tego przedstawiciela"; the counterparty "nie może powoływać się na brak zgody" but may set the representative a deadline to confirm and is free after it passes. | Contract is pending, not void. We cannot invoke the lack of consent; we can ask a parent to confirm. |
| 20 | A person with limited capacity "może bez zgody przedstawiciela ustawowego zawierać umowy należące do umów powszechnie zawieranych w drobnych bieżących sprawach życia codziennego". | The everyday-contracts exception for 13-17. |
| 21 | Free disposal of own earnings. | Not relevant. |

**Is a free app a "typical minor everyday contract"?** I found no primary source (statute text, Supreme Court ruling) that says whether accepting the terms of a free app falls under art. 20 / art. 14 § 2. The statute gives only the phrase "umowy powszechnie zawierane w drobnych bieżących sprawach życia codziennego". Reasoning, not verified: signing up to a free service involves no payment, so it fits the "minor, current, common" description far better than a paid or long-term contract; but our terms also impose obligations (acceptable use, a licence to store and show the user's content in Terms §4, deletion rights) and art. 17 captures "zaciąga zobowiązanie". Whether a court would call that an everyday contract is **UNVERIFIED** and a lawyer question. Practical frame:

- 13-17: at worst the terms are pending until a parent confirms (art. 18). We cannot rely on the lack of consent (art. 18 § 3), and the child can simply stop using the service. A line in the terms asking under-18s to have a parent's okay is common practice and costs nothing, but it does not create verified consent.
- Under 13: contract void unless everyday and performed (art. 14 § 2). We would also be serving people who cannot validly agree to the terms at all, which makes the abuse rules and content licence unenforceable against them. A further reason for 13 as floor.
- GDPR link: the EDPB says "contracts for online services must be valid under the applicable contract law. An example of a relevant factor is whether the data subject is a child", so the controller "must ensure that it complies with the relevant national laws on the capacity of children to enter into contracts" (Guidelines 2/2019 on Art. 6(1)(b), v2.0, p. 6: `https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines-art_6-1-b-adopted_after_public_consultation_en.pdf`). And p. 9: if we cannot show the contract is valid under national contract law, "the controller should consider another legal basis". Footnote 24: a later-invalidated contract "will impact the lawfulness" of continued processing but does not automatically make Art. 6(1)(b) the wrong choice. This is the real GDPR hook for minors: our contract basis is only as sound as the contract. Our fallback is Art. 6(1)(f), which for children is balanced harder (section 3).

## 3. Other GDPR duties that grow with child users

- **Transparency in child-appropriate language (Art. 12(1)):** information must be given "in a concise, transparent, intelligible and easily accessible form, using clear and plain language, in particular for any information addressed specifically to a child". Recital 58 repeats this. EDPB consent guidelines p. 26: "the controller must explain in language that is clear and plain for children how it intends to process the data". Minimum: a short plain-language summary at the top of the privacy page (what we keep, who sees it, how to delete), in Polish first. The existing policy is already plain; a ~6-line "for young users" box would meet this.
- **Art. 6(1)(f) balancing:** Art. 6(1)(f) says interests are overridden by the data subject's rights "in particular where the data subject is a child". EDPB Guidelines 1/2024 (v1.0, Oct 2024, public-consultation version; `https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf`, pp. 26-27, paras 91-96): the balancing test "should be recalibrated where the data subjects are children"; the child's best interests (Charter art. 24(2)) are a guide; "the interests of children as data subjects should have high priority and will very often outweigh the interests of the controller"; extensive profiling and targeted advertising "will generally not align" with protecting children. For us the 6(1)(f) uses are rate limits, deletion-request limits and server logs, which are low-intrusion and tie directly to protecting the service (and its users); I see no conflict, but the balancing note should now mention minors.
- **DPIA (Art. 35):** Art. 35(3) lists three mandatory cases (large-scale profiling decisions, large-scale special categories, large-scale public monitoring); none applies. WP29 WP248 rev.01, criterion 7, treats data of "vulnerable data subjects" as a risk criterion and names children ("they can be considered as not able to knowingly and thoughtfully oppose or consent"); "In most cases ... a processing meeting two criteria would require a DPIA", "in some cases ... only one" (`https://ec.europa.eu/newsroom/article29/redirection/document/47711`, section III.B). UODO's DPIA list (Komunikat of 17 June 2019, 12 categories; `https://uodo.gov.pl/pl/598/3617`) does not name children, repeats the two-criteria rule, and is "nie ma charakteru wyczerpującego". Our processing meets criterion 7 once children are users and arguably none of the others (no profiling, not large scale, no matching, no special categories). One criterion does not mandate a DPIA. Recommended anyway: a one-page written risk assessment kept in the repo (EDPB Statement 1/2025 also expects the necessity and proportionality of safety measures to be demonstrated). UNVERIFIED: whether UODO treats a small gift app with minors as needing more.
- **Recital 38 / 75 / 65:** children "merit specific protection"; their data is a risk factor (recital 75); the right to erasure is "relevant in particular where the data subject has given his or her consent as a child" (recital 65). Our delete-account flow already deletes at once, so it fits.
- **Art. 25 (data protection by design):** not read in detail here. The substantive point is the people-search behaviour: a minor's name and photo are discoverable by every account holder with a 3-character prefix, with no opt-out. Excluding under-16s (or all minors) from search and from stranger invites is the design-level mitigation. Spec §2.2 currently accepts "no opt-out in v1".
- **Irish DPC "Fundamentals for a Child-Oriented Approach to Data Processing"** (`https://www.dataprotection.ie/en/dpc-guidance/fundamentals-child-oriented-approach-data-processing`): non-binding, not Polish; only the landing page was read. Useful as a checklist; UODO has no equivalent that I found.
- **DSA Art. 28 (online protection of minors):** "Providers of online platforms accessible to minors shall put in place appropriate and proportionate measures to ensure a high level of privacy, safety, and security of minors". It sits in Section 3, which Art. 19(1) excludes for "providers of online platforms that qualify as micro or small enterprises". An "online platform" must disseminate information "to the public" (Art. 3(k)); recital 14 says private messaging falls outside, but access that needs only automatic admission (such as an open invite link) may count as public. Likely a sole operator is below the thresholds. UNVERIFIED whether event invite links make us a platform; the Commission's Art. 28 guidelines were not read.
- **Poland, pending bill:** the draft act on protecting minors from harmful online content (UD179) targets providers of harmful content; UODO's comment of 10 June 2025 is at `https://uodo.gov.pl/pl/138/3729`. Not applicable to a gift list; status not checked.

## 4. Apple

**Age rating** (App Store Connect Help, "Age ratings values and definitions", `https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions`): categories are 4+, 9+, 13+, 16+, 18+. For capabilities, **Messaging and chat: 4+**, **User-generated content: 4+**, Advertising 4+, Unrestricted web access 16+, **Social media: 13+**. Apple "generates appropriate ratings based on your answer to the age rating questionnaire". Our app calculates to 4+ (no web browser, no social feed).

**Minimum age vs rating** ("Set an app age rating", `https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/`): developers can "increase the rating of your app to a rating that exceeds the rating assigned by Apple" with *Override to Higher Age Rating*, and **"If your app's EULA sets minimum age requirements above Apple's calculated rating, you must override to a rating that meets them."** (paraphrase from the summarising fetch; re-read the page.) Consequences:

- Today (terms say 16+): override to 16+. Whether our public terms count as the "EULA" is UNVERIFIED; the safe reading is that they do, so the rating should match the terms.
- Lowered to 13: override to 13+.
- No minimum: 4+ as calculated. Apple's age-rating page gives no minimum developer age and no extra duty for under-13s outside Kids.

**Social-media question** (Apple Developer News, 9 July 2026, `https://developer.apple.com/news/?id=tlur8uvi`): required for new apps and updates from September 2026. "Social media capabilities" means "the ability to redistribute, amplify, or interact with user-generated content through a social feed or similar discovery method." Prezentowo has no feed and no public discovery of content, so the expected answer is No. If it were Yes the rating rises to 13+; if Yes but disabled for under-13s, Apple requires the Declared Age Range API.

**Kids Category and Guideline 1.3 / 5.1.4** (`https://developer.apple.com/app-store/review/guidelines/`):

- The Kids Category is opt-in (age band 5 and under, 6-8 or 9-11; `https://developer.apple.com/app-store/kids-apps/`), carries no third-party analytics or ads, parental gates and no PII to third parties. Not needed and not appropriate: chat plus photos plus Scaleway/Stream/Expo as processors would violate "may not send personally identifiable information or device information to third parties".
- 5.1.4(a)/(b): apps "that collect, transmit, or have the capability to share personal information (e.g. name, address, email, location, photos, videos, drawings, the ability to chat ...) from a minor must include a privacy policy and must comply with all applicable children's privacy statutes." We have the policy. 5.1.4 also allows asking birthdate "only for the purpose of complying with these statutes" and requires useful functionality regardless of age, so a neutral age screen is allowed.
- 2.3.8: "Apps not in the Kids Category cannot include any terms in app name, subtitle, icon, screenshots or description that imply the main audience for the app is children." So do not market to children.
- **Guideline 1.2 (UGC)** applies whatever the age: a method for filtering objectionable material, a report mechanism with timely responses, the ability to block abusive users, and published contact information. Chat and photos make us UGC. Lowering the age makes this easier to be held to.

**Age-assurance laws** (`https://developer.apple.com/news/?id=f5zj08ey`): the Declared Age Range API and age-category sharing for new accounts in Utah (from 6 May 2026) and Louisiana (1 July 2026) apply when the app requests it; the 18+ download blocks (Australia, Brazil, Singapore) target 18+ apps. No requirement for ordinary 4+/13+ apps; watch item.

**App Privacy answers** (`https://developer.apple.com/app-store/app-privacy-details/`): the labels describe data, not audience. The page has no child-specific questions. Lowering the age changes none of them: contact info (name, email), user content (photos, other user content), messages in-app, identifiers. "Collect" means "transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary to service the transmitted request in real time". Whether the push token counts as "Device ID" is UNVERIFIED (the page does not mention push tokens); that question exists today, not because of children.

## 5. Google Play

**Target audience and content** (`https://support.google.com/googleplay/android-developer/answer/9867159`): age groups are 5 and under, 6-8, 9-12, 13-15, 16-17, 18+. For 13-15 and 16-17: "Note that this age group may be considered to include children in some locales." "Any apps that include children in their target audience must comply with Google Play's Families Policy Requirements", and developers "must consider if they would be considered children under their local laws". The page does not say selecting only 13-15 / 16-17 automatically triggers Families requirements; 5-and-under, 6-8 and 9-12 are treated as including children in most locales. Declaring 18+ only allows Restrict Minor Access.

Our situation:

- Today (16+): declare 16-17 and 18+. Even 16-17 "may be considered to include children in some locales", so strictly speaking the same question exists today; in Poland 16 is the age of digital consent, so a 16-17 declaration is defensible.
- Lowered to 13: declare 13-15, 16-17, 18+. By Google's own wording 13-15 may include children, and in Poland a 13-15-year-old is below the age of digital consent (16). Treat as Google-flagged: expect Families-type requirements (below) and Google may review and override the declaration. How Google treats a declaration of only 13-15+ in the EEA in practice is UNVERIFIED.
- Below 13 (or no minimum): declare 9-12 etc.; the page says "Your app is designed primarily for children under 13" apps must follow the Families Policy and use only Families Self-Certified Ads SDKs.
- Marketing that "appeals to children" can get an app rejected if declared as not designed for children.

**Families Policy** (`https://support.google.com/googleplay/android-developer/answer/9893335`), applies where children are a target audience: a privacy policy; compliance with COPPA and GDPR for the app and every SDK; for mixed audiences "a neutral age screen" (an incorrectly set one presets the birth date to the required age, per the target-audience page); no interest-based ads or remarketing (we have no ads); social features: an in-app reminder to be safe online before child users exchange freeform media or information, "require adult action before allowing child users to exchange personal information", "a method for adults to manage social features for child users", and apps "where the main focus is chatting with strangers or anonymously must not target children". Our chat is within an event among people who joined by invite, not stranger chat. If Families duties applied in full, the adult-action rule for exchanging personal information would effectively mean parental gating of chat and photos, a material product change. This is the main cost of declaring an under-13 or child-inclusive audience; at 13-15 the application is uncertain (UNVERIFIED).

**Data safety** (`https://support.google.com/googleplay/android-developer/answer/10787469`): "Apps that have children as a target audience must follow Google Play's Families policy requirements"; no separate child disclosure fields. Transfers to a service provider (a processor acting only on our instructions) are not "sharing" but still count as "collect" ("transmitting data from your app off a user's device"): name, email, photos, other in-app messages, device or other IDs, as today. Lowering the age does not change the form. The Families badge is optional.

**User-generated content policy** (`https://support.google.com/googleplay/android-developer/answer/9876937`): users must agree to terms or a user policy before posting UGC; objectionable content and behaviour defined and banned in it; "robust, effective, and ongoing" moderation with an in-app way to report and block users and content (blocking is expected for "1:1 user interaction" features); "Don't allow minors to access apps that may contain sexual content." This is required already; minors raise the stakes. Our terms already ban illegal or abusive content (Terms §3); the in-app report and block need to be confirmed.

**Content rating** (`https://support.google.com/googleplay/android-developer/answer/9859655`): separate from target audience; the page does not list the questionnaire's questions, so what the IARC questionnaire asks about user interaction is UNVERIFIED.

## 6. GetStream (chat)

From Stream's Online Terms (`https://getstream.io/legal/`, version dated October 2024, read through the summarising fetch; re-read the verbatim clauses before relying on them):

- §1.3(a): the customer (us) "is at least 18 years old and has the legal capacity to be bound by this Agreement". Applies to Filip, not to end users.
- §6.2 (customer must not upload) (d): data that "is harmful to minors or depicts harm to minors in any way". End users: customer must "limit participation access to the Service to those individuals who agree to Customer's terms of services ... at least as restrictive as this Agreement" with "terms and conditions governing responsible user conduct, misuse and abuse of services" (needs our terms to stay at least as strict; they do).
- §6.3: the customer shall provide legally required privacy notices to End Users "including providing any required notices and obtaining any required verifiable parental consent under COPPA"; the customer "represents and warrants" it has all necessary notices and consents for the Customer Data it provides.
- §11.2: Stream may remove content it finds violating laws, naming the DSA, FOSTA, SESTA and COPPA.
- No clause setting a minimum end-user age, and no GDPR-specific child clause, was found in the terms. Stream's privacy statement (`https://getstream.io/legal/privacy/`) says nothing about children and states it covers only data Stream controls, not data it processes as a processor.
- Stream DPA (February 2024, `https://stream-dpa-public.s3.amazonaws.com/Stream+DPA+February+2024.pdf`, read in full text): §2.1 customer is Controller and Stream is Processor; §2.2 the customer shall "give adequate notice ... obtain all necessary rights, and, where applicable, all appropriate and valid consents" and "is solely liable and responsible for the accuracy, quality, and legality of Personal Data". No child, minor, parental-consent or COPPA text in the DPA. Hosting region not stated in the DPA (the EU West claim comes from elsewhere).

Net: Stream pushes lawfulness and parental consent onto us as controller. Nothing forbids under-16 end users. Our duties are the ones above (our own privacy notice, a valid basis, a terms-of-use for the end users, no content harmful to minors).

## 7. COPPA (US, under 13)

- COPPA and the FTC Rule, 16 CFR Part 312. "Child" is "an individual under the age of 13" (`https://www.ecfr.gov/current/title-16/part-312/section-312.2`). Section 312.3: "It shall be unlawful for any operator of a website or online service directed to children, or any operator that has actual knowledge that it is collecting or maintaining personal information from a child" to do so without complying (verifiable parental consent before collection, section 312.5).
- **Does it reach an EU app in US stores?** The "operator" definition covers any website or online service "operated for commercial purposes involving commerce among the several States or with one or more foreign nations". FTC FAQ B.7 (`https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions`): foreign operators "must comply with COPPA if they are directed to children in the United States" (or knowingly collect from US children). An individual running a free, ad-free hobby app: whether that is "operated for commercial purposes" is **UNVERIFIED**; the FAQ (B.5) says COPPA covers commercial, not exempt-nonprofit, operators, and does not address a free personal app. Do not rely on "not commercial".
- **Directed to children:** "a commercial website or online service, or portion thereof, that is targeted to children" (312.2), judged by "subject matter, visual content, use of animated characters", marketing plans, audience composition evidence, etc. Mixed audience services (children not the primary audience) may age-screen "in a neutral manner that does not default to a set age or encourage visitors to falsify age information", and treat under-13s differently.
- **Actual knowledge** (312.3; FTC FAQ A.12, H.6): general-audience operators are covered only when they have actual knowledge a user is under 13. "The Rule does not require operators to ask the age of visitors" (H.1). A parent's report can establish knowledge (H.6). Operators may block under-13s (H.3). So: asking age at sign-up and getting "11" is actual knowledge; a general-audience app that never asks is exposed only on a report.
- **What counts as personal information:** name, usernames functioning as online contact info, email, "a photograph, video, or audio file where such file contains a child's image or voice" (312.2). Prezentowo collects all of these from a user.
- **Teenagers:** "COPPA does not apply to teenagers" (FAQ A.9). A 13 floor with no "directed to children" marketing therefore keeps the app outside COPPA unless we get actual knowledge, then we must delete the account (the policy already says so).
- **Rule amendments:** final rule published 22 April 2025 (`https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule`), effective 23 June 2025, compliance by 22 April 2026 for most provisions (separate parental opt-in for third-party disclosure, written retention limits). Relevant only if we cross into COPPA scope. A February 2026 FTC policy statement on age-verification technologies was seen only in a search result (UNVERIFIED).
- Option (d) "no minimum" means knowingly allowing under-13s, so actual knowledge is likely and US verifiable parental consent would be required. If US children cannot be ruled out, that would call for a US-aware consent flow or geo-restricting US storefronts. Not proportionate for this app.

## 8. Options and their consequences

| | (a) Keep 16+ | (b) 13+, no parental consent | (c) Under 16 with parental consent | (d) No minimum |
|---|---|---|---|---|
| GDPR Art. 8 | None triggered. | Only for push consent (13-15): no push, or parent authorisation. | Parental authorisation + verification (Art. 8(2)) for under-16s, for push. | Same as (c) for all under 16, with a lower floor. |
| Contract (KC) | None; no age gate, so "knowingly" already holds. | 13-17 limited capacity, pending parent confirmation (art. 15-18); everyday exception arguable. | A parent confirmation (art. 18) gives the clean position for 13-15. | Under 13: void unless everyday and performed (art. 12, 14 § 2). |
| COPPA | Out of scope (actual knowledge on report only). | Out of scope unless actual knowledge of under-13. | Same as (b). | Likely in scope; VPC for US under-13s. |
| Apple | Rating override 16+ (if terms count as EULA); 1.2 UGC. | Override 13+; 1.2 UGC. | Same as (b); 5.1.4 parental contact only for compliance. | 4+ as calculated; no kids marketing (2.3.8); 5.1.4 duties for under-13 data. |
| Google | Target 16-17 + 18+. | Target 13-15 + up: "may include children"; neutral age screen; social-feature rules possible. | Same as (b), plus parental controls fit "adult action". | Child-directed: Families Policy in full, adult action for social features. |
| App work | Optional: add a real gate (currently none). | Age screen, push gating, search exclusion for under-16, report/block. | Everything in (b), plus a parent email flow and consent records. | Everything in (c), plus under-13 handling and US consent. |
| Text work | None. | See below. | See below, plus a parent-facing notice. | A full child-directed policy. |

**Minimum text changes for (b), 13+:**

- `landing.privacy.tsx` §10 (PL and EN): "Accounts are for people aged 13 and over. People under 16 can use Prezentowo but without push notifications (which need a parent's permission under GDPR). We don't knowingly hold an account of anyone under 13 and delete one when we learn of it." Keep the placeholder sentence.
- `landing.privacy.tsx` §2 (consent paragraph): note that for under-16s push is off.
- A plain-language summary near the top of the privacy page (Art. 12(1)), PL first.
- `landing.terms.tsx` §2 (PL and EN): "You must be 13 or older to have an account. If you are under 18, make sure a parent or guardian is fine with you using Prezentowo." Terms §3 (adding someone by name "only with their okay, or as their parent or guardian") needs no change.
- Spec §3.7 and issue #87's outline ("16+").
- Store: Apple age-rating override 13+; Google target audience; privacy URLs unchanged.

**Minimum app changes for (b):** age screen at first login (band only: under 13 / 13-15 / 16+); under 13 stops with a message and keeps nothing; under-16 band has push off and the push pre-prompt hidden; under-16 band excluded from `users.search`; in-app report and block verified working for chat (both stores require it, and Stream exposes flag and block); contact details published (already in policy and terms: prezentowo@jarno.pl).

**Alternative (c-lite), if the owner wants clean contract coverage:** ask under-16s for a parent's email and send a confirmation link (EDPB Example 23); this also authorises push. It costs a flow, a mail template, consent records (Art. 7(1)), and more support. Not required by the GDPR for non-consent processing, so only worth it if a lawyer says the terms need it.

## Points where a lawyer's confirmation is worth paying for

1. Whether a free app is an "information society service" at all (no remuneration), which decides whether Art. 8 applies even to the push consent.
2. Whether accepting free-app terms is an art. 14 § 2 / art. 20 everyday contract for 13-15-year-olds, in particular with the content licence in Terms §4 (art. 17 "rozporządza swoim prawem"), and whether to add a parent-confirmation mechanism (art. 18).
3. Whether Poland has any other act setting a lower age of digital consent (none found in the two GDPR-implementing acts).
4. Whether a minors-friendly "legitimate interest" balancing note and a short DPIA should be written, and how UODO would see people search exposing minors.
5. COPPA: whether an individual's free app is "operated for commercial purposes", and whether to geo-restrict US storefronts if under-13 users are ever allowed.
6. DSA: whether event invite links make the chat part of an "online platform" under Art. 3(i)/(k), and whether Art. 19 micro-enterprise exclusion applies to a sole operator.
7. Google Families: how Google treats a 13-15 declaration in the EEA in review (the policy text is ambiguous).
8. Whether the Terms count as an "EULA" for Apple's override rule (Terms currently say 16+ while the rating is computed 4+).
