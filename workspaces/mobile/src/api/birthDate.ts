import { type SetBirthDateResult, isUnder13 } from '@prezentowo/types'

// Sends first-login's date of birth (docs/spec.md §1.15, §4.4) and says what
// comes next: `stopped` once the server has deleted the account, `continue`
// otherwise. `today` is `todayUtc()`, the day the server judges by.
//
// The stop message goes up *before* the call for an under-13 date: once the
// account goes, its document leaves the publication and would move the root
// guards before the reply arrives. If the server then says it deleted nothing
// (the account already had a date) or the call fails, the message comes back
// down, so nobody is shown a stop for an account that still exists. If the
// phone's clock took the date for 13 and the server deleted anyway, the
// message goes up after the reply.
export async function answerBirthDate(
  birthDate: string,
  today: string,
  send: (birthDate: string) => Promise<SetBirthDateResult>,
  showStopMessage: (shown: boolean) => void,
): Promise<'stopped' | 'continue'> {
  const mayDelete = isUnder13(birthDate, today)
  if (mayDelete) showStopMessage(true)
  try {
    const { deleted } = await send(birthDate)
    if (mayDelete !== deleted) showStopMessage(deleted)
    return deleted ? 'stopped' : 'continue'
  } catch (error) {
    if (mayDelete) showStopMessage(false)
    throw error
  }
}
