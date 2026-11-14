# Telegram capability design reference

The [official Telegram Bot API](https://core.telegram.org/bots/api) supplies
capability names and examples for future connector contracts. Web equivalents
below are design candidates. Availability depends on the visible WebZ UI and
account permissions.

| Capability | Bot API reference | Candidate WebZ equivalent | Connector status and constraints | Priority |
|---|---|---|---|---|
| Messaging | [sendMessage](https://core.telegram.org/bots/api#sendmessage) | Chat composer | Local reads in Task 3. Sending needs a verified peer, composer and outcome. | Gated future phase |
| Replies | [ReplyParameters](https://core.telegram.org/bots/api#replyparameters) | Reply to a visible message | Requires verified message identity and reply target. | Gated future phase |
| Editing | [editMessageText](https://core.telegram.org/bots/api#editmessagetext) | Message menu and edit composer | Requires permissions and verification of the specific message. | Post-MVP |
| Forwarding | [forwardMessage](https://core.telegram.org/bots/api#forwardmessage) | Forward menu and recipient picker | Requires source and destination verification. Protected content can restrict forwarding. | Post-MVP |
| Media | [sendPhoto](https://core.telegram.org/bots/api#sendphoto), [sendDocument](https://core.telegram.org/bots/api#senddocument) | Attachment picker | Message metadata can be read. File access, preview and upload are unaudited. | Post-MVP |
| Reactions | [setMessageReaction](https://core.telegram.org/bots/api#setmessagereaction) | Message reaction picker | Requires per-chat eligibility and outcome verification. | Post-MVP |
| Chat information | [getChat](https://core.telegram.org/bots/api#getchat) | Chat list, search and active header | Bounded local results. Peer type may be unknown and peer IDs require revalidation. | Task 3 read interface |
| Group operations | [getChatMember](https://core.telegram.org/bots/api#getchatmember), [restrictChatMember](https://core.telegram.org/bots/api#restrictchatmember) | Group profile and admin views | Admin UI unaudited. Membership and permissions govern availability. | Post-MVP |
| Channel operations | [getChatAdministrators](https://core.telegram.org/bots/api#getchatadministrators), [pinChatMessage](https://core.telegram.org/bots/api#pinchatmessage) | Channel profile and post menu | Visible messages can be read when the peer is verified. Channel administration is unaudited. | Post-MVP administration |
