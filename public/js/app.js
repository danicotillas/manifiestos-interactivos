// Estado global de la aplicación
const state = {
    user: null,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    canvasOffset: { x: 0, y: 0 },
    selectedParagraph: null,
    links: [],
    currentLinkId: null,
    bubbleOffsets: {}, // Almacenar desplazamientos personalizados de globos
    linkColors: {}, // Almacenar índice de color de cada link
    linkBubbleOffsets: {}, // Almacenar offset horizontal de cada burbuja
    isDraggingBubble: false,
    linksVisible: true
};

// Paleta de colores para múltiples vinculaciones
const BUBBLE_COLORS = [
    '#4a90e2', // azul (default)
    '#e2674a', // rojo
    '#4ae28f', // verde
    '#e2c74a', // amarillo
    '#9b4ae2', // morado
    '#e24a9b', // rosa
    '#4ae2e2', // cyan
    '#e2a34a'  // naranja
];

// === CARGAR CONTENIDO DE LOS MANIFIESTOS ===

async function loadManifiestos() {
    try {
        console.log('Cargando manifiestos...');

        const response1 = await fetch('manifiesto1-content.html');
        console.log('Response 1 status:', response1.status);
        const content1 = await response1.text();
        console.log('Content 1 length:', content1.length);

        const content1El = document.getElementById('content1');
        console.log('Content1 element:', content1El);

        if (content1El) {
            content1El.innerHTML = content1;
            console.log('Manifiesto 1 cargado');
        }

        const response2 = await fetch('manifiesto2-content.html');
        console.log('Response 2 status:', response2.status);
        const content2 = await response2.text();
        console.log('Content 2 length:', content2.length);

        const content2El = document.getElementById('content2');
        console.log('Content2 element:', content2El);

        if (content2El) {
            content2El.innerHTML = content2;
            console.log('Manifiesto 2 cargado');
        }

        // Preparar párrafos para interacción
        console.log('Configurando interacción de documentos...');
        setupDocumentInteraction();

        console.log('Cargando vinculaciones existentes...');
        loadExistingLinks();
    } catch (error) {
        console.error('Error al cargar manifiestos:', error);
    }
}

// === CANVAS INFINITO ===

const canvas = document.getElementById('infinite-canvas');

// Detectar si el click es fuera de los manifiestos
function isOutsideDocuments(target) {
    // Verificar si el click es en un documento o dentro de uno
    return !target.closest('.document') && !target.closest('.modal') && !target.closest('.comment-bubble');
}

canvas.addEventListener('mousedown', (e) => {
    if (isOutsideDocuments(e.target)) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        canvas.classList.add('panning');
        canvas.style.cursor = 'grabbing';
    }
});

document.addEventListener('mousemove', (e) => {
    if (state.isPanning) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;

        state.canvasOffset.x += dx;
        state.canvasOffset.y += dy;
        state.panStart = { x: e.clientX, y: e.clientY };

        updateCanvasPosition();
    }
});

document.addEventListener('mouseup', () => {
    if (state.isPanning) {
        state.isPanning = false;
        canvas.classList.remove('panning');
        canvas.style.cursor = 'default';
    }
});

function updateCanvasPosition() {
    const documents = canvas.querySelectorAll('.document');
    documents.forEach(doc => {
        doc.style.transform = `translate(${state.canvasOffset.x}px, ${state.canvasOffset.y}px)`;
    });
    updateLinks();
}

// === AUTENTICACIÓN ===

const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const pendingBtn = document.getElementById('pending-btn');

loginBtn.addEventListener('click', () => openModal('login-modal'));
logoutBtn.addEventListener('click', logout);
pendingBtn.addEventListener('click', () => {
    openModal('pending-modal');
    loadPendingComments();
});

document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        const modalId = e.target.dataset.modal;
        closeModal(modalId);
    });
});

// Cerrar modales al hacer click fuera de ellos
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        const messageEl = document.getElementById('login-message');

        if (response.ok) {
            state.user = data;
            localStorage.setItem('user', JSON.stringify(data));
            updateUserUI();
            closeModal('login-modal');
            messageEl.textContent = '';
            document.getElementById('login-form').reset();
            if (data.isAdmin) {
                checkPendingComments();
            }
        } else {
            messageEl.className = 'form-message error';
            messageEl.textContent = data.error;
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('login-message').textContent = 'Error al iniciar sesión';
    }
});

