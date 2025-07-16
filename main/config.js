import dotenv from 'dotenv';
dotenv.config();

export const CLIENT_ID = process.env.CLIENT_ID;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
export const REDIRECT_URI = process.env.REDIRECT_URI;
export const PORT = process.env.PORT || 3001;

// Validate required environment variables
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error('❌ Missing required environment variables:');
    if (!CLIENT_ID) console.error('  - CLIENT_ID');
    if (!CLIENT_SECRET) console.error('  - CLIENT_SECRET');
    if (!REDIRECT_URI) console.error('  - REDIRECT_URI');
    console.error('\n📝 Please create a .env file in the root directory with:');
    console.error('CLIENT_ID=your_google_client_id_here');
    console.error('CLIENT_SECRET=your_google_client_secret_here');
    console.error('REDIRECT_URI=http://localhost:3001/oauth2callback');
    console.error('SESSION_SECRET=your_session_secret_here');
    console.error('\n🔗 Get these from Google Cloud Console:');
    console.error('https://console.cloud.google.com/apis/credentials');
    process.exit(1);
}