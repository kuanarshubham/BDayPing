import 'dotenv/config';
import express from 'express';
import { makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import { useMongoDBAuthState } from './mongoAuth.js';
import { MongoClient } from 'mongodb';
import cron from 'node-cron';
import qrcode from 'qrcode-terminal';
import 'dotenv/config'

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_JID = process.env.OWNER_JID;
const TZ = process.env.TZ || 'Asia/Kolkata';

if (!MONGO_URI || !OWNER_JID) {
    console.error("Missing required environment variables: MONGO_URI, OWNER_JID");
    process.exit(1);
}

// Initialize Express server
const app = express();
app.get('/ping', (req, res) => {
    res.status(200).send("Bot is awake!");
});
app.listen(PORT, () => {
    console.log(`Keep-alive server listening on port ${PORT}`);
});

// Setup MongoDB and Baileys
async function startBot() {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("Connected to MongoDB");

    const db = mongoClient.db();
    const birthdaysCollection = db.collection('birthdays');
    const authCollection = db.collection('auth_sessions_v2');

    const { state, saveCreds } = await useMongoDBAuthState(authCollection);

    async function connectToWhatsApp() {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrcode.generate(qr, { small: true });
                console.log("Scan the QR code above to authenticate.");
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to', lastDisconnect?.error, 'reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('Connected to WhatsApp');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            
            // Only process messages from the owner to themselves
            if (!msg.key.fromMe || !msg.message) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!text) return;

            // !ping command for testing
            if (text === '!ping') {
                await sock.sendMessage(msg.key.remoteJid, { text: `🏓 Pong! Bot is awake.` });
            }

            // !getid command to find group ID
            if (text === '!getid') {
                await sock.sendMessage(msg.key.remoteJid, { text: `This chat's ID is: ${msg.key.remoteJid}` });
            }

            // !doc command to show all available commands
            if (text === '!doc') {
                const docText = `🤖 *BDayPing Bot Commands* 🤖\n\n` +
                                `*!add [Name] [DD-MM]* - Add a birthday (e.g., !add Aman-Kumar-Rai 19-09)\n` +
                                `*!list* - View all saved birthdays\n` +
                                `*!ping* - Check if the bot is running\n` +
                                `*!getid* - Get the ID of the current chat/group\n` +
                                `*!doc* - Show this help menu`;
                await sock.sendMessage(msg.key.remoteJid, { text: docText });
            }

            // !add command: e.g., !add Aman-Kumar-Rai 19-09
            if (text.startsWith('!add ')) {
                const parts = text.split(' ');
                if (parts.length >= 3) {
                    const date = parts.pop();
                    const name = parts.slice(1).join(' '); // Re-join just in case
                    
                    // Basic date validation DD-MM
                    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$/;
                    if (dateRegex.test(date)) {
                        await birthdaysCollection.insertOne({ name, date });
                        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Added ${name} on ${date}` });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Invalid date format. Use DD-MM (e.g., 19-09).` });
                    }
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: `❌ Invalid command format. Use: !add [Name] [DD-MM]` });
                }
            }

            // !list command
            if (text === '!list') {
                const allBirthdays = await birthdaysCollection.find({}).toArray();
                if (allBirthdays.length === 0) {
                    await sock.sendMessage(msg.key.remoteJid, { text: `No birthdays saved yet.` });
                } else {
                    let replyText = `🎂 *Saved Birthdays* 🎂\n\n`;
                    allBirthdays.forEach(b => {
                        replyText += `- ${b.name}: ${b.date}\n`;
                    });
                    await sock.sendMessage(msg.key.remoteJid, { text: replyText });
                }
            }
        });

        // Cron Job - 10:00 PM Daily
        cron.schedule('0 22 * * *', async () => {
            console.log("Running cron job for tomorrow's birthdays...");
            
            // Calculate tomorrow's date based on cron timezone
            const tomorrow = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const dd = String(tomorrow.getDate()).padStart(2, '0');
            const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const tomorrowStr = `${dd}-${mm}`;

            const matches = await birthdaysCollection.find({ date: tomorrowStr }).toArray();
            
            if (matches.length > 0) {
                const names = matches.map(m => m.name);
                const namesStr = names.length === 1 ? names[0] : (names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
                const reminderText = `🎉 Reminder: It's ${namesStr}'s birthday tomorrow!`;
                
                await sock.sendMessage(OWNER_JID, { text: reminderText });
                console.log(`Sent reminder for: ${namesStr}`);
            } else {
                console.log(`No birthdays for tomorrow (${tomorrowStr}).`);
            }
        }, {
            scheduled: true,
            timezone: TZ
        });
    }

    connectToWhatsApp();
}

startBot().catch(err => {
    console.error("Failed to start bot:", err);
});
