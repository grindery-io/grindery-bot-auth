import { Database } from '../db/conn.js';
import { TRANSFERS_COLLECTION, USERS_COLLECTION } from './constants.js';

export async function computeLeaderboard() {
  try {
    const db = await Database.getInstance();

    // // Créez un objet pour représenter la date et l'heure limite (5 septembre à 10h).
    // const limitDate = new Date('2023-09-05T10:00:00.000Z');

    // // Filtrez les transferts en fonction de la dateAdded.
    // const allTransfers = await transfersCollection
    //   .find({
    //     dateAdded: { $lt: limitDate },
    //   })
    //   .toArray();

    // // Filtrez les utilisateurs en fonction de la dateAdded.
    // const allUsers = await usersCollection
    //   .find({
    //     dateAdded: { $lt: limitDate },
    //   })
    //   .toArray();

    // Filtrez les transferts en fonction de la dateAdded.
    const allTransfers = await db
      .collection(TRANSFERS_COLLECTION)
      .find({})
      .toArray();

    // Filtrez les utilisateurs en fonction de la dateAdded.
    const allUsers = await db.collection(USERS_COLLECTION).find({}).toArray();

    const usersReferral = allTransfers.reduce((acc, transfer) => {
      if (
        transfer?.dateAdded <
        allUsers.find((e) => e.userTelegramID === transfer.recipientTgId)
          ?.dateAdded
      ) {
        if (!acc[transfer.senderTgId]) {
          acc[transfer.senderTgId] = { referred_users: [] };
        }
        acc[transfer.senderTgId].referred_users.push(transfer.recipientTgId);
      }
      return acc;
    }, {});

    const calculateTotalScore = (userId) => {
      const stack = [userId];
      const visited = new Set();

      while (stack.length > 0) {
        const currentUserId = stack.pop();

        if (!visited.has(currentUserId)) {
          visited.add(currentUserId);
          usersReferral[currentUserId]?.referred_users?.forEach(
            (referredUser) => stack.push(referredUser)
          );
        }
      }
      return visited.size - 1;
    };

    // Parcours de tous les utilisateurs dans usersReferral et calcul du score pour chacun
    for (const userId in usersReferral) {
      if (usersReferral.hasOwnProperty(userId)) {
        usersReferral[userId].score = calculateTotalScore(userId);
      }
    }

    console.log(usersReferral);
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    process.exit(0);
  }
}

computeLeaderboard();
