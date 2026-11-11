import { connectDB, disconnectDB } from '../db.js';
import { seedDatabase } from './seed.js';

const run = async () => {
  await connectDB();
  const result = await seedDatabase({ reset: true });
  console.log('\nStudioSpace demo data reseeded.');
  console.log(`  Studios : ${result.studios}`);
  console.log(`  Reviews : ${result.reviews}`);
  console.log(`  Bookings: ${result.bookings}`);
  console.log(`\n  Examiner: ${result.credentials.examiner}`);
  console.log(`  Host    : ${result.credentials.host}\n`);
  await disconnectDB();
};

run().catch(async (error) => {
  console.error('[seed] Failed:', error);
  await disconnectDB();
  process.exit(1);
});
