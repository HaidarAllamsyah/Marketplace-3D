// server.js - Pure Node.js Web Server for Lapak 3D
// Handles serving static files and provides API endpoints for uploading/deleting assets.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const LAPAK_DIR = path.join(__dirname, 'lapak3d');

// Ensure upload directories exist
const uploadDir = path.join(LAPAK_DIR, 'uploads');
const modelsDir = path.join(uploadDir, 'models');
const thumbnailsDir = path.join(uploadDir, 'thumbnails');
const RESET_FILE_PATH = path.join(LAPAK_DIR, 'reset.json');
const PRODUCTS_FILE_PATH = path.join(LAPAK_DIR, 'js', 'products.json');
const PRODUCTS_BASELINE_FILE = path.join(LAPAK_DIR, 'js', 'products.default.json');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

function ensureBaselineProducts() {
    if (!fs.existsSync(PRODUCTS_BASELINE_FILE) && fs.existsSync(PRODUCTS_FILE_PATH)) {
        fs.writeFileSync(PRODUCTS_BASELINE_FILE, fs.readFileSync(PRODUCTS_FILE_PATH, 'utf8'), 'utf8');
    }
}

function restoreDefaultProducts() {
    if (fs.existsSync(PRODUCTS_BASELINE_FILE)) {
        fs.writeFileSync(PRODUCTS_FILE_PATH, fs.readFileSync(PRODUCTS_BASELINE_FILE, 'utf8'), 'utf8');
        console.log('[Lapak3D] Produk default dikembalikan ke state awal.');
    }
}

function cleanUploadDirectories() {
    [modelsDir, thumbnailsDir].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            });
        }
    });
}

function writeResetStateFile() {
    const resetPayload = {
        resetId: Date.now().toString(),
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(RESET_FILE_PATH, JSON.stringify(resetPayload, null, 2), 'utf8');
    console.log('[Lapak3D] Reset state generated:', resetPayload.resetId);
}

ensureBaselineProducts();
restoreDefaultProducts();
cleanUploadDirectories();
writeResetStateFile();

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
};

// Helper: Serve Static File
function serveStaticFile(res, filePath) {
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*' // Allow CORS for local dev
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
}

// Helper: Multipart Form Data Parser
function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);
    let searchIndex = 0;

    while (true) {
        const boundaryIndex = buffer.indexOf(boundaryBuffer, searchIndex);
        if (boundaryIndex === -1) break;

        const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
        if (nextBoundaryIndex === -1) break;

        let partStart = boundaryIndex + boundaryBuffer.length;
        let partEnd = nextBoundaryIndex;

        // Trim leading and trailing \r\n
        if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) {
            partStart += 2;
        }
        if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
            partEnd -= 2;
        }

        const partBuffer = buffer.subarray(partStart, partEnd);
        
        // Find boundary of header and body (\r\n\r\n)
        const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEndIndex !== -1) {
            const headersStr = partBuffer.subarray(0, headerEndIndex).toString('utf8');
            const bodyBuffer = partBuffer.subarray(headerEndIndex + 4);

            const headers = {};
            headersStr.split('\r\n').forEach(line => {
                const colIndex = line.indexOf(': ');
                if (colIndex !== -1) {
                    const key = line.substring(0, colIndex).toLowerCase();
                    const val = line.substring(colIndex + 2);
                    headers[key] = val;
                }
            });

            const contentDisposition = headers['content-disposition'];
            if (contentDisposition) {
                const nameMatch = contentDisposition.match(/name="([^"]+)"/);
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                
                const part = {
                    headers,
                    name: nameMatch ? nameMatch[1] : null,
                    filename: filenameMatch ? filenameMatch[1] : null,
                    data: bodyBuffer
                };
                parts.push(part);
            }
        }

        searchIndex = nextBoundaryIndex;
    }
    return parts;
}