function logout() {
    state.user = null;
    localStorage.removeItem('user');
    updateUserUI();
}

function updateUserUI() {
    const userInfo = document.getElementById('user-info');

    if (state.user) {
        document.getElementById('username-display').textContent = `${state.user.nickname}`;
        userInfo.style.display = 'flex';
        loginBtn.style.display = 'none';
        if (state.user.isAdmin) {
            pendingBtn.style.display = 'inline-block';
        }
    } else {
        userInfo.style.display = 'none';
        loginBtn.style.display = 'inline-block';
        pendingBtn.style.display = 'none';
    }
}

const savedUser = localStorage.getItem('user');
if (savedUser) {
    state.user = JSON.parse(savedUser);
    updateUserUI();
    if (state.user.isAdmin) {
        checkPendingComments();
    }
}

// === VINCULACIONES ENTRE PÁRRAFOS ===

function setupDocumentInteraction() {
    const content1 = document.getElementById('content1');
    const content2 = document.getElementById('content2');

    [content1, content2].forEach((content, index) => {
        const paragraphs = content.querySelectorAll('p');
        const docName = index === 0 ? 'manifiesto1' : 'manifiesto2';

        paragraphs.forEach((p, pIndex) => {
            p.setAttribute('data-doc', docName);
            p.setAttribute('data-paragraph-id', pIndex);
            p.classList.add('selectable-paragraph');

            p.addEventListener('click', (e) => {
                if (!state.isPanning) {
                    handleParagraphClick(p, e);
                }
            });
        });
    });
}

function handleParagraphClick(paragraph, event) {
    // Permitir a todos los usuarios crear vinculaciones
    const docName = paragraph.getAttribute('data-doc');
    const paragraphId = paragraph.getAttribute('data-paragraph-id');

    console.log('Clic en párrafo:', { docName, paragraphId });

    if (!state.selectedParagraph) {
        state.selectedParagraph = {
            element: paragraph,
            doc: docName,
            id: paragraphId,
            text: paragraph.textContent.substring(0, 100)
        };
        paragraph.classList.add('selected');
        console.log('Primer párrafo seleccionado:', state.selectedParagraph);
    } else {
        if (state.selectedParagraph.doc === docName) {
            alert('Debes seleccionar un párrafo del otro documento');
            return;
        }

        console.log('Creando vinculación entre:', state.selectedParagraph.doc, 'y', docName);

        createLink(state.selectedParagraph, {
            element: paragraph,
            doc: docName,
            id: paragraphId,
            text: paragraph.textContent.substring(0, 100)
        });

        state.selectedParagraph.element.classList.remove('selected');
        state.selectedParagraph = null;
    }
}

