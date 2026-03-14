import React, { useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import { Upload, RotateCw, Crop, Save, Trash2, CheckSquare, Square, Minus, Plus, AlertCircle, Printer, FileUp, Files } from 'lucide-react';
import { Button } from './components/Button';
import { CropModal } from './components/CropModal';
import { getPdfInfo, savePdf, downloadBlob } from './services/pdfService';
import { PageState, CropBox } from './types';

// Fix for react-pdf worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PageState[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [activePageGlobalIndex, setActivePageGlobalIndex] = useState<number>(0);
  const [scale, setScale] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfErrors, setPdfErrors] = useState<Record<number, string>>({});
  const [outputFilename, setOutputFilename] = useState("");

  // Load PDF when files are selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: File[] = Array.from(e.target.files);
      
      // If first load, set filename based on first file
      if (files.length === 0) {
        setOutputFilename(newFiles[0].name.replace(/\.pdf$/i, '') + '_merged');
      }

      setPdfErrors({});
      setIsProcessing(true);

      try {
        const allNewPages: PageState[] = [];
        
        // Process each file
        for (let i = 0; i < newFiles.length; i++) {
          const file = newFiles[i];
          // We pass the index relative to the TOTAL list of files.
          // Since we are replacing the list (or appending? Requirement implies "add... at once").
          // The current implementation replaces "Start Over".
          // If we want to support appending, we would need to offset indices.
          // For simplicity in this version, we treat this input as the "Session Set".
          // If we wanted to append: const offset = files.length; getPdfInfo(file, offset + i);
          // Let's assume a "Session Reset" on new upload for cleaner UX as per "Start Over" button.
          const filePages = await getPdfInfo(file, i);
          allNewPages.push(...filePages);
        }

        setFiles(newFiles);
        setPages(allNewPages);
        
        // Select all by default
        const allIndices = new Set(allNewPages.map((_, i) => i));
        setSelectedIndices(allIndices);

      } catch (error) {
        console.error("Error loading PDFs", error);
        alert("Failed to load one or more PDF files.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const togglePageSelection = (globalIndex: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(globalIndex)) {
      newSelected.delete(globalIndex);
    } else {
      newSelected.add(globalIndex);
    }
    setSelectedIndices(newSelected);
    
    // Update pages state
    setPages(prev => prev.map((p, i) => i === globalIndex ? { ...p, selected: !p.selected } : p));
  };

  const selectAll = () => {
    if (selectedIndices.size === pages.length) {
      setSelectedIndices(new Set());
      setPages(prev => prev.map(p => ({ ...p, selected: false })));
    } else {
      const all = new Set(pages.map((_, i) => i));
      setSelectedIndices(all);
      setPages(prev => prev.map(p => ({ ...p, selected: true })));
    }
  };

  const rotateSelected = (degrees: number) => {
    setPages(prev => prev.map((p, i) => {
      if (selectedIndices.has(i)) {
        return { ...p, addedRotation: (p.addedRotation + degrees) % 360 };
      }
      return p;
    }));
  };

  const openCropModal = () => {
    if (selectedIndices.size === 0) {
      alert("Please select at least one page to crop.");
      return;
    }
    // Use the first selected page as the representative
    const firstSelected = Array.from(selectedIndices)[0];
    setActivePageGlobalIndex(firstSelected);
    setCropModalOpen(true);
  };

  const applyCropToSelected = (crop: CropBox) => {
    setPages(prev => prev.map((p, i) => {
      if (selectedIndices.has(i)) {
        return { ...p, crop };
      }
      return p;
    }));
    setCropModalOpen(false);
  };

  const handleSave = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const pdfBytes = await savePdf(files, pages);
      downloadBlob(pdfBytes, `${outputFilename || 'modified'}.pdf`);
    } catch (error) {
      console.error("Error saving PDF", error);
      alert("Failed to save PDF. Ensure you have pages selected.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const pdfBytes = await savePdf(files, pages);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const iframe = document.createElement('iframe');
      Object.assign(iframe.style, {
          position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0'
      });
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
          setTimeout(() => {
              try {
                  iframe.contentWindow?.focus();
                  iframe.contentWindow?.print();
              } catch (e) {
                  console.warn("Iframe print blocked, opening in new tab", e);
                  window.open(url, '_blank');
              }
              setTimeout(() => {
                  if (document.body.contains(iframe)) document.body.removeChild(iframe);
                  URL.revokeObjectURL(url);
              }, 60000);
          }, 500);
      };
    } catch (error) {
      console.error("Error printing PDF", error);
      alert("Failed to prepare PDF for printing.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Files className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">FreeFlow PDF Master</h1>
          <p className="text-slate-500 mb-8">Rotate, crop, and merge your PDFs for free. Completely private, client-side processing.</p>
          
          <label className="block w-full">
            <input 
                type="file" 
                accept=".pdf" 
                multiple 
                onChange={handleFileChange} 
                className="hidden" 
            />
            <div className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              <span>Select PDF Files (Max 50)</span>
            </div>
          </label>
          <p className="mt-4 text-xs text-slate-400">Works locally on your device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm transition-all">
        <div className="p-6 border-b border-slate-100">
          <h1 className="font-bold text-2xl text-slate-800 flex items-center gap-3">
            <span className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg">FF</span>
            FreeFlow
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500 font-medium">
             <Files className="w-4 h-4" />
             <span>{files.length} File{files.length !== 1 ? 's' : ''} Loaded</span>
          </div>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Selection</h3>
            <div className="flex flex-col gap-3">
              <Button variant="outline" size="lg" onClick={selectAll} className="justify-start w-full text-slate-700">
                {selectedIndices.size === pages.length ? <CheckSquare className="w-5 h-5 mr-3"/> : <Square className="w-5 h-5 mr-3"/>}
                {selectedIndices.size === pages.length ? "Deselect All" : "Select All"}
              </Button>
              <div className="text-sm text-slate-500 px-1 font-medium">
                {selectedIndices.size} of {pages.length} pages selected
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Actions</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Button variant="outline" size="lg" onClick={() => rotateSelected(-90)} title="Rotate Left">
                <RotateCw className="w-5 h-5 -scale-x-100 mr-2" />
                Left
              </Button>
              <Button variant="outline" size="lg" onClick={() => rotateSelected(90)} title="Rotate Right">
                <RotateCw className="w-5 h-5 mr-2" />
                Right
              </Button>
            </div>
            <Button variant="secondary" size="lg" className="w-full justify-start" onClick={openCropModal}>
              <Crop className="w-5 h-5 mr-3" />
              Set Print Area
            </Button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 space-y-5 bg-slate-50/50">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">File Name</label>
            <div className="flex items-center">
                <input 
                    type="text" 
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    className="w-full text-base border border-slate-300 rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-colors shadow-sm"
                    placeholder="Filename"
                />
                <span className="text-sm text-slate-500 ml-2 font-medium">.pdf</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button className="flex-1 shadow-sm" variant="secondary" size="lg" onClick={handlePrint} isLoading={isProcessing}>
                <Printer className="w-5 h-5 mr-2" />
                Print
            </Button>
            <Button className="flex-1 shadow-sm" size="lg" onClick={handleSave} isLoading={isProcessing}>
                <Save className="w-5 h-5 mr-2" />
                Save
            </Button>
          </div>
          
          <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 mt-2" onClick={() => { setFiles([]); setPages([]); }}>
            <Trash2 className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
           <div className="flex items-center gap-6">
              <span className="text-base font-medium text-slate-600">Preview Zoom</span>
              <div className="flex items-center bg-slate-100 rounded-lg p-1.5 ring-1 ring-slate-200">
                 <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors"><Minus className="w-4 h-4"/></button>
                 <span className="w-16 text-center text-sm font-semibold text-slate-700">{Math.round(scale * 100)}%</span>
                 <button onClick={() => setScale(s => Math.min(2.5, s + 0.25))} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors"><Plus className="w-4 h-4"/></button>
              </div>
           </div>
           <div className="text-sm font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              Only selected pages ({selectedIndices.size}) will be included.
           </div>
        </div>

        {/* Grid View */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
          {Object.keys(pdfErrors).length > 0 && (
             <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-3 shadow-sm">
                 <AlertCircle className="w-6 h-6" />
                 <span className="font-medium">Errors occurred while loading some files.</span>
             </div>
          )}
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-[1600px] mx-auto">
            {files.map((file, fileIdx) => (
                <Document 
                    key={fileIdx}
                    file={file} 
                    className="contents" 
                    onLoadError={(error) => {
                        console.error(`PDF Load Error (File ${fileIdx}):`, error);
                        setPdfErrors(prev => ({ ...prev, [fileIdx]: error.message }));
                    }}
                >
                  {pages
                    .filter(p => p.fileIndex === fileIdx)
                    .map((page) => {
                        const globalIndex = pages.indexOf(page);
                        return (
                            <div 
                              key={`${fileIdx}-${page.pageIndex}`} 
                              className={`relative group bg-white rounded-2xl shadow-sm transition-all duration-300 ${page.selected ? 'ring-4 ring-blue-500/50 shadow-xl scale-[1.01]' : 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 hover:shadow-md'}`}
                            >
                              <button 
                                onClick={() => togglePageSelection(globalIndex)}
                                className={`absolute top-4 left-4 z-20 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all shadow-sm ${page.selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent hover:border-slate-400'}`}
                              >
                                <CheckSquare className="w-5 h-5" />
                              </button>

                              <div className="p-6 flex justify-center overflow-hidden min-h-[500px]" onClick={() => togglePageSelection(globalIndex)}>
                                <div className="relative shadow-xl pointer-events-none transition-transform duration-300">
                                    <Page 
                                        pageIndex={page.pageIndex} 
                                        width={450 * scale}
                                        renderAnnotationLayer={false}
                                        renderTextLayer={false}
                                        rotate={(page.originalRotation + page.addedRotation) % 360}
                                        className="border border-slate-100 bg-white"
                                        loading={
                                            <div className="flex items-center justify-center w-[450px] h-[636px] bg-slate-50 text-slate-400 rounded-lg border-2 border-dashed border-slate-200">
                                                <div className="animate-pulse font-medium">Loading...</div>
                                            </div>
                                        }
                                    />
                                    {page.crop && (
                                        <div 
                                            className="absolute border-4 border-green-500 bg-green-500/10 shadow-lg"
                                            style={{
                                                top: `${page.crop.y * 100}%`,
                                                left: `${page.crop.x * 100}%`,
                                                width: `${page.crop.width * 100}%`,
                                                height: `${page.crop.height * 100}%`
                                            }}
                                        />
                                    )}
                                </div>
                              </div>

                              <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500 bg-slate-50/80 rounded-b-2xl backdrop-blur-sm">
                                <span className="font-semibold text-slate-600 flex flex-col">
                                    <span>Page {page.pageIndex + 1}</span>
                                    <span className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]">{file.name}</span>
                                </span>
                                <div className="flex items-center gap-3">
                                    {page.addedRotation !== 0 && (
                                        <span className="flex items-center text-orange-700 bg-orange-100 px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                                            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                                            {page.addedRotation}°
                                        </span>
                                    )}
                                    {page.crop && (
                                        <span className="flex items-center text-green-700 bg-green-100 px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                                            <Crop className="w-3.5 h-3.5 mr-1.5" />
                                            Crop
                                        </span>
                                    )}
                                </div>
                              </div>
                            </div>
                        );
                    })}
                </Document>
            ))}
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {files.length > 0 && pages[activePageGlobalIndex] && (
        <CropModal 
            isOpen={cropModalOpen}
            onClose={() => setCropModalOpen(false)}
            onConfirm={applyCropToSelected}
            file={files[pages[activePageGlobalIndex].fileIndex]}
            pageIndex={pages[activePageGlobalIndex].pageIndex}
            rotation={(pages[activePageGlobalIndex].originalRotation + pages[activePageGlobalIndex].addedRotation) % 360}
            initialCrop={pages[activePageGlobalIndex].crop}
        />
      )}
    </div>
  );
};

export default App;