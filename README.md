# BDayPing 🎂

BDayPing is a lightweight, zero-cost automated WhatsApp bot designed to store your friends' and family members' birthdays and send you a reminder 2 hours before the big day (e.g., at 10:00 PM the night before). 

It is designed to be easily deployed on free-tier services like Render, and uses MongoDB to safely persist your WhatsApp authentication session across deployments without requiring you to re-scan the QR code.

## 🚀 Features

- **WhatsApp Integration**: Uses `@whiskeysockets/baileys` to listen and respond to commands seamlessly via WhatsApp.
- **Custom MongoDB Auth**: Implements a robust custom authentication adapter to save WhatsApp sessions directly into a MongoDB cluster.
- **Automated Reminders**: Built-in cron job runs daily at 10:00 PM (configurable timezone) to notify you of upcoming birthdays.
- **Group Chat Support**: Can be configured to send reminders to a solo WhatsApp group to keep your personal chat uncluttered.
- **Keep-Alive Server**: Includes a lightweight Express server (`/ping`) designed to be pinged by services like UptimeRobot to prevent your free Render instance from sleeping.

## 🤖 Available Commands

Interact with the bot by sending these commands from your WhatsApp number:

- `!add [Name] [DD-MM]` - Add a new birthday (e.g., `!add Aman-Kumar-Rai 19-09`).
- `!list` - View all saved birthdays.
- `!ping` - Check if the bot is awake and responding.
- `!getid` - Get the unique JID of the current chat/group (useful for setting up `OWNER_JID`).
- `!doc` - Show the help menu with all available commands.

## 🛠️ Prerequisites

- **Node.js** (v20 or higher)
- **MongoDB Atlas** (Free tier works perfectly)
- A WhatsApp account

## ⚙️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/BDayPing.git
   cd BDayPing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file in the root directory and configure the following variables:
   ```env
   PORT=3000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/bdayping?retryWrites=true&w=majority
   OWNER_JID=911234567890@s.whatsapp.net
   TZ=Asia/Kolkata
   ```
   > **Tip**: If you want the bot to send reminders to a specific WhatsApp group instead of your personal chat, create a group with just yourself, type `!getid` in the group, and set `OWNER_JID` to the returned ID (e.g., `1234567890-123456@g.us`).

4. **Run the Bot Locally**
   ```bash
   npm start
   ```
   *On your first run, a QR code will be generated in the terminal. Open WhatsApp on your phone -> Linked Devices -> Link a Device, and scan the QR code. Your session will be saved in MongoDB.*

## ☁️ Deployment (Render)

BDayPing is optimized for Render's Free Web Service tier.

1. Push your code to a GitHub repository.
2. Create a new **Web Service** on Render and connect your repository.
3. Set the Build Command to `npm install`.
4. Set the Start Command to `npm start`.
5. Add all your Environment Variables (`MONGO_URI`, `OWNER_JID`, `TZ`). Render will automatically provide the `PORT`.
6. Once deployed, open the Render logs to scan the QR code for your initial login.

### Preventing Free Tier Sleep
Render's free tier spins down after 15 minutes of inactivity. To prevent this:
1. Create a free account on [UptimeRobot](https://uptimerobot.com/).
2. Add a new HTTP(s) Monitor pointing to your Render URL's `/ping` route (e.g., `https://your-app.onrender.com/ping`).
3. Set the interval to **14 minutes**.

## 📝 License

MIT License
