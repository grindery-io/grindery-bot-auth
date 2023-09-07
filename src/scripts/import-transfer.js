import csv from "csv-parser";
import fs from "fs";
import {Database} from "../db/conn.js";

const fileName = "dune.csv";
const collectionName = "transfers";
const transfers = [];
const db = await Database.getInstance();
const collection = db.collection(collectionName);

const saveTranser = async (transfers) => {
  // Step 1: Create a set of existing transaction hashes
  const existingHashes = await collection.distinct("transactionHash");

  // Step 2: Filter the transfers to find the missing ones
  const missingTransfers = transfers.filter(
    (transfer) => !existingHashes.includes(transfer.hash)
  );

  console.log("Number of transfers in csv file: ", transfers.length);
  console.log(
    "Number of transfers in `transfers` collection: ",
    existingHashes.length
  );
  console.log(
    "Number of missing transfers in `transfers` collection: ",
    missingTransfers.length
  );

  // Step 3: Format missing transfers
  const formattedMissingTransfers = missingTransfers.map((transfer) => {
    return {
      TxId: transfer.hash.substring(1, 8),
      chainId: "eip155:137",
      tokenSymbol: "g1",
      tokenAddress: "0xe36BD65609c08Cd17b53520293523CF4560533d0",
      senderTgId: "",
      senderWallet: transfer.from,
      senderName: "",
      recipientTgId: "",
      recipientWallet: transfer.to,
      tokenAmount: transfer.value,
      transactionHash: transfer.hash,
      dateAdded: new Date(transfer.block_time),
    };
  });

  // Step 4: Batch insert the missing transfers into the collection
  if (formattedMissingTransfers.length > 0) {
    const collectionTest = db.collection("transfers-test");
    const batchSize = 1;
    for (let i = 0; i < formattedMissingTransfers.length; i += batchSize) {
      const batch = formattedMissingTransfers.slice(i, i + batchSize);
      await collectionTest.insertMany(batch);
    }
  }
};

const startImport = () => {
  fs.createReadStream(fileName)
    .pipe(csv())
    .on("data", (row) => {
      transfers.push(row);
    })
    .on("end", async () => {
      await saveTranser(transfers);
      console.log("\n All data has been read \n");
      process.exit(0);
    })
    .on("error", (error) => {
      console.log("\n Errors during CSV parsing \n");
      process.exit(1);
    });
};

startImport();
