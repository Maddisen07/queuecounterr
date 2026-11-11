import mongoose from 'mongoose';

let cachedConnection = null;

/**
 * Connects to MongoDB (Atlas or local instance)
 * Caches connection for serverless runtimes (Vercel)
 * @param {string} [uri] - MongoDB URI (defaults to process.env.MONGODB_URI)
 */
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (mongoose.connection.readyState === 1) {
    cachedConnection = mongoose.connection;
    return cachedConnection;
  }

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    const errorMsg = 
      'MongoDB connection string is missing or contains placeholder values (<username>/<password>).\n' +
      'Please update MONGODB_URI in your environment variables with your real MongoDB Atlas connection string.\n' +
      'Example: mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/queuecounter?retryWrites=true&w=majority';
    console.error('\x1b[31m%s\x1b[0m', errorMsg);
    throw new Error('Invalid or unconfigured MONGODB_URI');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false, // In serverless, fail fast if not connected
    });
    cachedConnection = conn;
    console.log(`\x1b[32m✔ Connected to MongoDB successfully:\x1b[0m ${conn.connection.host}`);
    return conn;
  } catch (err) {
    cachedConnection = null;
    console.error('\x1b[31m✖ MongoDB Connection Error:\x1b[0m', err.message);
    throw err;
  }
}

/**
 * Disconnects from MongoDB gracefully
 */
export async function disconnectDB() {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error during MongoDB disconnect:', err);
  }
}
