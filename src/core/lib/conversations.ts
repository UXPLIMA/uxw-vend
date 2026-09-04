/**
 * Finding the one 1:1 conversation between two people.
 *
 * The obvious clause is "every participant is one of these two", and it is
 * wrong on its own: `every` is vacuously true for a conversation with no
 * participants, and true for one whose only participant is the sender. Those
 * exist and are not rare. `softDeleteUser` deletes the leaving user's
 * `ConversationParticipant` rows, so every 1:1 thread someone was in becomes a
 * one-participant orphan the moment they exercise the right to be forgotten.
 *
 * `findFirst` has no order to fall back on, so it could return an orphan
 * instead of the real thread; the caller then saw a participant count that was
 * not 2 and started a second conversation with someone it already had one
 * with, splitting the history across two threads.
 *
 * Requiring both people to be present as well leaves exactly the 1:1 thread:
 * `some` twice rules out the orphans, `every` rules out a group thread that
 * happens to contain both.
 */
export function oneToOneConversationWhere(userId: string, otherUserId: string) {
    return {
        AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: otherUserId } } },
            { participants: { every: { userId: { in: [userId, otherUserId] } } } },
        ],
    };
}
