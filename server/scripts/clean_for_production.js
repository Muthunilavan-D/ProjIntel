const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function cleanForProduction() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  // 1. Collections to wipe completely for fresh realtime usage
  const collectionsToWipe = [
    'students',
    'faculties',
    'projects',
    'teams',
    'milestones',
    'tasks',
    'documents',
    'reviews',
    'reviewsubmissions',
    'reviewevaluations',
    'weeklyprogresses',
    'notifications',
    'feedbacks'
  ];

  for (const colName of collectionsToWipe) {
    try {
      const res = await mongoose.connection.db.collection(colName).deleteMany({});
      console.log(`Cleared ${colName}: deleted ${res.deletedCount} documents`);
    } catch (err) {
      console.log(`Collection ${colName} error or not found:`, err.message);
    }
  }

  // 2. Set Admin email to muthunilavand555@gmail.com
  const adminsCol = mongoose.connection.db.collection('admins');
  const existingAdmin = await adminsCol.findOne({});
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);

  if (existingAdmin) {
    await adminsCol.updateOne(
      { _id: existingAdmin._id },
      {
        $set: {
          name: 'Academic Administrator',
          email: 'muthunilavand555@gmail.com',
          password: hashedPassword,
          role: 'ADMIN',
          pendingEmail: null,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          resetPasswordOtp: null,
          resetPasswordExpires: null,
          updatedAt: new Date()
        }
      }
    );
    console.log(`Updated admin ${existingAdmin._id} to muthunilavand555@gmail.com with password 'admin123'`);
  } else {
    await adminsCol.insertOne({
      name: 'Academic Administrator',
      email: 'muthunilavand555@gmail.com',
      password: hashedPassword,
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Created new admin muthunilavand555@gmail.com`);
  }

  // 3. Verify counts
  const finalCounts = {};
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    finalCounts[c.name] = await mongoose.connection.db.collection(c.name).countDocuments();
  }
  console.log('Final database counts:', finalCounts);

  const updatedAdmin = await adminsCol.findOne({ email: 'muthunilavand555@gmail.com' });
  console.log('Verified Admin Record:', {
    _id: updatedAdmin._id,
    name: updatedAdmin.name,
    email: updatedAdmin.email,
    role: updatedAdmin.role
  });

  await mongoose.disconnect();
  console.log('Database reset complete for real-time usage!');
}

cleanForProduction().catch(console.error);

