import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import * as pdflib from 'pdf-lib';
const { PDFDocument } = pdflib
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ... (tus otros imports y el app.use(cors()))

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

// Cargar configuración de documentos
const dbDocumentos = JSON.parse(fs.readFileSync('./documentos.json', 'utf-8'));

async function getCoordsFromText(pdfBuffer, anchorText) {
    const data = new Uint8Array(pdfBuffer);
    const pdf = await pdfjs.getDocument({ data }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const item = textContent.items.find(item => item.str.includes(anchorText));
        if (item) return { pageIndex: i - 1, x: item.transform[4], y: item.transform[5] };
    }
    return null;
}

// SIRVE EL HTML DESDE EL SERVIDOR
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/configuracion', (req, res) => res.json(dbDocumentos));

app.post('/preparar-firma', upload.single('documento'), async (req, res) => {
    try {
        const { docId } = req.body;
        const config = dbDocumentos.find(d => d.id === docId);
        if (!config) return res.status(400).send('Tipo no encontrado');

        const pdfDoc = await PDFDocument.load(req.file.buffer);
        
        // --- TRUCO DE COMPATIBILIDAD ---
        // Obtenemos el formulario y forzamos la inicialización de campos
        const form = pdfDoc.getForm();
        const pages = pdfDoc.getPages();

        let finalX, finalY, targetPageIndex;
        // ... (Tu lógica de coordenadas se mantiene igual) ...
        if (config.tieneEtiqueta) {
            const coords = await getCoordsFromText(req.file.buffer, config.etiqueta);
            if (!coords) return res.status(422).send('Etiqueta no encontrada');
            finalX = coords.x; finalY = coords.y - 30; targetPageIndex = coords.pageIndex;
        } else {
            finalX = config.x; finalY = config.y; targetPageIndex = config.pagina || 0;
        }

        // --- INYECCIÓN ROBUSTA ---
        // Si form.createSignature no aparece, usamos el método 'getTextField' 
        // como alternativa, ya que para muchas tabletas de firma, 
        // un campo de texto con el nombre correcto funciona igual.
        
        try {
            console.log("Intentando crear campo de firma...");
            const signatureField = form.createSignature('SignatureField1');
            signatureField.addToPage(pages[targetPageIndex], {
                x: finalX, y: finalY, width: 200, height: 60,
            });
        } catch (e) {
            console.warn("createSignature falló, usando fallback de campo de texto...");
            // Si la firma falla, creamos un campo de texto. 
            // Bank4Me suele mapear por nombre de campo ('SignatureField1')
            const textField = form.createTextField('SignatureField1');
            textField.addToPage(pages[targetPageIndex], {
                x: finalX, y: finalY, width: 200, height: 60,
            });
        }

        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send(error.message);
    }
});

// 4. Arrancar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor funcionando en: http://localhost:${PORT}`);
});