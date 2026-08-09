const mongoose = require('mongoose');

const uri = "mongodb+srv://hvanhau308_db_user:GkCOfQfqyC9g81tq@cluster0.wewljr5.mongodb.net/?appName=Cluster0";

async function testConnection() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
