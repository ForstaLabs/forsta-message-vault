# Change Log

## [0.5.0]
- **Internal Integrity with External Blockchain Attestation** of all the data in the vault. 
  **First**, all messages get a SHA256 integrity hash of the main envelope/body and another
  for any attachments, plus a Merkle-chain hash of those two hashes and the chain hash of the 
  *previous* message. These provide guarantees of integrity for all message, attachment, and 
  recipient ID and label data received, as well as guarantees of no insertion, deletion, or 
  reordering of messages. **Second**, periodically (maybe 1/hr), a message's "chain" hash is 
  given to an external blockchain-based timestamp facility (opentimestamps.org) to provide 
  prove that hashes/chains have not been regenerated.

- **Force SSL on Heroku** by setting `HEROKU_FORCE_SSL=yes` in the environment. 
  (The heroku-ssl-redirect module itself also looks for `NODE_ENV=production`.)

## [0.4.0]
- **Insecure API override** for *specialized, unusual, probably ill-advised 
  (you've been warned :^)* circumstances. This is useful when your message vault is 
  running in a controlled context that establishes appropriate security and you need 
  to permit unauthenticated access to the vault's APIs. (The vault UI will still operate as
  usual, but any attribution of actions to an actor will be missing, which currently 
  means that adding or removing an authorized user will happen but in an unattributed way.)

  Just set the environment variable `API_AUTH_OVERRIDE=insecure`

## [0.2.0]
- **Postgres storage** of messaging data (this also meant upgraded the underlying 
  `libsignal` library to use postgres as a backing store).
- **Message filter query API** to let the client to retrieve subsets of messages 
  by any combination of: 

    filter | notes
    -------|--------
    `body` | body words match in a language-aware tsquery
    `title` | thread title words match in a language-aware tsquery
    `threadId` | thread IDs are stable, while titles can change
    `from` | label for sender includes this fragment
    `fromId` | user IDs are stable while labels can change
    `to` | labels for recipients includes this fragment
    `toId` | user IDs are stable while labels can change
    `until` | "received" timestamp <= provided time
    `since` | "received" timestamp >= provided time
    `attachments` | yes/no/unspecified, defaults to unspecified
    `offset` | defaults to 0
    `limit` | defaults to ALL
    `orderby` | defaults to "received" timestamp
    `ascending` | yes/no, defaults to no

- **Message browsing page** to let users home in on the desired subset of messages 
  using the above filters. Fun feature: it starts out with title/body content 
  *visually obscured* so the user isn't assaulted with the unfiltered content of
  the entire organization's traffic upon arrival.
- **File export** that delivers browsed messages from the current set of filters in
  a `.zip` file containing all relevant attachments, an `.html` file (with links 
  into the attachments), a `.json` file with the complete raw data, and a `.csv` 
  file with a useful subset of that data.
- **New authentication system** to replace the simple password-based site/api auth.
  Now (approved) vault users are sent adjective-verb login codewords via Forsta messages.
- **Settings page** where users can add and remove approved site users (automatic
  notification of all changes and sign-ins are sent to all approved users).

## [0.1.0]
- Initial common-ancestor bot forked from older vault project
- Performs onboarding to act as an existing user, as well as admin-creating-monitor 
  onboarding to act as a new "monitor" user.
- Handles bot site authentication with a bcrypt-stashed password, providing a jwt 
  for site api access.