async function createLink(from, to) {
    console.log('createLink llamado con:', { from, to });

    try {
        const payload = {
            fromParagraph: from.id,
            toParagraph: to.id,
            fromDocument: from.doc,
            toDocument: to.doc,
            authorName: state.user ? state.user.nickname : 'Anónimo'
        };

        console.log('Enviando payload:', payload);

        const response = await fetch('/api/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Respuesta del servidor:', data);

        if (response.ok) {
            console.log('Vinculación creada con ID:', data.linkId);

            state.links.push({
                id: data.linkId,
                from: from,
                to: to
            });

            console.log('Dibujando línea...');
            drawLink(from.element, to.element, data.linkId);
            alert('Vinculación creada exitosamente');
        } else {
            console.error('Error del servidor:', data.error);
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error en createLink:', error);
        alert('Error al crear vinculación: ' + error.message);
    }
}

function drawLink(fromElement, toElement, linkId, colorIndex = 0, bubbleOffset = 0) {
    console.log('drawLink llamado:', { fromElement, toElement, linkId, colorIndex, bubbleOffset });

    if (!fromElement || !toElement) {
        console.error('Elementos no definidos en drawLink');
        return;
    }

    // Guardar color y offset de burbuja en el estado
    state.linkColors[linkId] = colorIndex;
    state.linkBubbleOffsets[linkId] = bubbleOffset;

    const color = BUBBLE_COLORS[colorIndex % BUBBLE_COLORS.length];
    const svg = document.getElementById('links-svg');
    const canvasRect = canvas.getBoundingClientRect();
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    console.log('Rectángulos:', { canvasRect, fromRect, toRect });

    // Calcular centros
    const fromCenterX = fromRect.left + fromRect.width / 2 - canvasRect.left;
    const fromCenterY = fromRect.top + fromRect.height / 2 - canvasRect.top;
    const toCenterX = toRect.left + toRect.width / 2 - canvasRect.left;
    const toCenterY = toRect.top + toRect.height / 2 - canvasRect.top;

    // Calcular el punto en el borde del párrafo origen
    const fromEdge = getEdgePoint(fromRect, canvasRect, toCenterX + canvasRect.left, toCenterY + canvasRect.top);
    const toEdge = getEdgePoint(toRect, canvasRect, fromCenterX + canvasRect.left, fromCenterY + canvasRect.top);

    const x1 = fromEdge.x;
    const y1 = fromEdge.y;
    const x2 = toEdge.x;
    const y2 = toEdge.y;

    console.log('Coordenadas calculadas:', { x1, y1, x2, y2 });

    // Calcular punto de control de la curva (puede estar desplazado)
    const offset = state.bubbleOffsets[linkId] || { x: 0, y: 0 };
    const midX = (fromCenterX + toCenterX) / 2;
    const midY = (fromCenterY + toCenterY) / 2;

    // Curva por defecto: desplazar el punto de control perpendicular a la línea
    const defaultCurveAmount = 50 + (colorIndex * 30); // Más curvatura para cada color
    const dx = x2 - x1;
    const dy = y2 - y1;
    const perpX = -dy / Math.sqrt(dx * dx + dy * dy) * defaultCurveAmount;
    const perpY = dx / Math.sqrt(dx * dx + dy * dy) * defaultCurveAmount;

    const controlX = midX + offset.x + perpX;
    const controlY = midY + offset.y + perpY;

    // Crear path curvo
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Curva cuadrática de Bézier
    const pathD = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;

    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.classList.add('link-line');
    path.setAttribute('data-link-id', linkId);
    path.setAttribute('stroke', color);
    path.setAttribute('marker-end', `url(#arrowhead-${colorIndex})`);
    svg.appendChild(path);

    console.log('Path SVG curvo añadido');

    // Calcular el punto medio de la curva de Bézier (t=0.5)
    // Para una curva cuadrática: B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
    const bubbleCenterX = 0.25 * x1 + 0.5 * controlX + 0.25 * x2;
    const bubbleCenterY = 0.25 * y1 + 0.5 * controlY + 0.25 * y2;

    // Posicionar el globo en el punto medio de la curva con offset horizontal
    const bubbleX = bubbleCenterX - 20 + (bubbleOffset * 45);
    const bubbleY = bubbleCenterY - 20;

    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble';
    bubble.style.left = bubbleX + 'px';
    bubble.style.top = bubbleY + 'px';
    bubble.style.borderColor = color;
    bubble.style.color = color;
    bubble.setAttribute('data-link-id', linkId);
    bubble.setAttribute('data-color-index', colorIndex);

    // Hacer el globo arrastrable
    makeBubbleDraggable(bubble, linkId, midX - 20, midY - 20);

    bubble.addEventListener('click', (e) => {
        if (!state.isDraggingBubble) {
            openLinkComments(linkId);
        }
    });

    canvas.appendChild(bubble);
    console.log('Globo de comentario añadido en:', { bubbleX, bubbleY, color });
}

function getEdgePoint(rect, canvasRect, targetX, targetY) {
    // Centro del rectángulo
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Vector hacia el objetivo
    const dx = targetX - centerX;
    const dy = targetY - centerY;

    // Normalizar
    const distance = Math.sqrt(dx * dx + dy * dy);
    const unitX = dx / distance;
    const unitY = dy / distance;

    // Calcular intersección con el borde del rectángulo
    let edgeX, edgeY;

    // Determinar qué borde intersecta
    const angleToTarget = Math.atan2(dy, dx);
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;

    if (Math.abs(unitX) * halfHeight > Math.abs(unitY) * halfWidth) {
        // Intersección con borde izquierdo o derecho
        if (dx > 0) {
            edgeX = rect.right;
            edgeY = centerY + (edgeX - centerX) * (dy / dx);
        } else {
            edgeX = rect.left;
            edgeY = centerY + (edgeX - centerX) * (dy / dx);
        }
    } else {
        // Intersección con borde superior o inferior
        if (dy > 0) {
            edgeY = rect.bottom;
            edgeX = centerX + (edgeY - centerY) * (dx / dy);
        } else {
            edgeY = rect.top;
            edgeX = centerX + (edgeY - centerY) * (dx / dy);
        }
    }

    return {
        x: edgeX - canvasRect.left,
        y: edgeY - canvasRect.top
    };
}

function makeBubbleDraggable(bubble, linkId, originalX, originalY) {
    let isDragging = false;
    let dragStartX, dragStartY;
    let bubbleStartX, bubbleStartY;

    bubble.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Solo botón izquierdo
            isDragging = true;
            state.isDraggingBubble = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const currentLeft = parseFloat(bubble.style.left);
            const currentTop = parseFloat(bubble.style.top);
            bubbleStartX = currentLeft;
            bubbleStartY = currentTop;

            e.stopPropagation();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            state.isDraggingBubble = true;

            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            const newX = bubbleStartX + dx;
            const newY = bubbleStartY + dy;

            bubble.style.left = newX + 'px';
            bubble.style.top = newY + 'px';

            // La burbuja ahora está en (newX + 20, newY + 20) (centro de la burbuja)
            // Queremos que esta sea la posición del punto medio de la curva de Bézier
            // Necesitamos calcular el offset del punto de control

            // Obtener el link para acceder a los puntos de inicio y fin
            const link = state.links.find(l => l.id == linkId);
            if (link && link.from && link.from.element && link.to && link.to.element) {
                const canvasRect = canvas.getBoundingClientRect();
                const fromRect = link.from.element.getBoundingClientRect();
                const toRect = link.to.element.getBoundingClientRect();

                const fromCenterX = fromRect.left + fromRect.width / 2 - canvasRect.left;
                const fromCenterY = fromRect.top + fromRect.height / 2 - canvasRect.top;
                const toCenterX = toRect.left + toRect.width / 2 - canvasRect.left;
                const toCenterY = toRect.top + toRect.height / 2 - canvasRect.top;

                const fromEdge = getEdgePoint(fromRect, canvasRect, toCenterX + canvasRect.left, toCenterY + canvasRect.top);
                const toEdge = getEdgePoint(toRect, canvasRect, fromCenterX + canvasRect.left, fromCenterY + canvasRect.top);

                // Donde queremos que esté el punto medio de la curva (centro de la burbuja)
                const desiredMidX = newX + 20;
                const desiredMidY = newY + 20;

                // Calcular el punto de control necesario para que B(0.5) = desiredMid
                // B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
                // P1 = 2*B(0.5) - 0.5*P0 - 0.5*P2
                const controlX = 2 * desiredMidX - 0.5 * fromEdge.x - 0.5 * toEdge.x;
                const controlY = 2 * desiredMidY - 0.5 * fromEdge.y - 0.5 * toEdge.y;

                // Guardar el offset del punto de control respecto al punto medio entre los centros
                const midX = (fromCenterX + toCenterX) / 2;
                const midY = (fromCenterY + toCenterY) / 2;

                state.bubbleOffsets[linkId] = {
                    x: controlX - midX,
                    y: controlY - midY
                };
            }

            // Actualizar la curva de la línea en tiempo real
            updateSingleLink(linkId);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            setTimeout(() => {
                state.isDraggingBubble = false;
            }, 100);
        }
    });
}

