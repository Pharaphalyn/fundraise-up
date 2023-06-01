import { User } from './models/user';
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { faker } from '@faker-js/faker';

function createRandomUser(): User {
    return {
        _id: faker.string.uuid(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        createdAt: new Date(),
        address: {
            country: faker.location.country(),
            state: faker.location.state(),
            city: faker.location.city(),
            postcode: faker.location.zipCode(),
            line1: faker.location.streetAddress(),
            line2: faker.location.secondaryAddress()
        }
    };
}

async function main() {
    const client = new MongoClient(process.env.DB_URI);

    const users = faker.helpers.multiple(createRandomUser, {count: 5});
    console.log(users);

    try {
        await client.connect();
        const customers = client.db().collection('customers');
        const cust = await customers.find().toArray();
    }
    catch(e) {
        console.log(e);
    }
    finally {
        client.close();
    }
}

main();