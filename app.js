import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
//import * as pdflib from 'pdf-lib';
//const { PDFDocument } = pdflib
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

async function getCoordsFromText(buffer, etiqueta) {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = normalize(etiqueta);

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        // Intentamos primero la búsqueda por bloques individuales (lo que ya hacíamos)
        for (const item of items) {
            if (normalize(item.str).includes(target)) {
                return { x: item.transform[4], y: item.transform[5], pageIndex: i - 1 };
            }
        }

        // --- PLAN C: RECONSTRUCCIÓN POR ACUMULACIÓN ---
        // Si el PDF troceó la etiqueta, la buscamos uniendo trozos vecinos
        for (let j = 0; j < items.length; j++) {
            let textoAcumulado = "";
            let itemsUsados = [];

            // Miramos el item actual y los 3 siguientes por si la etiqueta está partida
            for (let k = j; k < Math.min(j + 4, items.length); k++) {
                textoAcumulado += normalize(items[k].str);
                
                if (textoAcumulado.includes(target)) {
                    console.log(`✅ ¡Etiqueta reconstruida detectada en pág ${i}!`);
                    console.log(`Trozo inicial: "${items[j].str}" -> Coordenadas: ${items[j].transform[4]}, ${items[j].transform[5]}`);
                    
                    return {
                        x: items[j].transform[4],
                        y: items[j].transform[5],
                        pageIndex: i - 1
                    };
                }
            }
        }
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
        
        if (!config) return res.status(400).send('Tipo de documento no reconocido.');

        // 1. Cargar el PDF
        const pdfDoc = await PDFDocument.load(req.file.buffer);
        
        // --- AQUÍ ESTÁ LA LÍNEA QUE FALTABA ---
        const pages = pdfDoc.getPages(); 
        // -------------------------------------

        let finalX, finalY, targetPageIndex;

        // 2. Lógica de coordenadas (Etiqueta vs Fijas)
        if (config.tieneEtiqueta) {
            const coords = await getCoordsFromText(req.file.buffer, config.etiqueta);
            if (!coords) return res.status(422).send('Etiqueta no encontrada en el PDF.');
            finalX = coords.x;
            finalY = coords.y - 30; // Ajuste Y
            targetPageIndex = coords.pageIndex;
        } else {
            finalX = config.x;
            finalY = config.y;
            targetPageIndex = config.pagina || 0;
        }

        // 3. INYECCIÓN DE CAMPO DE FIRMA REAL (API DE BAJO NIVEL)
        const page = pages[targetPageIndex];
        
        // Creamos el diccionario del campo de firma (/FT /Sig)
        const sigFieldDict = pdfDoc.context.obj({
            Type: 'Annot',
            Subtype: 'Widget',
            FT: 'Sig', 
            T: PDFString.of('SignatureField1'), 
            F: 4, 
            Rect: [finalX, finalY, finalX + 200, finalY + 60], 
            P: page.ref,
        });

        const sigFieldRef = pdfDoc.context.register(sigFieldDict);

        // Añadimos el Widget a las anotaciones de la página
        let annots = page.node.Annots();
        if (!annots) {
            annots = pdfDoc.context.obj([]);
            page.node.set(PDFName.of('Annots'), annots);
        }
        annots.push(sigFieldRef);

        // Lo registramos en el catálogo global del formulario (AcroForm)
        let acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
        if (!acroForm) {
            acroForm = pdfDoc.context.obj({
                Fields: [],
                SigFlags: 3, 
            });
            pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
        }

        const fields = acroForm.get(PDFName.of('Fields'));
        if (fields) {
            fields.push(sigFieldRef);
        } else {
            acroForm.set(PDFName.of('Fields'), pdfDoc.context.obj([sigFieldRef]));
        }

        acroForm.set(PDFName.of('SigFlags'), pdfDoc.context.obj(3));

        // 4. Guardar y enviar
        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=preparado_firma.pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error("Error procesando el PDF:", error);
        res.status(500).send(error.message);
    }
});

// 4. Arrancar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor funcionando en: http://localhost:${PORT}`);
});