function updateSingleLink(linkId) {
    // Buscar el link específico
    const link = state.links.find(l => l.id == linkId);
    if (!link || !link.from || !link.from.element || !link.to || !link.to.element) {
        return;
    }

    // Obtener el índice de color y offset de burbuja del estado
    const colorIndex = state.linkColors[linkId] || 0;
    const bubbleOffset = state.linkBubbleOffsets[linkId] || 0;
    const color = BUBBLE_COLORS[colorIndex % BUBBLE_COLORS.length];

    // Eliminar solo el path de este link
    const svg = document.getElementById('links-svg');
    const oldPath = svg.querySelector(`path[data-link-id="${linkId}"]`);
    if (oldPath) {
        oldPath.remove();
    }

    // Recalcular y redibujar solo esta línea
    const canvasRect = canvas.getBoundingClientRect();
    const fromRect = link.from.element.getBoundingClientRect();
    const toRect = link.to.element.getBoundingClientRect();

    const fromCenterX = fromRect.left + fromRect.width / 2 - canvasRect.left;
    const fromCenterY = fromRect.top + fromRect.height / 2 - canvasRect.top;
    const toCenterX = toRect.left + toRect.width / 2 - canvasRect.left;
    const toCenterY = toRect.top + toRect.height / 2 - canvasRect.top;

    const fromEdge = getEdgePoint(fromRect, canvasRect, toCenterX + canvasRect.left, toCenterY + canvasRect.top);
    const toEdge = getEdgePoint(toRect, canvasRect, fromCenterX + canvasRect.left, fromCenterY + canvasRect.top);

    // Calcular punto de control de la curva
    const offset = state.bubbleOffsets[linkId] || { x: 0, y: 0 };
    const midX = (fromCenterX + toCenterX) / 2;
    const midY = (fromCenterY + toCenterY) / 2;

    // Curva por defecto
    const defaultCurveAmount = 50 + (colorIndex * 30);
    const dx = toEdge.x - fromEdge.x;
    const dy = toEdge.y - fromEdge.y;
    const perpX = -dy / Math.sqrt(dx * dx + dy * dy) * defaultCurveAmount;
    const perpY = dx / Math.sqrt(dx * dx + dy * dy) * defaultCurveAmount;

    const controlX = midX + offset.x + perpX;
    const controlY = midY + offset.y + perpY;

    // Dibujar la curva con el color correcto
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathD = `M ${fromEdge.x} ${fromEdge.y} Q ${controlX} ${controlY} ${toEdge.x} ${toEdge.y}`;

    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.classList.add('link-line');
    path.setAttribute('data-link-id', linkId);
    path.setAttribute('stroke', color);
    path.setAttribute('marker-end', `url(#arrowhead-${colorIndex})`);
    svg.appendChild(path);

    // Calcular el punto medio de la curva para posicionar la burbuja
    const bubbleCenterX = 0.25 * fromEdge.x + 0.5 * controlX + 0.25 * toEdge.x;
    const bubbleCenterY = 0.25 * fromEdge.y + 0.5 * controlY + 0.25 * toEdge.y;

    // Reposicionar la burbuja en el punto medio de la curva con offset horizontal
    const existingBubble = canvas.querySelector(`.comment-bubble[data-link-id="${linkId}"]`);
    if (existingBubble) {
        existingBubble.style.left = (bubbleCenterX - 20 + (bubbleOffset * 45)) + 'px';
        existingBubble.style.top = (bubbleCenterY - 20) + 'px';
    }
}

