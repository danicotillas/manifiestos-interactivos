const fs = require('fs');
const path = require('path');

// Leer los archivos HTML
const manifest1 = fs.readFileSync(path.join(__dirname, 'public', 'Manifiesto 1.html'), 'utf-8');
const manifest2 = fs.readFileSync(path.join(__dirname, 'public', 'Manifiesto 2.html'), 'utf-8');

// Extraer solo el contenido del body
function extractBody(html) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
        return bodyMatch[1];
    }
    return html;
}

const content1 = extractBody(manifest1);
const content2 = extractBody(manifest2);

// Guardar como archivos separados para ser cargados
fs.writeFileSync(path.join(__dirname, 'public', 'manifiesto1-content.html'), content1);
fs.writeFileSync(path.join(__dirname, 'public', 'manifiesto2-content.html'), content2);

console.log('Contenido extraído exitosamente');
