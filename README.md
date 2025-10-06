# Manifiestos Interactivos

Plataforma web interactiva para visualizar y vincular dos manifiestos en un canvas infinito navegable.

## Características

- **Canvas infinito navegable**: Mantén presionada la barra espaciadora y arrastra para moverte por el espacio
- **Anotaciones con Hypothesis.is**: Subraya palabras o frases y añade comentarios
- **Vinculaciones entre párrafos**: Selecciona párrafos de diferentes documentos para crear conexiones visuales
- **Sistema de comentarios**: Comenta sobre las vinculaciones y responde a otros usuarios
- **Autenticación por email**: Registro con verificación de email

## Requisitos

- Node.js (versión 14 o superior)
- npm o yarn

## Instalación

1. Navega al directorio del proyecto:
```bash
cd web-interactiva
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno (opcional para desarrollo):
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales SMTP si quieres habilitar el envío de emails de verificación. Si no configuras esto, la aplicación funcionará igual pero los enlaces de verificación se mostrarán en la respuesta del registro.

## Uso

### Modo desarrollo

```bash
npm run dev
```

### Modo producción

```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## Cómo usar la plataforma

1. **Navegar por el canvas**: Mantén presionada la barra espaciadora y arrastra con el mouse para moverte
2. **Registrarse**: Haz clic en "Registrarse", completa el formulario y verifica tu email
3. **Iniciar sesión**: Una vez verificado, inicia sesión con tus credenciales
4. **Crear vinculaciones**:
   - Haz clic en un párrafo del Manifiesto 1
   - Luego haz clic en un párrafo del Manifiesto 2
   - Se creará una línea visual conectándolos
5. **Comentar vinculaciones**: Haz clic en el globo 💬 en medio de la línea
6. **Usar Hypothesis.is**: Selecciona cualquier texto para anotarlo (funciona automáticamente)

## Estructura del proyecto

```
web-interactiva/
├── server.js              # Servidor Express y API
├── package.json           # Dependencias del proyecto
├── manifiestos.db         # Base de datos SQLite (se crea automáticamente)
├── public/
│   ├── index.html         # Interfaz principal
│   ├── Manifiesto 1.html  # Documento convertido
│   ├── Manifiesto 2.html  # Documento convertido
│   ├── css/
│   │   └── style.css      # Estilos
│   └── js/
│       └── app.js         # Lógica del frontend
└── data/                  # (Reservado para datos adicionales)
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/verify/:token` - Verificar email
- `POST /api/auth/login` - Iniciar sesión

### Vinculaciones
- `POST /api/links` - Crear vinculación
- `GET /api/links` - Obtener todas las vinculaciones

### Comentarios
- `POST /api/links/:linkId/comments` - Crear comentario
- `GET /api/links/:linkId/comments` - Obtener comentarios

## Despliegue

Para desplegar en producción:

1. Configura las variables de entorno en tu servidor
2. Instala las dependencias: `npm install --production`
3. Inicia el servidor: `npm start`
4. Considera usar PM2 o similar para mantener el proceso activo:
   ```bash
   npm install -g pm2
   pm2 start server.js
   ```

## Licencia

MIT
