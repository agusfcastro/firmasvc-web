import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Image, Wand2, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { ImageSize } from '../types';

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>(ImageSize.Size1K);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // 1. Check API Key selection (User pays for Pro models)
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        // Assume success after dialog closes or handle retry
      }

      // 2. Initialize AI (Key is injected into process.env.API_KEY after selection)
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 3. Call Model
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            imageSize: size,
            aspectRatio: "1:1" // Default square for simple layout
          }
        },
      });

      // 4. Extract Image
      let foundImage = false;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const imageUrl = `data:image/png;base64,${base64EncodeString}`;
            setGeneratedImage(imageUrl);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("No se generó ninguna imagen. Intenta modificar el prompt.");
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Requested entity was not found")) {
         setError("Error de autenticación. Por favor selecciona tu API Key nuevamente.");
         // Reset key logic could go here if supported
      } else {
        setError("Hubo un error generando la imagen. Por favor intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="resources" className="py-20 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left: Controls */}
          <div>
            <div className="inline-flex items-center gap-2 text-firma font-bold mb-4">
              <Wand2 size={20} />
              <span>AI Studio - Beta</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Visualiza tu Marca</h3>
            <p className="text-gray-600 mb-8">
              Utiliza nuestra herramienta exclusiva para clientes potenciada por <strong>Gemini 3 Pro</strong>. Genera conceptos visuales para tu identidad corporativa al instante.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Describe tu concepto</label>
                <textarea 
                  className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-firma focus:border-transparent outline-none transition-all resize-none h-32"
                  placeholder="Ej: Un logo minimalista de un edificio legal, estilo geométrico, azul y blanco..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Calidad de Imagen</label>
                <div className="flex gap-4">
                  {Object.values(ImageSize).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${size === s ? 'bg-firma text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <Button 
                onClick={handleGenerate} 
                disabled={loading || !prompt}
                fullWidth
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando...
                  </>
                ) : (
                  <>
                    <Image size={20} />
                    Generar Imagen
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                *Requiere seleccionar tu propia API Key de Google Cloud (GCP) con facturación habilitada.
              </p>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="bg-gray-50 rounded-2xl p-4 min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-200">
            {generatedImage ? (
              <div className="relative group w-full">
                <img src={generatedImage} alt="Generated" className="w-full rounded-lg shadow-lg" />
                <a 
                  href={generatedImage} 
                  download="firma-concept.png"
                  className="absolute bottom-4 right-4 bg-white/90 p-2 rounded-full shadow-md text-gray-800 hover:text-firma opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download size={24} />
                </a>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <Image size={48} className="mx-auto mb-4 opacity-50" />
                <p>La imagen generada aparecerá aquí</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
};