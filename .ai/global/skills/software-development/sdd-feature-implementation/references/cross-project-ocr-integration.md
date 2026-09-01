# Cross-Project OCR Integration Pattern

Pattern para integrar un servidor OCR externo (MiNegocio NAS server) en un proyecto hermano (Finanzeasy) con fallback a mock.

## Arquitectura

```
[Finanzeasy App] → [OCRService] → HTTP POST → [MiNegocio NAS Server]
                                        ↓ (si falla)
                                  [Mock fallback]
                                        ↓
                                  [OCRParsedTransaction]
```

## MiNegocio NAS OCR Server (existente)

| Aspecto | Detalle |
|---------|---------|
| Stack | Node.js + Express |
| OCR Engine | OCRmyPDF (Tesseract spa+eng) |
| PDF Text | pdftotext |
| Puerto | 8788 |
| Auth | Bearer Token + Firebase ID Token |
| Parser | Facturas CFDI (regex avanzados) |
| Endpoint | POST /ocr/invoice |

## Implementación en Finanzeasy

```typescript
@Injectable({ providedIn: 'root' })
export class OCRService {
  async scanTicket(imageUri: string): Promise<OCRScan> {
    if (!this.config.enabled) {
      return this.mockScan(scan);
    }
    
    try {
      const blob = await this.uriToBlob(imageUri);
      const formData = new FormData();
      formData.append('file', blob, 'ticket.jpg');
      
      const response = await this.http.post(
        `${this.config.endpoint}/ocr/invoice`,
        formData,
        { headers: { Authorization: `Bearer ${this.config.token}` } }
      ).toPromise();
      
      if (response?.ok) {
        return this.parseOCRResponse(response);
      }
    } catch {
      // Fallback a mock cuando server no disponible
      return this.mockScan(scan);
    }
  }
}
```

## Configuración

```typescript
ocrService.updateConfig({
  enabled: true,
  endpoint: 'http://localhost:8788',
  token: 'YOUR_BEARER_TOKEN',
});
```

## Pitfall: HttpClient en tests

Cuando uses `inject(HttpClient)` en un servicio, los tests deben proveer un mock:

```typescript
const httpClientStub = { 
  post: jasmine.createSpy('post').and.returnValue({ 
    toPromise: () => Promise.resolve({ ok: true, ocrText: '', parsedLines: [] }) 
  }) 
};

TestBed.configureTestingModule({
  providers: [OCRService, { provide: HttpClient, useValue: httpClientStub }],
});
```

Sin esto, obtienes `NullInjectorError: No provider for HttpClient!`.

## Ventajas

1. **Reutilización:** El servidor OCR es compartido entre proyectos
2. **OCR Real:** Tesseract spa+eng para texto en español
3. **Fallback:** Si el server no está disponible, usa mock local
4. **Parseo mejorado:** El servidor extrae líneas con montos, descripciones

## Próximos Pasos

- UI para captura de foto
- Soporte múltiples líneas por foto
- Confirmación manual antes de guardar

## Lecciones adicionales (Sesión 2026-08-19)

### Configuración dinámica vs secrets hardcodeados

El token del servidor OCR NUNCA debe hardcodearse. Usar variables de entorno o configuración dinámica:

```typescript
// ✅ CORRECTO — configuración dinámica
ocrService.updateConfig({
  enabled: true,
  endpoint: process.env['OCR_ENDPOINT'] || 'http://localhost:8788',
  token: process.env['OCR_TOKEN'] || '',
});

// ❌ INCORRECTO — token hardcodeado
ocrService.updateConfig({ token: 'mi-token-secreto' });
```

### Categorización post-OCR

Después del OCR, siempre sugerir una categoría basada en el texto reconocido:

```typescript
private suggestCategory(text: string): string {
  const lower = text.toLowerCase();
  const map: Record<string, string[]> = {
    'Comida': ['restaurante', 'cafe', 'uber eats', 'taqueria', 'pizza', 'super'],
    'Transporte': ['gasolina', 'uber', 'taxi', 'gasolinera', 'pemex', 'shell'],
    'Compras': ['amazon', 'walmart', 'soriana', 'liverpool'],
    // ...
  };
  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Otros';
}
```
