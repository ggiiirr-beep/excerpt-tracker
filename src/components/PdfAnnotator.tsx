import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { PdfAnnotationPoint, PdfAnnotationStroke } from '../types';
import { makeId } from './Atoms';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type DrawMode = 'pen' | 'erase';

type PageSize = {
  width: number;
  height: number;
};

export function PdfAnnotator({
  pdfUrl,
  annotations,
  onChange,
}: {
  pdfUrl: string;
  annotations: PdfAnnotationStroke[];
  onChange: (annotations: PdfAnnotationStroke[]) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const activeStrokeRef = useRef<PdfAnnotationStroke | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>({ width: 0, height: 0 });
  const [mode, setMode] = useState<DrawMode>('pen');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const currentPageAnnotations = useMemo(
    () => annotations.filter((stroke) => stroke.page === pageNumber),
    [annotations, pageNumber],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setPageNumber(1);

    const task = pdfjsLib.getDocument(pdfUrl);
    task.promise
      .then((pdfDocument) => {
        if (cancelled) {
          pdfDocument.destroy();
          return;
        }
        documentRef.current = pdfDocument;
        setPageCount(pdfDocument.numPages);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });

    return () => {
      cancelled = true;
      task.destroy();
      documentRef.current?.destroy();
      documentRef.current = null;
    };
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    const pdfDocument = documentRef.current;
    const pageCanvas = pageCanvasRef.current;
    const inkCanvas = inkCanvasRef.current;
    if (!pdfDocument || !pageCanvas || !inkCanvas || !containerWidth) return;

    pdfDocument.getPage(pageNumber).then((page) => {
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const cssWidth = Math.min(containerWidth, baseViewport.width);
      const scale = cssWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;
      const cssHeight = viewport.height;

      [pageCanvas, inkCanvas].forEach((canvas) => {
        canvas.width = Math.round(viewport.width * pixelRatio);
        canvas.height = Math.round(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
      });

      setPageSize({ width: viewport.width, height: cssHeight });

      const context = pageCanvas.getContext('2d');
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);
      page.render({ canvas: pageCanvas, canvasContext: context, viewport }).promise.catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [containerWidth, pageNumber, loadState]);

  useEffect(() => {
    redrawInk();
  }, [currentPageAnnotations, pageSize]);

  const drawStroke = (context: CanvasRenderingContext2D, stroke: PdfAnnotationStroke) => {
    if (stroke.points.length < 2 || !pageSize.width || !pageSize.height) return;

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * pageSize.width;
      const y = point.y * pageSize.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.restore();
  };

  const redrawInk = () => {
    const inkCanvas = inkCanvasRef.current;
    if (!inkCanvas || !pageSize.width || !pageSize.height) return;

    const context = inkCanvas.getContext('2d');
    if (!context) return;
    const pixelRatio = window.devicePixelRatio || 1;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, pageSize.width, pageSize.height);
    currentPageAnnotations.forEach((stroke) => drawStroke(context, stroke));
  };

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): PdfAnnotationPoint | null => {
    if (!pageSize.width || !pageSize.height) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const eraseNearPoint = (point: PdfAnnotationPoint) => {
    const threshold = 0.018;
    const nextAnnotations = annotations.filter((stroke) => {
      if (stroke.page !== pageNumber) return true;
      return !stroke.points.some((strokePoint) => {
        const xDistance = strokePoint.x - point.x;
        const yDistance = strokePoint.y - point.y;
        return Math.hypot(xDistance, yDistance) < threshold;
      });
    });

    if (nextAnnotations.length !== annotations.length) onChange(nextAnnotations);
  };

  const startStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (mode === 'erase') {
      eraseNearPoint(point);
      return;
    }

    activeStrokeRef.current = {
      id: makeId('stroke'),
      page: pageNumber,
      color: '#1e211d',
      size: 3,
      points: [point],
    };
  };

  const continueStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    if (!point) return;

    if (mode === 'erase') {
      eraseNearPoint(point);
      return;
    }

    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    stroke.points.push(point);
    redrawInk();
    const context = inkCanvasRef.current?.getContext('2d');
    if (context) drawStroke(context, stroke);
  };

  const finishStroke = () => {
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (!stroke || stroke.points.length < 2) return;
    onChange([...annotations, stroke]);
  };

  const undoPage = () => {
    const index = annotations.map((stroke) => stroke.page).lastIndexOf(pageNumber);
    if (index < 0) return;
    onChange(annotations.filter((_, annotationIndex) => annotationIndex !== index));
  };

  const clearPage = () => {
    if (!currentPageAnnotations.length) return;
    if (!window.confirm('Clear annotations on this page?')) return;
    onChange(annotations.filter((stroke) => stroke.page !== pageNumber));
  };

  return (
    <section className="pdf-panel" ref={wrapperRef}>
      <div className="pdf-toolbar">
        <div className="pdf-page-controls">
          <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1}>‹</button>
          <span>Page {pageNumber}{pageCount ? ` of ${pageCount}` : ''}</span>
          <button type="button" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))} disabled={!pageCount || pageNumber >= pageCount}>›</button>
        </div>
        <div className="pdf-draw-controls" aria-label="Annotation tools">
          <button className={mode === 'pen' ? 'active' : ''} type="button" onClick={() => setMode('pen')} aria-label="Pen tool" title="Pen">✎</button>
          <button className={mode === 'erase' ? 'active' : ''} type="button" onClick={() => setMode('erase')} aria-label="Eraser tool" title="Eraser">⌫</button>
          <button type="button" onClick={undoPage} aria-label="Undo last mark" title="Undo">↶</button>
          <button type="button" onClick={clearPage} aria-label="Clear this page" title="Clear page">×</button>
        </div>
      </div>

      <div className="pdf-stage" style={{ minHeight: pageSize.height || 260 }}>
        {loadState === 'loading' && <p className="pdf-status">Loading score</p>}
        {loadState === 'error' && <p className="pdf-status">Could not open this PDF.</p>}
        <canvas ref={pageCanvasRef} className="pdf-page-canvas" aria-hidden="true" />
        <canvas
          ref={inkCanvasRef}
          className="pdf-ink-canvas"
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          aria-label="PDF annotation layer"
        />
      </div>
    </section>
  );
}
