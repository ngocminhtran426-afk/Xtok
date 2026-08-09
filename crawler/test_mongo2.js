const mongoose = require('mongoose');

const uri = "mongodb://hvanhau308_db_user:GkCOfQfqyC9g81tq@ac-bwcnrof-shard-00-00.wewljr5.mongodb.net:27017,ac-bwcnrof-shard-00-01.wewljr5.mongodb.net:27017,ac-bwcnrof-shard-00-02.wewljr5.mongodb.net:27017/?ssl=true&replicaSet=atlas-2q3u0u-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

async function testConnection() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected successfully!");
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({});
    console.log("Users in DB:", users);
    
    process.exit(0);
  } catch (error) {
    console.error("Connection failed:", error);
    process.exit(1);
  }
}

testConnection();
