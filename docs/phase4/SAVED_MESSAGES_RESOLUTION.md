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
