import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new sqlite3.Database(join(__dirname, 'aura-gallery.db'));

// Initialize database schema
export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);

      // Images table
      db.run(`
        CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id INTEGER NOT NULL,
          filepath TEXT NOT NULL,
          filename TEXT NOT NULL,
          workflow_json TEXT,
          prompt_text TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          file_created_at DATETIME,
          FOREIGN KEY (owner_id) REFERENCES users(id)
        )
      `);

      // Shared images table
      db.run(`
        CREATE TABLE IF NOT EXISTS shared_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_id INTEGER NOT NULL,
          shared_with_user_id INTEGER NOT NULL,
          shared_by_user_id INTEGER NOT NULL,
          shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
          FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
          FOREIGN KEY (shared_by_user_id) REFERENCES users(id),
          UNIQUE(image_id, shared_with_user_id)
        )
      `);

      // Tags table
      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          image_id INTEGER NOT NULL,
          tag_name TEXT NOT NULL,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
        )
      `);

      // Favorites table
      db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
          user_id INTEGER NOT NULL,
          image_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, image_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_images_owner ON images(owner_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_tags_user_image ON tags(user_id, image_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_shared_images_user ON shared_images(shared_with_user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_images_prompt ON images(prompt_text)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Helper functions for database operations
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export default db;