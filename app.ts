import { User } from './interfaces/user';
import 'dotenv/config';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';

function createRandomUser(): User {
    return {
        _id: new ObjectId(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        createdAt: new Date(),
        address: {
            country: faker.location.countryCode(),
            state: faker.location.state(),
            city: faker.location.city(),
            postcode: faker.location.zipCode(),
            line1: faker.location.streetAddress(),
            line2: faker.location.secondaryAddress()
        }
    };
}

async function insertRandomUsers(customers: Collection) {
    const users: User[] = faker.helpers.multiple(createRandomUser,
        {count: Math.floor(Math.random() * 9) + 1});
    customers.insertMany(users);
    setTimeout(() => insertRandomUsers(customers), 200);
}

async function main() {
    const client = new MongoClient(process.env.DB_URI);

    try {
        await client.connect();
        const customers = client.db().collection('customers');
        await insertRandomUsers(customers);
    }
    catch(e) {
        console.log(e);
    }
}

main();