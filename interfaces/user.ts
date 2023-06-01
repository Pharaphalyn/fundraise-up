import { ObjectId } from "mongodb";

export interface User {
    _id: ObjectId;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    address: {
        line1: string;
        line2: string;
        postcode: string;
        city: string;
        state: string;
        country: string;
    }
}