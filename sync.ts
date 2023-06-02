import { User } from './interfaces/user';
import 'dotenv/config';
import { Collection, MongoClient } from 'mongodb';
import { createHash } from 'crypto';

let queries = [];
let timeout;

async function fullSync(customers: Collection, customersAnonymised: Collection) {
    const allCustomers = await customers.find().toArray();

    const updateQuery = allCustomers.map(customer => {
        return {
            updateOne: {
                filter: {_id: customer._id},
                update: {$set: encodeCustomer(customer)},
                upsert: true
            }
        }
    });
    await customersAnonymised.bulkWrite(updateQuery);
    process.exit();
}

async function continuousSync(customers: Collection, customersAnonymised: Collection) {
    timeout = setTimeout(() => writeDocuments(customersAnonymised), 1000);
    const changeStream = customers.watch();
    for await (const change of changeStream) {
        const doc = change['fullDocument'];
        queries.push({
            updateOne: {
                filter: {_id: doc._id},
                update: {$set: encodeCustomer(doc)},
                upsert: true
            }
        });
    }
}

function writeDocuments(collection: Collection) {
    clearTimeout(timeout);
    if (queries.length) {
        collection.bulkWrite(queries);
        console.log(queries.length + ' documents written.');
        queries = [];
    }
    timeout = setTimeout(() => writeDocuments(collection), 1000);
}

function encodeCustomer(customer): User {
    customer.firstName = encodeString(customer.firstName);
    customer.lastName = encodeString(customer.lastName);
    customer.address.postcode = encodeString(customer.address.postcode);
    customer.address.line1 = encodeString(customer.address.line1);
    customer.address.line2 = encodeString(customer.address.line2);
    const emailSplit = customer.email.split('@');
    customer.email = encodeString(emailSplit[0]) + '@' + emailSplit[1];
    return customer;
}

//It could be more secure but I'll leave it as it is
//for the sake of simplicity
function encodeString(str: string): string {
    str = createHash('md5').update(str).digest('base64');
    str = str.slice(0, 8).replace(/\+|\//g, '0');
    return str;
}

async function main() {
    const client = new MongoClient(process.env.DB_URI);

    try {
        await client.connect();
        const customers = client.db().collection('customers');
        const customersAnonymised = client.db().collection('customers_anonymised');
        if (process.argv.length && process.argv.indexOf('--full-reindex') !== -1) {
            fullSync(customers, customersAnonymised);
        } else {
            continuousSync(customers, customersAnonymised);
        }
    }
    catch(e) {
        console.log(e);
    }
}

main();