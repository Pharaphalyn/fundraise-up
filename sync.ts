import { User } from "./interfaces/user";
import "dotenv/config";
import { ChangeStreamOptions, Collection, MongoClient } from "mongodb";
import { createHash } from "crypto";
import "fs";
import { writeFile } from "fs";
import { readFile } from "fs/promises";

let queries = [];
let timeout;
let resumeToken: Object;

//Easy way to add or remove fields to encode
const encodedFields = [
  "firstName",
  "lastName",
  "email",
  "address.postcode",
  "address.line1",
  "address.line2",
];

async function fullSync(
  customers: Collection,
  customersAnonymised: Collection
) {
  const allCustomers = await customers.find().toArray();

  const updateQuery = allCustomers.map((customer) => {
    return {
      updateOne: {
        filter: { _id: customer._id },
        update: { $set: encodeCustomer(customer) },
        upsert: true,
      },
    };
  });
  await customersAnonymised.bulkWrite(updateQuery);
  process.exit();
}

async function continuousSync(
  customers: Collection,
  customersAnonymised: Collection
) {
  timeout = setTimeout(() => writeDocuments(customersAnonymised), 1000);
  try {
    const tokenFile = await readFile("resume_token.json");
    if (tokenFile && tokenFile.toString()) {
      resumeToken = JSON.parse(tokenFile.toString());
    }
  } catch (e) {
    console.log(e);
  }
  const options: ChangeStreamOptions = { fullDocument: "updateLookup" };
  if (resumeToken) {
    options.resumeAfter = resumeToken;
  }
  const changeStream = customers.watch([], options);
  for await (const change of changeStream) {
    if (
      change.operationType === "update" ||
      change.operationType === "insert"
    ) {
      const doc = change["fullDocument"];
      queries.push({
        updateOne: {
          filter: { _id: change["documentKey"]._id },
          update: { $set: encodeCustomer(doc) },
          upsert: true,
        },
      });
      resumeToken = change._id;
      if (queries.length >= 1000) {
        writeDocuments(customersAnonymised);
      }
    }
  }
}

function writeDocuments(collection: Collection) {
  clearTimeout(timeout);
  if (queries.length) {
    collection.bulkWrite(queries);
    console.log("Writing " + queries.length + " documents.");
    queries = [];
    writeFile("resume_token.json", JSON.stringify(resumeToken), (err) => {
      if (err) {
        console.error(err);
      }
    });
  }
  timeout = setTimeout(() => writeDocuments(collection), 1000);
}

function encodeCustomer(customer): User {
  encodedFields.forEach((field) => {
    if (field === "email") {
      return (customer[field] = encodeEmail(customer[field]));
    }
    //Only gets two levels deep into an object since it's enough for the task
    if (field.indexOf(".") !== -1) {
      const fieldSplit = field.split(".");
      return (customer[fieldSplit[0]][fieldSplit[1]] = encodeString(
        customer[fieldSplit[0]][fieldSplit[1]]
      ));
    }
    customer[field] = encodeString(customer[field]);
  });
  return customer;
}

///Deprecated
///Used it before I learned about { fullDocument: 'updateLookup' }
///Left it here for reference
// function encodeUpdate(update) {
//     Object.keys(update).forEach(field => {
//         if (field === 'email') {
//             return update[field] = encodeEmail(update[field]);
//         }
//         update[field] = encodeString(update[field]);
//     });
//     return update;
// }

function encodeEmail(email: string) {
  const emailSplit = email.split("@");
  return encodeString(emailSplit[0]) + "@" + emailSplit[1];
}

///It could be more secure but I'll leave it as it is
///for the sake of simplicity
function encodeString(str: string): string {
  str = createHash("md5").update(str).digest("base64");
  str = str.slice(0, 8).replace(/\+|\//g, "0");
  return str;
}

async function main() {
  const client = new MongoClient(process.env.DB_URI);

  try {
    await client.connect();
    const customers = client.db().collection("customers");
    const customersAnonymised = client.db().collection("customers_anonymised");
    if (process.argv.length && process.argv.indexOf("--full-reindex") !== -1) {
      fullSync(customers, customersAnonymised);
    } else {
      continuousSync(customers, customersAnonymised);
    }
  } catch (e) {
    console.log(e);
  }
}

main();