function updateLinks() {
    const svg = document.getElementById('links-svg');

    // Preservar los marcadores de colores
    svg.innerHTML = `
        <defs>
            <marker id="arrowhead-0" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4a90e2" />
            </marker>
            <marker id="arrowhead-1" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#e2674a" />
            </marker>
            <marker id="arrowhead-2" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4ae28f" />
            </marker>
            <marker id="arrowhead-3" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#e2c74a" />
            </marker>
            <marker id="arrowhead-4" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#9b4ae2" />
            </marker>
            <marker id="arrowhead-5" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#e24a9b" />
            </marker>
            <marker id="arrowhead-6" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4ae2e2" />
            </marker>
            <marker id="arrowhead-7" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#e2a34a" />
            </marker>
        </defs>
    `;

    document.querySelectorAll('.comment-bubble').forEach(b => b.remove());

    state.links.forEach(link => {
        if (link.from && link.from.element && link.to && link.to.element) {
            // Usar el color y offset guardados en el estado
            const colorIndex = state.linkColors[link.id] || 0;
            const bubbleOffset = state.linkBubbleOffsets[link.id] || 0;
            drawLink(link.from.element, link.to.element, link.id, colorIndex, bubbleOffset);
        }
    });
}

// === COMENTARIOS EN VINCULACIONES ===

