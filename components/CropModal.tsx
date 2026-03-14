import React, { useState, useRef, useEffect } from 'react';
import { PageState, CropBox } from '../types';
import { Button } from './Button';
import { Document, Page } from 'react-pdf';
import { X, Check, AlertCircle, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (crop: CropBox) => void;
  file: File;
  pageIndex: number;
  initialCrop: CropBox | null;
  rotation: number;
}

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  file,
  pageIndex,
  initialCrop,
  rotation
}) => {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentCrop, setCurrentCrop] = useState<CropBox>(
    initialCrop || { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
  );
  const [error, setError] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState(500);

  // Auto-fit height on load and resize
  useEffect(() => {
    const updateHeight = () => {
        // Leave space for header (60px) and footer (80px) and some padding
        setPageHeight(window.innerHeight - 180);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Reset crop when modal opens with new data
  useEffect(() => {
    if (isOpen) {
        setCurrentCrop(initialCrop || { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
        setError(null);
    }
  }, [isOpen, initialCrop]);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setStartPos({ x, y });
    setCurrentCrop({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;

    // Calculate new box based on startPos and currentPos
    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);

    setCurrentCrop({ 
        x: Math.max(0, x), 
        y: Math.max(0, y), 
        width: Math.min(1 - x, width), 
        height: Math.min(1 - y, height) 
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-white">
        {/* Header */}
        <div className="flex-none h-16 flex items-center justify-between px-6 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
             <Maximize className="w-5 h-5 text-blue-400" />
             <h3 className="font-semibold text-lg">Set Print Area</h3>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Page {pageIndex + 1}</span>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-slate-900/50 select-none relative">
           {error ? (
              <div className="flex flex-col items-center justify-center text-red-400 gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <p>Failed to load PDF preview.</p>
                  <p className="text-sm opacity-80">{error}</p>
              </div>
           ) : (
               <div 
                 className="relative shadow-2xl ring-1 ring-slate-700/50"
                 ref={setContainerRef}
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
                 style={{ cursor: 'crosshair' }}
               >
                  <Document 
                    file={file} 
                    onLoadError={(e) => setError(e.message)}
                    loading={<div className="text-slate-400 p-20">Loading preview...</div>}
                  >
                    <Page 
                        pageIndex={pageIndex} 
                        rotate={rotation}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        height={pageHeight} // Auto-fit to screen height
                        className="bg-white"
                    />
                  </Document>

                  {/* Crop Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                      {/* Darkened areas outside crop */}
                      <div className="absolute bg-black/60 transition-all duration-75" style={{ top: 0, left: 0, right: 0, height: `${currentCrop.y * 100}%` }} />
                      <div className="absolute bg-black/60 transition-all duration-75" style={{ bottom: 0, left: 0, right: 0, height: `${(1 - (currentCrop.y + currentCrop.height)) * 100}%` }} />
                      <div className="absolute bg-black/60 transition-all duration-75" style={{ top: `${currentCrop.y * 100}%`, left: 0, width: `${currentCrop.x * 100}%`, height: `${currentCrop.height * 100}%` }} />
                      <div className="absolute bg-black/60 transition-all duration-75" style={{ top: `${currentCrop.y * 100}%`, right: 0, width: `${(1 - (currentCrop.x + currentCrop.width)) * 100}%`, height: `${currentCrop.height * 100}%` }} />
                      
                      {/* The active crop box */}
                      <div 
                        className="absolute border-2 border-blue-400 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.2)]" 
                        style={{
                            top: `${currentCrop.y * 100}%`,
                            left: `${currentCrop.x * 100}%`,
                            width: `${currentCrop.width * 100}%`,
                            height: `${currentCrop.height * 100}%`
                        }}
                      >
                          {/* Handles for visual cue */}
                          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm"></div>
                          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm"></div>
                          
                          {/* Dimensions label (optional aesthetic) */}
                          <div className="absolute -top-8 left-0 bg-blue-600 text-white text-[10px] px-2 py-1 rounded shadow-sm font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                             {(currentCrop.width * 100).toFixed(0)}% x {(currentCrop.height * 100).toFixed(0)}%
                          </div>
                      </div>
                  </div>
               </div>
           )}
        </div>

        {/* Footer */}
        <div className="flex-none h-20 bg-slate-800 border-t border-slate-700 flex justify-between items-center px-6">
            <div className="text-sm text-slate-400 flex items-center gap-2">
                <span className="hidden md:inline">Click and drag to select the area you want to keep.</span>
                <span className="md:hidden">Drag to crop.</span>
            </div>
            
            <div className="flex gap-4">
                <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white hover:bg-slate-700">Cancel</Button>
                <Button onClick={() => onConfirm(currentCrop)} className="px-8 py-2.5">
                    <Check className="w-5 h-5 mr-2" />
                    Save Crop
                </Button>
            </div>
        </div>
    </div>
  );
};