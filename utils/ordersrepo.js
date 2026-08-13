const { pool } = require('./db');

async function createOrder({ clientName, service, eta, startedBy }) {
    const [result] = await pool.query(
        `INSERT INTO orders (client_name, service, eta, status, started_by) VALUES (?, ?, ?, 'Started', ?)`,
        [clientName, service, eta, startedBy],
    );
    return result.insertId;
}

async function getOrder(orderId) {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    return rows[0] || null;
}

async function setStatus(orderId, status, extra = {}) {
    const fields = ['status = ?'];
    const values = [status];

    if (extra.qaBy) {
        fields.push('qa_by = ?');
        values.push(extra.qaBy);
    }
    if (extra.finishedBy) {
        fields.push('finished_by = ?');
        values.push(extra.finishedBy);
    }

    values.push(orderId);
    await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function getActiveOrders() {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE status != 'Finished' ORDER BY created_at ASC`);
    return rows;
}

async function getPanelMessageId() {
    const [rows] = await pool.query(`SELECT message_id FROM actions_panel WHERE id = 1`);
    return rows[0]?.message_id || null;
}

async function setPanelMessageId(messageId) {
    await pool.query(`UPDATE actions_panel SET message_id = ? WHERE id = 1`, [messageId]);
}

module.exports = { createOrder, getOrder, setStatus, getActiveOrders, getPanelMessageId, setPanelMessageId };