const linkCommentModal = document.getElementById('link-comment-modal');

async function openLinkComments(linkId) {
    state.currentLinkId = linkId;

    // Mostrar u ocultar botón de eliminar vinculación según sea admin
    const deleteLinkBtn = document.getElementById('delete-link-btn');
    if (state.user && state.user.isAdmin) {
        deleteLinkBtn.style.display = 'block';
    } else {
        deleteLinkBtn.style.display = 'none';
    }

    openModal('link-comment-modal');
    await loadLinkComments(linkId);
}

async function loadLinkComments(linkId) {
    try {
        const response = await fetch(`/api/links/${linkId}/comments`);
        const comments = await response.json();

        const commentsList = document.getElementById('link-comments-list');
        commentsList.innerHTML = '';

        if (comments.length === 0) {
            commentsList.innerHTML = '<p style="color: #999;">No hay comentarios aprobados aún.</p>';
        } else {
            comments.forEach(comment => {
                const commentEl = createCommentElement(comment);
                commentsList.appendChild(commentEl);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment';

    const authorEl = document.createElement('div');
    authorEl.className = 'comment-author';
    authorEl.textContent = comment.author_name;

    const textEl = document.createElement('div');
    textEl.className = 'comment-text';
    textEl.textContent = comment.comment_text;

    const dateEl = document.createElement('div');
    dateEl.className = 'comment-date';
    dateEl.textContent = new Date(comment.created_at).toLocaleString('es-ES');

    div.appendChild(authorEl);
    div.appendChild(textEl);
    div.appendChild(dateEl);

    // Si el usuario es admin, añadir botón de eliminar
    if (state.user && state.user.isAdmin) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-delete';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.style.marginTop = '0.5rem';
        deleteBtn.style.padding = '0.3rem 0.8rem';
        deleteBtn.style.fontSize = '0.8rem';
        deleteBtn.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
                await deleteComment(comment.id, comment.link_id);
            }
        });
        div.appendChild(deleteBtn);
    }

    return div;
}

async function deleteComment(commentId, linkId) {
    try {
        const response = await fetch(`/api/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAdmin: state.user.isAdmin })
        });

        if (response.ok) {
            // Recargar los comentarios
            await loadLinkComments(linkId);
        } else {
            alert('Error al eliminar el comentario');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar el comentario');
    }
}

async function deleteLink(linkId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta vinculación? Se eliminarán también todos sus comentarios.')) {
        return;
    }

    try {
        const response = await fetch(`/api/links/${linkId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAdmin: state.user.isAdmin })
        });

        if (response.ok) {
            // Cerrar modal
            closeModal('link-comment-modal');
            // Recargar la página para actualizar las vinculaciones
            window.location.reload();
        } else {
            alert('Error al eliminar la vinculación');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar la vinculación');
    }
}

document.getElementById('delete-link-btn').addEventListener('click', async () => {
    if (state.currentLinkId) {
        await deleteLink(state.currentLinkId);
    }
});

