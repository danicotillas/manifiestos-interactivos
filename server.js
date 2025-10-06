const express = require('express');
const Database = require('better-sqlite3');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Credenciales de admin
const ADMIN_PASSWORD = '1234';
const ADMIN_ID = 1;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Inicializar base de datos SQLite
const db = new Database('manifiestos.db');

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_paragraph TEXT NOT NULL,
    to_paragraph TEXT NOT NULL,
    from_document TEXT NOT NULL,
    to_document TEXT NOT NULL,
    author_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS link_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    parent_comment_id INTEGER,
    approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id),
    FOREIGN KEY (parent_comment_id) REFERENCES link_comments(id)
  );
`);

// === RUTAS DE AUTENTICACIÓN ===

// Login simple para admin
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      res.json({
        userId: ADMIN_ID,
        nickname: 'Admin',
        isAdmin: true
      });
    } else {
      res.status(401).json({ error: 'Contraseña incorrecta' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// === RUTAS DE VINCULACIONES ===

// Crear vinculación entre párrafos (todos los usuarios)
app.post('/api/links', (req, res) => {
  try {
    const { fromParagraph, toParagraph, fromDocument, toDocument, isAdmin, authorName } = req.body;

    console.log('POST /api/links - Body recibido:', req.body);

    if (!fromParagraph || !toParagraph) {
      console.log('Error: Datos incompletos');
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const stmt = db.prepare('INSERT INTO links (from_paragraph, to_paragraph, from_document, to_document, author_name) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(fromParagraph, toParagraph, fromDocument, toDocument, authorName || 'Anónimo');

    console.log('Vinculación creada con ID:', result.lastInsertRowid);

    res.json({
      linkId: result.lastInsertRowid,
      message: 'Vinculación creada exitosamente'
    });
  } catch (error) {
    console.error('Error al crear vinculación:', error);
    res.status(500).json({ error: 'Error al crear vinculación: ' + error.message });
  }
});

// Obtener todas las vinculaciones
app.get('/api/links', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT *
      FROM links
      ORDER BY created_at DESC
    `);
    const links = stmt.all();
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vinculaciones' });
  }
});

// Eliminar vinculación (solo admin)
app.delete('/api/links/:linkId', (req, res) => {
  try {
    const { linkId } = req.params;
    const { isAdmin } = req.body;

    if (!isAdmin) {
      return res.status(403).json({ error: 'Solo el admin puede eliminar vinculaciones' });
    }

    // Primero eliminar los comentarios asociados
    const deleteCommentsStmt = db.prepare('DELETE FROM link_comments WHERE link_id = ?');
    deleteCommentsStmt.run(linkId);

    // Luego eliminar la vinculación
    const deleteLinkStmt = db.prepare('DELETE FROM links WHERE id = ?');
    deleteLinkStmt.run(linkId);

    res.json({ message: 'Vinculación eliminada' });
  } catch (error) {
    console.error('Error al eliminar vinculación:', error);
    res.status(500).json({ error: 'Error al eliminar vinculación' });
  }
});

// === RUTAS DE COMENTARIOS EN VINCULACIONES ===

// Crear comentario en una vinculación
app.post('/api/links/:linkId/comments', (req, res) => {
  try {
    const { linkId } = req.params;
    const { authorName, commentText, parentCommentId } = req.body;

    if (!authorName || !commentText) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const stmt = db.prepare('INSERT INTO link_comments (link_id, author_name, comment_text, parent_comment_id, approved) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(linkId, authorName, commentText, parentCommentId || null, 0);

    res.json({
      commentId: result.lastInsertRowid,
      message: 'Comentario enviado. Pendiente de aprobación.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear comentario' });
  }
});

// Obtener comentarios aprobados de una vinculación
app.get('/api/links/:linkId/comments', (req, res) => {
  try {
    const { linkId } = req.params;

    const stmt = db.prepare(`
      SELECT *
      FROM link_comments
      WHERE link_id = ? AND approved = 1
      ORDER BY created_at ASC
    `);
    const comments = stmt.all(linkId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Obtener comentarios pendientes (solo admin)
app.get('/api/admin/comments/pending', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT c.*
      FROM link_comments c
      WHERE c.approved = 0
      ORDER BY c.created_at DESC
    `);
    const comments = stmt.all();
    res.json(comments);
  } catch (error) {
    console.error('Error al obtener comentarios pendientes:', error);
    res.status(500).json({ error: 'Error al obtener comentarios pendientes: ' + error.message });
  }
});

// Aprobar comentario (solo admin)
app.post('/api/admin/comments/:commentId/approve', (req, res) => {
  try {
    const { commentId } = req.params;
    const { isAdmin } = req.body;

    if (!isAdmin) {
      return res.status(403).json({ error: 'Solo el admin puede aprobar comentarios' });
    }

    const stmt = db.prepare('UPDATE link_comments SET approved = 1 WHERE id = ?');
    const result = stmt.run(commentId);

    res.json({ message: 'Comentario aprobado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar comentario' });
  }
});

// Rechazar/eliminar comentario (solo admin)
app.delete('/api/admin/comments/:commentId', (req, res) => {
  try {
    const { commentId } = req.params;
    const { isAdmin } = req.body;

    if (!isAdmin) {
      return res.status(403).json({ error: 'Solo el admin puede eliminar comentarios' });
    }

    const stmt = db.prepare('DELETE FROM link_comments WHERE id = ?');
    stmt.run(commentId);

    res.json({ message: 'Comentario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

// Servir página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
