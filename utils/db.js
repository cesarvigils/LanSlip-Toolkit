const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_name VARCHAR(100) NOT NULL,
            service VARCHAR(100) NOT NULL,
            eta VARCHAR(100) NOT NULL,
            status ENUM('Started', 'Work In Progress', 'QA Waiting', 'Finished') NOT NULL DEFAULT 'Started',
            started_by VARCHAR(32) NOT NULL,
            qa_by VARCHAR(32) NULL,
            finished_by VARCHAR(32) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    // Single-row settings table so the live panel message survives bot restarts
    await pool.query(`
        CREATE TABLE IF NOT EXISTS actions_panel (
            id INT PRIMARY KEY,
            message_id VARCHAR(32) NULL
        )
    `);
    await pool.query(`INSERT IGNORE INTO actions_panel (id, message_id) VALUES (1, NULL)`);
}

module.exports = { pool, initDb };