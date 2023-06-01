import { User } from './interfaces/user';
import 'dotenv/config';
import { Collection, MongoClient } from 'mongodb';
import 'crypto';
import { createHash } from 'crypto';

async function fullSync(customers: Collection, customersAnonymised: Collection) {
    const allCustomers = await customers.find().toArray();

    const updateQuery = allCustomers.map(customer => {
        const encodedCustomer: User = encodeCustomer(customer);
        return {
            updateOne: {
                filter: {_id: encodedCustomer._id},
                update: {$set: customer},
                upsert: true
            }
        }
    });
    console.log(updateQuery);
    customersAnonymised.bulkWrite(updateQuery);
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
        fullSync(customers, customersAnonymised);
    }
    catch(e) {
        console.log(e);
    }
}

main();