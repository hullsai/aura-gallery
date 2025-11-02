import { createUser } from './auth.js';
import { initializeDatabase } from './db.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('\n🎨 Aura Gallery - Initial Setup\n');
  console.log('Creating database and initial users...\n');

  try {
    // Initialize database
    await initializeDatabase();
    console.log('✓ Database initialized\n');

    // Create admin user
    console.log('Creating admin user...');
    const adminPassword = await question('Enter password for "admin": ');
    await createUser('admin', adminPassword);
    console.log('✓ User "admin" created\n');

    // Create home user
    console.log('Creating home user...');
    const homePassword = await question('Enter password for "home": ');
    await createUser('home', homePassword);
    console.log('✓ User "home" created\n');

    console.log('✅ Setup complete! You can now start the server with: npm start\n');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

setup();