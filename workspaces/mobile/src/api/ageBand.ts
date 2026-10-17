import {
  type AgeAnswer,
  type SetAgeBandResult,
  UNDER_13,
} from '@prezentowo/types'

// Sends first-login's age answer (docs/spec.md §1.15, §4.4) and says what
// comes next: `stopped` once the server has deleted the account, `continue`
// otherwise.
//
// The stop message goes up *before* the call for an under-13 answer: once the
// account goes, its document leaves the publication and would move the root
// guards before the reply arrives. If the server then says it deleted nothing
// (the account already had a band) or the call fails, the message comes back
// down, so nobody is shown a stop for an account that still exists.
export async function answerAgeQuestion(
  answer: AgeAnswer,
  send: (answer: AgeAnswer) => Promise<SetAgeBandResult>,
  showStopMessage: (shown: boolean) => void,
): Promise<'stopped' | 'continue'> {
  const mayDelete = answer === UNDER_13
  if (mayDelete) showStopMessage(true)
  try {
    const { deleted } = await send(answer)
    if (mayDelete && !deleted) showStopMessage(false)
    return deleted ? 'stopped' : 'continue'
  } catch (error) {
    if (mayDelete) showStopMessage(false)
    throw error
  }
}
