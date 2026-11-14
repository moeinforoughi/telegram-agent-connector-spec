# Saved Messages recipient resolution

The live screenshot showed a Saved Messages row under Chats with the subtitle
Chat with yourself. The earlier Connector preview displayed the account name.
Preparation does not open a chat or read its header. The previous adapter read
the row's .peer-title, treated its subtitle as preview text, and passed only
ID, title and type to the resolver. The exact deployed element that produced
the preview remains unverified.

The public [WebK search renderer](https://github.com/morethanwords/tweb/blob/master/src/components/appSearchSuper.ts)
adds the YourChat translation to the subtitle only for the current account's
peer. [WebK's translation renderer](https://github.com/morethanwords/tweb/blob/master/src/lib/langPack.ts)
adds the i18n class. These are source observations. Chromium's window was
listed but window binding failed, so no live DOM, ARIA, peer ID, or header
comparison was captured.

The adapter requires a positive peer ID and a row-local translated subtitle
whose entire English value is Chat with yourself, with no separate handle
element. It normalizes that result to Saved Messages with type self.
The exact English Saved Messages request excludes candidates without the self
marker. Results with message IDs are excluded. Valid visible handles can be
shown in the preview. Phone-like metadata is omitted from search output.
Localization of the self subtitle beyond English remains unverified.

Send still requires a single active peer with the approved search ID. A
different header title is accepted only for an evidenced self recipient.
The renderer and native dialog display the saved recipient title separately
from the account. Existing list-based navigation may still require opening
a search-only peer manually. Reply retains its existing title check.

The Chromium fixtures cover the self subtitle, ordinary handles, exclusion
of message hits and phone-like metadata, and matching versus mismatching
active peer IDs. Electron exercises the Saved Messages preview and cancels it.
No real message was sent, and neither preserved profile was modified in this
task. Task 4 remains Automated Complete — Live Pending.

## Search focus and recent results follow-up

During the next live preparation, the user observed that opening search
displayed recent chats while no query remained visible. The adapter now
opens the unique visible input, verifies keyboard focus, inserts the query
through Chromium, and checks its exact value before and after reading results.
The WebK sidebar defines separate recent and people groups. Search readiness
and extraction both exclude those groups, sponsored rows and message hits.
A Chromium regression fixture shows recent rows as soon as search receives
focus and delays the actual query results. Live preparation with the rebuilt
app is still pending.

## Opening a confirmed search result

The user confirmed that live preparation found Saved Messages. Submission
then returned CHAT_NOT_FOUND because it only looked for the approved peer in
the visible sidebar. The original search query now stays in the one-use Main
operation. If the sidebar row is absent, confirmed Send searches again and
opens the unique row with the approved peer ID. The active header must still
match that ID before composer interaction. Reply uses its existing route.
The Chromium regression covers a peer available only through search and a
second result with the same title. Live submission remains pending.

## Handoff result

The user subsequently confirmed live delivery to Saved Messages. See
`TASK4_MESSAGING.md` for the evidence and remaining limits. Earlier pending
notes above describe the checkpoints before that confirmation.
