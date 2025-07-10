import dotenv from 'dotenv';
dotenv.config();

export const CLIENT_ID = process.env.CLIENT_ID;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
export const REDIRECT_URI = process.env.REDIRECT_URI;
export const PORT = process.env.PORT || 3001;

console.log(CLIENT_ID, "CONSOLE LOG");