// Server logic
const server = http.createServer((req, res) => {
    // 1. API Endpoint: Upload Asset
    if (req.method === 'POST' && req.url === '/api/upload') {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        
        if (!boundaryMatch) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Bad Request: Missing boundary in Content-Type' }));
            return;
        }

        const boundary = boundaryMatch[1];
        const chunks = [];

        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const parts = parseMultipart(buffer, boundary);

                const body = {};
                let modelFile = null;
                let thumbnailFile = null;

                parts.forEach(part => {
                    if (part.filename) {
                        if (part.name === 'modelFile') {
                            modelFile = part;
                        } else if (part.name === 'thumbnailFile') {
                            thumbnailFile = part;
                        }
                    } else {
                        body[part.name] = part.data.toString('utf8');
                    }
                });

                let formats = [];
                if (body.formats) {
                    try { formats = JSON.parse(body.formats); } catch(e) { formats = [body.formats]; }
                }
                let tags = [];
                if (body.tags) {
                    try { tags = JSON.parse(body.tags); } catch(e) { tags = body.tags.split(',').map(t => t.trim()); }
                }

                const newId = Date.now();
                let modelPath = body.model || '';
                let thumbnailPath = body.thumbnail || '';

                // Write 3D model if uploaded
                if (modelFile && modelFile.data.length > 0) {
                    const ext = path.extname(modelFile.filename) || '.glb';
                    const uniqueFilename = `model-${newId}-${Math.round(Math.random() * 1e9)}${ext}`;
                    fs.writeFileSync(path.join(modelsDir, uniqueFilename), modelFile.data);
                    modelPath = 'uploads/models/' + uniqueFilename;
                }

                // Write Thumbnail if uploaded
                if (thumbnailFile && thumbnailFile.data.length > 0) {
                    const ext = path.extname(thumbnailFile.filename) || '.jpg';
                    const uniqueFilename = `thumb-${newId}-${Math.round(Math.random() * 1e9)}${ext}`;
                    fs.writeFileSync(path.join(thumbnailsDir, uniqueFilename), thumbnailFile.data);
                    thumbnailPath = 'uploads/thumbnails/' + uniqueFilename;
                }

                const productsPath = path.join(LAPAK_DIR, 'js', 'products.json');
                let products = [];
                if (fs.existsSync(productsPath)) {
                    products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
                }

                const newProduct = {
                    id: newId,
                    name: body.name || 'Aset Tanpa Nama',
                    creator: body.creator || 'Kreator',
                    category: body.category || 'Lainnya',
                    type: body.type || 'free',
                    price: Number(body.price) || 0,
                    description: body.description || '',
                    tags: tags,
                    model: modelPath,
                    thumbnail: thumbnailPath,
                    format: formats,
                    polycount: body.polycount || '0',
                    rating: 0.0,
                    reviews: 0,
                    downloads: 0,
                    featured: false
                };

                if (body.type === 'auction') {
                    newProduct.startingBid = Number(body.price) || 0;
                    newProduct.currentBid = Number(body.price) || 0;
                    newProduct.bidCount = 0;
                    newProduct.auctionEndTime = body.auctionEndTime || new Date(Date.now() + 30 * 60000).toISOString();
                }

                products.push(newProduct);
                fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, product: newProduct }));
            } catch (error) {
                console.error('Upload Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 2. API Endpoint: Delete Product
    if (req.method === 'POST' && req.url === '/api/delete-product') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', () => {
            try {
                const body = JSON.parse(bodyStr);
                const productId = Number(body.id);
                const creator = body.creator;

                if (!productId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Product ID is required' }));
                    return;
                }

                const productsPath = path.join(LAPAK_DIR, 'js', 'products.json');
                if (!fs.existsSync(productsPath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Products list not found' }));
                    return;
                }

                let products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
                const productIndex = products.findIndex(p => p.id === productId);

                if (productIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Product not found' }));
                    return;
                }

                const product = products[productIndex];

                // Verify ownership (creator matching)
                if (creator && product.creator !== creator) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Unauthorized to delete this product' }));
                    return;
                }

                // Delete model file if uploaded
                if (product.model && product.model.startsWith('uploads/')) {
                    const fileFullPath = path.join(LAPAK_DIR, product.model);
                    if (fs.existsSync(fileFullPath)) {
                        fs.unlinkSync(fileFullPath);
                        console.log('Deleted model file:', fileFullPath);
                    }
                }

                // Delete thumbnail file if uploaded
                if (product.thumbnail && product.thumbnail.startsWith('uploads/')) {
                    const fileFullPath = path.join(LAPAK_DIR, product.thumbnail);
                    if (fs.existsSync(fileFullPath)) {
                        fs.unlinkSync(fileFullPath);
                        console.log('Deleted thumbnail file:', fileFullPath);
                    }
                }

                // Remove from memory list and write back
                products.splice(productIndex, 1);
                fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Aset berhasil dihapus' }));
            } catch (error) {
                console.error('Delete Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 3. Serve Static Files
    let reqUrl = req.url;
    const qIndex = reqUrl.indexOf('?');
    if (qIndex !== -1) {
        reqUrl = reqUrl.substring(0, qIndex);
    }

    if (reqUrl === '/' || reqUrl === '') {
        reqUrl = '/index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(LAPAK_DIR, safePath);

    if (!filePath.startsWith(LAPAK_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Lapak 3D Server running at http://localhost:${PORT}`);
    console.log(`📂 Serving static files from: ${LAPAK_DIR}`);
    console.log(`======================================================\n`);
});
