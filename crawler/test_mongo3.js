const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://hvanhau308_db_user:GkCOfQfqyC9g81tq@cluster0.wewljr5.mongodb.net/?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected successfully to server");
  } catch (err) {
    console.error("Connection Error:", err);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
