/* eslint-disable @typescript-eslint/no-unused-vars */
import { Database } from '../db/conn';
import fs from 'fs';
import csv from 'csv-parser';
import csvWriter from 'csv-writer';
import { TRANSFERS_COLLECTION, USERS_COLLECTION } from '../utils/constants';

// Usage: importUsersFromCSV(filePath)
// Description: This function imports user data from a CSV file into the database.
// - filePath: The path to the CSV file containing user data.
// Example: importUsersFromCSV("/path/to/your/file.csv");
async function importUsersFromCSV(filePath) {
  const db = await Database.getInstance();
  const collection = db.collection(USERS_COLLECTION);
  const toInsert = [];

  try {
    // Read the CSV file and parse its contents
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Extract data from CSV row and format it
        toInsert.push({
          userTelegramID: data.UserID,
          responsePath: data.ResponsePath,
          userHandle: data.UserHandle,
          userName: data.FirstName + ' ' + data.LastName,
          patchwallet: data.wallet,
          dateAdded: new Date(data.FirstActive),
        });
      })
      .on('end', async () => {
        // Retrieve existing userTelegramIDs from the database
        const existingTelegramIDs = (
          await collection.distinct('userTelegramID')
        ).map(String);

        // Filter out new users not present in the database
        const newUsers = toInsert.filter(
          (entry) => !existingTelegramIDs.includes(entry.userTelegramID),
        );

        if (newUsers.length > 0) {
          // Insert new users into the database
          await collection.insertMany(newUsers);
          console.log('Missing users inserted');
        } else {
          console.log('No new users to insert.');
        }

        process.exit(0);
      });
  } catch (error) {
    console.error('Error reading CSV file:', error);
    process.exit(1);
  }
}

// Usage: importUsersFromJSON(filePath)
// Description: This function imports user data from a JSON file into the database.
// - filePath: The path to the JSON file containing user data.
// Example: importUsersFromJSON("/path/to/your/file.json");
async function importUsersFromJSON(filePath) {
  try {
    const db = await Database.getInstance();
    const collection = db.collection(USERS_COLLECTION);
    const existingUserIds = new Set(
      (await collection.distinct('userTelegramID')).map(String),
    );

    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Utilisation d'une expression régulière pour extraire les objets entre les accolades
    const objectRegex = /{[^{}]*}/g;
    const extractedObjects = fileContent.match(objectRegex);

    const parsedObjects = [];
    let malformedObjectCount = 0;

    if (extractedObjects && extractedObjects.length > 0) {
      for (const object of extractedObjects) {
        try {
          // Essayez de parser chaque objet JSON
          const parsedObject = JSON.parse(object);

          if (
            parsedObject.user_id &&
            parsedObject.user_id.trim() !== '' &&
            parsedObject.bot_connection_id &&
            parsedObject.bot_connection_id.trim() !== ''
          ) {
            // parsedObjects.push(parsedObject);

            parsedObjects.push({
              userTelegramID: parsedObject.user_id,
              responsePath: `${parsedObject.bot_connection_id}/c/${parsedObject.user_id}`,
              userHandle: parsedObject.user_handle,
              userName: parsedObject.user_name,
              patchwallet: '',
              dateAdded: new Date(),
            });
          }
        } catch (error) {
          malformedObjectCount++;
        }
      }
    }

    const newUsers = parsedObjects.filter(
      (newUser) => !existingUserIds.has(newUser.userTelegramID),
    );

    if (newUsers.length > 0) {
      await collection.insertMany(newUsers);
      console.log('New users inserted.');
    } else {
      console.log('No new users to insert.');
    }

    console.log(`Malformed objects count: ${malformedObjectCount}`);
  } catch (error) {
    console.error('Error importing users from JSON file:', error);
  } finally {
    process.exit(0);
  }
}

