# The Inbox page

What `page/inbox.html` does, for the one who builds it.

- Cards stand in this order: cx's newest card marked `reply: true`, its answer to the seller's last message; then the cards that ask; then those that tell. Inside each part the newest file comes first, by the file's time.
- A tab of more than 32 cards is read in parts: when the board says the page asks too often, the page waits a second and reads on.
- Marking a card reads its file and writes it back with the marks. Words written to it between that read and the write are lost.
- The page changes only `done`, `doneAt` and `answer` in a card's front matter. It writes the file with LF line ends and plain `---` fences, without a BOM.
