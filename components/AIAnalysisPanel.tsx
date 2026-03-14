import React, { useState } from 'react';
import { Button } from './Button';
import { Sparkles, MessageSquare, FileText, X } from 'lucide-react';
import { askGeminiAboutText, summarizeText } from '../services/geminiService';
import { Document, Page } from 'react-pdf';

// Helper to get text content from pdfjs
// We need to access the text content of the specific page
import { pdfjs } from 'react-pdf';

interface AIAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  pageIndex: number;
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({ isOpen, onClose, file, pageIndex }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<'summary' | 'chat'>('summary');

  if (!isOpen) return null;

  const extractText = async () => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(pageIndex + 1); // 1-based index for pdfjs
        const textContent = await page.getTextContent();
        return textContent.items.map((item: any) => item.str).join(' ');
    } catch (e) {
        console.error("Failed to extract text", e);
        return "";
    }
  };

  const handleSummarize = async () => {
    setLoading(true);
    setResult("");
    try {
        const text = await extractText();
        if (!text.trim()) {
            setResult("Could not extract text from this page. It might be an image scan.");
            return;
        }
        const summary = await summarizeText(text);
        setResult(summary);
    } catch (e) {
        setResult("Error generating summary.");
    } finally {
        setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult("");
    try {
        const text = await extractText();
        if (!text.trim()) {
            setResult("Could not extract text from this page.");
            return;
        }
        const answer = await askGeminiAboutText(text, question);
        setResult(answer);
    } catch (e) {
        setResult("Error getting answer.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out border-l flex flex-col">
      <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2 text-indigo-700">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-semibold">Gemini Assistant</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full">
            <X className="w-5 h-5 text-indigo-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 border border-indigo-100">
            Analyzing Page {pageIndex + 1}. Ask questions or get a quick summary.
        </div>

        <div className="flex gap-2">
            <Button 
                size="sm" 
                variant={mode === 'summary' ? 'primary' : 'outline'} 
                className="flex-1"
                onClick={() => setMode('summary')}
            >
                <FileText className="w-4 h-4 mr-2" />
                Summarize
            </Button>
            <Button 
                size="sm" 
                variant={mode === 'chat' ? 'primary' : 'outline'} 
                className="flex-1"
                onClick={() => setMode('chat')}
            >
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask
            </Button>
        </div>

        {mode === 'summary' && (
            <div className="space-y-4">
                <p className="text-sm text-slate-600">Get a concise summary of the content on this page.</p>
                <Button onClick={handleSummarize} isLoading={loading} className="w-full">
                    Generate Summary
                </Button>
            </div>
        )}

        {mode === 'chat' && (
            <div className="space-y-4">
                <textarea 
                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                    placeholder="e.g., What is the invoice total?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <Button onClick={handleAsk} isLoading={loading} disabled={!question.trim()} className="w-full">
                    Ask Gemini
                </Button>
            </div>
        )}

        {result && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Result</h4>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {result}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};