// Example usage of the function
// Description: This function removes users from the database whose userTelegramID contains a "+" character.
// removeUsersScientificNotationInTelegramID();
async function removeUsersScientificNotationInTelegramID() {
  try {
    const db = await Database.getInstance();
    const collectionUsers = db.collection(USERS_COLLECTION);

    // Define a filter to find users with "+" in userTelegramID
    const filter = { userTelegramID: { $regex: /\+/ } };

    // Delete the matching documents
    const deleteResult = await collectionUsers.deleteMany(filter);

    console.log(
      `Deleted ${deleteResult.deletedCount} users with '+' in userTelegramID`,
    );
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

// Example usage of the functions:
// const users = [
//   { userTelegramID: "12345" },
//   { userTelegramID: "67890" },
//   { userTelegramID: "12345" },
//   { userTelegramID: "12345" },
//   { userTelegramID: "67890" },
// ];
// logUserTelegramIDsFromArrayOfUsers(users);
function logUserTelegramIDsFromArrayOfUsers(users) {
  const userTelegramIDCounts = {}; // To store the count of each unique userTelegramID

  // Iterate through the users array
  users.forEach((result) => {
    const userTelegramID = result.userTelegramID;

    // Check if userTelegramID already exists in the userTelegramIDCounts dictionary
    if (userTelegramIDCounts[userTelegramID]) {
      // If yes, increment the counter
      userTelegramIDCounts[userTelegramID]++;
    } else {
      // If not, initialize the counter to 1
      userTelegramIDCounts[userTelegramID] = 1;
    }
  });

  // Iterate through the dictionary and display the results
  for (const [userTelegramID, count] of Object.entries(userTelegramIDCounts)) {
    console.log(`userTelegramID: ${userTelegramID}, Count: ${count}`);
  }
}

// Function to get all users without outgoing transfers and export to CSV
async function getUsersWithoutOutgoingTransfersAndExportToCSV() {
  try {
    const db = await Database.getInstance();
    const usersCollection = db.collection(USERS_COLLECTION);
    const transfersCollection = db.collection(TRANSFERS_COLLECTION);

    // Get all users
    const allUsers = await usersCollection.find({}).toArray();

    // Get all transfers as an array
    const allTransfers = await transfersCollection.find({}).toArray();

    // Create a Set of senderTgId values from transfers for efficient lookup
    const senderTgIdsSet = new Set(
      allTransfers.map((transfer) => transfer.senderTgId),
    );

    // Array to store users without outgoing transfers
    const usersWithoutOutgoingTransfers = [];

    // Loop through all users
    for (const user of allUsers) {
      // Check if user's userTelegramID exists in the Set
      if (!senderTgIdsSet.has(user.userTelegramID)) {
        usersWithoutOutgoingTransfers.push(user);
      }
    }

    // Export users without outgoing transfers to CSV
    if (usersWithoutOutgoingTransfers.length > 0) {
      const csvWriterObject = csvWriter.createObjectCsvWriter({
        path: 'users_without_outgoing_transfers.csv',
        header: [
          { id: 'userTelegramID', title: 'UserTelegramID' },
          { id: 'responsePath', title: 'ResponsePath' },
          { id: 'userHandle', title: 'UserHandle' },
          { id: 'userName', title: 'UserName' },
          { id: 'patchwallet', title: 'Patchwallet' },
          { id: 'dateAdded', title: 'DateAdded' },
        ],
      });

      await csvWriterObject.writeRecords(usersWithoutOutgoingTransfers);
      console.log(
        `Users have been exported to users_without_outgoing_transfers.csv`,
      );
    } else {
      console.log('No users without outgoing transfers found.');
    }
  } catch (error) {
    throw new Error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

async function exportUsersWithHandleEndingInDigitsToCSV() {
  try {
    const db = await Database.getInstance();
    const usersCollection = db.collection(USERS_COLLECTION);

    // Define a filter to find users with userHandle ending in 4 digits
    const filter = { userHandle: { $regex: /\d{4}$/ } };

    // Find users matching the filter
    const usersWithHandleEndingInDigits = await usersCollection
      .find(filter)
      .toArray();

    if (usersWithHandleEndingInDigits.length > 0) {
      const csvWriterObject = csvWriter.createObjectCsvWriter({
        path: 'users_with_handle_ending_in_digits.csv',
        header: [
          { id: 'userTelegramID', title: 'UserTelegramID' },
          { id: 'responsePath', title: 'ResponsePath' },
          { id: 'userHandle', title: 'UserHandle' },
          { id: 'userName', title: 'UserName' },
          { id: 'patchwallet', title: 'Patchwallet' },
          { id: 'dateAdded', title: 'DateAdded' },
        ],
      });

      await csvWriterObject.writeRecords(usersWithHandleEndingInDigits);
      console.log(
        `Users with handle ending in digits exported to users_with_handle_ending_in_digits.csv`,
      );
    } else {
      console.log('No users with handle ending in digits found.');
    }
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

async function convertDateAddedFieldToISODate() {
  try {
    const db = await Database.getInstance();
    const collection = db.collection(USERS_COLLECTION);

    // Filter for documents where dateAdded is not a Date type
    const filter = { dateAdded: { $not: { $type: 'date' } } };

    // Find documents matching the filter
    const cursor = await collection.find(filter).toArray();

    const bulkUpdateOps = [];

    // Iterate over the cursor to prepare bulk update operations
    await cursor.forEach((doc) => {
      const updatedDateAdded = new Date(doc.dateAdded);
      // Check if updatedDateAdded is a valid date
      if (!isNaN(updatedDateAdded.getTime())) {
        bulkUpdateOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { dateAdded: updatedDateAdded } },
          },
        });
      }
    });

    // Execute bulk write with all update operations
    if (bulkUpdateOps.length > 0) {
      await collection.bulkWrite(bulkUpdateOps);
    }

    console.log('DateAdded field updated for documents not in ISODate format.');
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}
