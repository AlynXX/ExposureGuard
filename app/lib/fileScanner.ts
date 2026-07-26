import { Finding, maskValue, scanText } from "./exposure";

export type FileScanResult = {
  extractedText: string;
  findings: Finding[];
  notes: string[];
};

function metadataFinding(
  type: Finding["type"],
  value: string,
  context: string,
  index: number,
): Finding {
  return {
    id: `metadata-${type.toLowerCase()}-${index}`,
    type,
    value,
    maskedValue: maskValue(type, value),
    confidence: 0.99,
    source: "metadata",
    context,
  };
}

async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const chunks: string[] = [];
  const pages = Math.min(pdf.numPages, 20);
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    chunks.push(
      content.items
        .filter((item): item is typeof item & { str: string } => "str" in item)
        .map((item) => item.str)
        .join(" "),
    );
  }
  return chunks.join("\n");
}

async function extractImageMetadata(file: File) {
  const exifr = await import("exifr");
  return (
    (await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      pick: [
        "Make",
        "Model",
        "DateTimeOriginal",
        "CreateDate",
        "latitude",
        "longitude",
        "GPSLatitude",
        "GPSLongitude",
      ],
    })) ?? {}
  );
}

async function extractImageText(
  file: File,
  onProgress?: (progress: number, status: string) => void,
) {
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker(["eng", "pol"], 1, {
    logger: (message) => {
      if (typeof message.progress === "number") {
        onProgress?.(message.progress, message.status);
      }
    },
  });
  try {
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

export async function scanFile(
  file: File,
  onProgress?: (progress: number, status: string) => void,
): Promise<FileScanResult> {
  const notes: string[] = [];
  let extractedText = "";
  const findings: Finding[] = [];

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File is larger than the 10 MB demo limit.");
  }

  if (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) {
    extractedText = await file.text();
  } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    onProgress?.(0.1, "extracting_pdf");
    extractedText = await extractPdfText(file);
    notes.push("PDF text layer analysed locally in your browser.");
  } else if (file.type.startsWith("image/")) {
    onProgress?.(0.05, "reading_metadata");
    const metadata = await extractImageMetadata(file);
    const latitude = metadata.latitude ?? metadata.GPSLatitude;
    const longitude = metadata.longitude ?? metadata.GPSLongitude;
    if (latitude !== undefined && longitude !== undefined) {
      const value = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
      findings.push(metadataFinding("EXIF_GPS", value, "GPS coordinates embedded in the image", 0));
    }
    const device = [metadata.Make, metadata.Model].filter(Boolean).join(" ");
    if (device) {
      findings.push(metadataFinding("EXIF_DEVICE", device, "Camera or phone model in EXIF", 1));
    }
    const date = metadata.DateTimeOriginal ?? metadata.CreateDate;
    if (date) {
      findings.push(
        metadataFinding("EXIF_DATE", new Date(date).toISOString(), "Capture time in EXIF", 2),
      );
    }
    onProgress?.(0.15, "running_ocr");
    extractedText = await extractImageText(file, onProgress);
    notes.push("Image text was read with local OCR; nothing was uploaded.");
  } else {
    throw new Error("Unsupported file type. Use TXT, MD, PDF, PNG, JPG or WEBP.");
  }

  findings.push(...scanText(extractedText, "file"));
  onProgress?.(1, "complete");
  return { extractedText, findings, notes };
}
