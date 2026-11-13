What cx found or changed waits in your Inbox on the board for you to mark as read, beside proposals and questions to answer. Each answer goes to cx as you send it. It needs cx-board installed too.

Some things you can ask:

- Put these price proposals in my Inbox, and I'll look later.
- How many in my Inbox are still unanswered?
- List what I handled in my Inbox last week.

Dismiss what you won't answer. What you've handled stays under Done, and nothing is deleted.

## The page

- Cards stand in this order: cx's newest card marked `reply: true`, its answer to your last message; then the cards that ask; then those that tell. Inside each part the newest file comes first, by the file's time.
- A tab of more than 32 cards is read in parts: when the board says the page asks too often, the page waits a second and reads on.
- Marking a card reads its file and writes it back with the marks. Words written to it between that read and the write are lost.
- The page changes only `done`, `doneAt` and `answer` in a card's front matter. It writes the file with LF line ends and plain `---` fences, without a BOM.
