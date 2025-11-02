import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new sqlite3.Database(join(__dirname, 'aura-gallery.db'));

db.run(`ALTER TABLE images ADD COLUMN node_info TEXT`, (err) => {
  if (err) {
    console.error('Migration error:', err);
  } else {
    console.log('✓ Added node_info column to images table');
  }
  db.close();
});