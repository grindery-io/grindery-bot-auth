import {Database} from "../db/conn.js";

const collectionName = "transfers";
const backupCollectionName = "transfers-backup";

const startBackup = async () => {
  const db = await Database.getInstance();

  // Reference to the source and destination collections
  const collection = db.collection(collectionName);
  const backupCollection = db.collection(backupCollectionName);

  // Fetch all documents from the source collection
  const allUsers = await collection.find({}).toArray();

  // Insert all fetched documents into the destination collection
  if (allUsers.length > 0) {
    await backupCollection.insertMany(allUsers);
  }

  console.log("\n Backup complete \n");
  process.exit(0);
};

startBackup();
