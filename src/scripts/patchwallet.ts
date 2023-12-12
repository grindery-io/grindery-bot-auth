import { Db } from 'mongodb';
import { Database } from '../db/conn';
import { USERS_COLLECTION } from '../utils/constants';
import { getPatchWalletAddressFromTgId } from '../utils/patchwallet';

// Usage: updatePatchWalletAddresses()
// Description: This function updates the PatchWallet addresses for users in the database.
// It fetches users with an empty patchwallet field and updates it using data from getPatchWalletAddressFromTgId.
// Example: updatePatchWalletAddresses();
async function updatePatchWalletAddresses(): Promise<void> {
  let db: Db;
  try {
    db = await Database.getInstance();
    const collectionUsers = db.collection(USERS_COLLECTION);

    for (const user of await collectionUsers
      .find({
        $or: [{ patchwallet: '' }, { patchwallet: { $not: /^0x/ } }],
      })
      .toArray()) {
      try {
        await collectionUsers.updateOne(
          { _id: user._id },
          {
            $set: {
              patchwallet: await getPatchWalletAddressFromTgId(
                user.userTelegramID,
              ),
            },
          },
        );

        console.log(
          `Updated PatchWallet address for user ${user.userTelegramID}`,
        );
      } catch (error) {
        console.error(
          `Error updating PatchWallet address for user ${user.userTelegramID}: ${error.message}`,
        );
      }
    }

    console.log('Update completed.');
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

updatePatchWalletAddresses();