document.getElementById('submit-link-comment').addEventListener('click', async () => {
    const authorName = document.getElementById('comment-author-name').value.trim();
    const commentText = document.getElementById('link-comment-text').value.trim();
    const messageEl = document.getElementById('comment-message');

    if (!authorName || !commentText) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Por favor completa todos los campos';
        return;
    }

    try {
        const response = await fetch(`/api/links/${state.currentLinkId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorName, commentText })
        });

        const data = await response.json();

        if (response.ok) {
            messageEl.className = 'form-message success';
            messageEl.textContent = data.message;
            document.getElementById('comment-author-name').value = '';
            document.getElementById('link-comment-text').value = '';

            if (state.user && state.user.isAdmin) {
                checkPendingComments();
            }
        } else {
            messageEl.className = 'form-message error';
            messageEl.textContent = data.error;
        }
    } catch (error) {
        console.error('Error:', error);
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Error al enviar comentario';
    }
});

// === ADMIN: GESTIÓN DE COMENTARIOS PENDIENTES ===

async function checkPendingComments() {
    try {
        const response = await fetch('/api/admin/comments/pending');
        const pending = await response.json();
        document.getElementById('pending-count').textContent = pending.length;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadPendingComments() {
    try {
        const response = await fetch('/api/admin/comments/pending');
        const comments = await response.json();

        const list = document.getElementById('pending-comments-list');
        list.innerHTML = '';

        if (comments.length === 0) {
            list.innerHTML = '<p style="color: #999;">No hay comentarios pendientes</p>';
        } else {
            comments.forEach(comment => {
                const div = document.createElement('div');
                div.className = 'comment';
                div.innerHTML = `
                    <div class="comment-author">${comment.author_name}</div>
                    <div class="comment-text">${comment.comment_text}</div>
                    <div class="comment-date">${new Date(comment.created_at).toLocaleString('es-ES')}</div>
                    <div style="margin-top: 10px;">
                        <button class="btn" onclick="approveComment(${comment.id})">✓ Aprobar</button>
                        <button class="btn" style="background: #e53935;" onclick="rejectComment(${comment.id})">✗ Rechazar</button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function approveComment(commentId) {
    try {
        const response = await fetch(`/api/admin/comments/${commentId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAdmin: state.user.isAdmin })
        });

        if (response.ok) {
            await loadPendingComments();
            await checkPendingComments();
            if (state.currentLinkId) {
                await loadLinkComments(state.currentLinkId);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function rejectComment(commentId) {
    try {
        const response = await fetch(`/api/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAdmin: state.user.isAdmin })
        });

        if (response.ok) {
            await loadPendingComments();
            await checkPendingComments();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Hacer funciones globales para los botones inline
window.approveComment = approveComment;
window.rejectComment = rejectComment;

// === CARGAR VINCULACIONES EXISTENTES ===

async function loadExistingLinks() {
    try {
        const response = await fetch('/api/links');
        const links = await response.json();

        setTimeout(() => {
            const content1 = document.getElementById('content1');
            const content2 = document.getElementById('content2');

            // Agrupar vinculaciones por párrafos
            const linkGroups = {};

            links.forEach(link => {
                const paragraphs1 = content1.querySelectorAll('p');
                const paragraphs2 = content2.querySelectorAll('p');

                let fromEl, toEl;

                if (link.from_document === 'manifiesto1') {
                    fromEl = paragraphs1[link.from_paragraph];
                    toEl = paragraphs2[link.to_paragraph];
                } else {
                    fromEl = paragraphs2[link.from_paragraph];
                    toEl = paragraphs1[link.to_paragraph];
                }

                if (fromEl && toEl) {
                    // Crear clave única para el par de párrafos
                    const key = `${link.from_document}-${link.from_paragraph}:${link.to_document}-${link.to_paragraph}`;

                    if (!linkGroups[key]) {
                        linkGroups[key] = [];
                    }

                    linkGroups[key].push({
                        id: link.id,
                        from: { element: fromEl, doc: link.from_document, id: link.from_paragraph },
                        to: { element: toEl, doc: link.to_document, id: link.to_paragraph }
                    });
                }
            });

            // Dibujar vinculaciones agrupadas
            Object.values(linkGroups).forEach(group => {
                group.forEach((link, index) => {
                    state.links.push(link);
                    drawLink(link.from.element, link.to.element, link.id, index, index);
                });
            });
        }, 500);
    } catch (error) {
        console.error('Error:', error);
    }
}

// === MOSTRAR/OCULTAR CONEXIONES ===

const toggleLinksBtn = document.getElementById('toggle-links-btn');

toggleLinksBtn.addEventListener('click', () => {
    state.linksVisible = !state.linksVisible;

    const svg = document.getElementById('links-svg');
    const bubbles = document.querySelectorAll('.comment-bubble');

    if (state.linksVisible) {
        svg.style.display = 'block';
        bubbles.forEach(b => b.style.display = 'flex');
        toggleLinksBtn.textContent = '👁️ Ocultar Conexiones';
    } else {
        svg.style.display = 'none';
        bubbles.forEach(b => b.style.display = 'none');
        toggleLinksBtn.textContent = '👁️ Mostrar Conexiones';
    }
});

// === INICIALIZACIÓN ===

loadManifiestos();
window.addEventListener('resize', updateLinks);

// Verificar comentarios pendientes si es admin
if (state.user && state.user.isAdmin) {
    setInterval(checkPendingComments, 30000); // Cada 30 segundos
}
