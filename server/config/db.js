const mongoose = require('mongoose');
const dns = require('dns');

// Configure public DNS servers to prevent querySrv ECONNREFUSED on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if unsupported in environment
}

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1 || isConnecting) return;
  isConnecting = true;
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/Final_Yr_Project';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`\n✅ MongoDB Connected successfully: ${conn.connection.host} | Database: ${conn.connection.name}`);
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    console.error(`\n⚠️  Warning: Could not connect to MongoDB Atlas: ${err.message}`);
    console.error(`💡 Tip: Please whitelist your current IP address (157.51.23.38) or 0.0.0.0/0 in MongoDB Atlas Network Access.\n`);
  }
};

// Auto-retry connection every 15 seconds if offline
setInterval(() => {
  if (mongoose.connection.readyState !== 1 && !isConnecting) {
    connectDB();
  }
}, 15000);

module.exports = connectDB;

