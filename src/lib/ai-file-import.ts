import { parseAiExamJson } from './ai-exam-prompts';
import { parseDocxExamFile, type DocxExtractedImage } from './docx-exam-parser';
import { loadPdfDocumentController, arrayBufferToBase64, type PdfDocumentController } from './pdf-exam-parser';

export type AnswerImportStrategy = 'extract_or_solve' | 'solve_all';

export interface ImportedExamQuestion {
  type: string;
  question?: string;
  content?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  option_e?: string;
  option_f?: string;
  correct_option?: string;
  difficulty_level?: string;
  cognitive_level?: string;
  explanation?: string;
  image_url?: string;
  metadata?: any;
  image_region?: {
    page: number;
    box_2d: [number, number, number, number];
  } | null;
  /** Client-only blob pending upload to Supabase Storage */
  _pendingBlob?: Blob;
  _previewUrl?: string;
}

export interface FileImportProgress {
  step: 1 | 2 | 3;
  message: string;
}

export interface FileImportResult {
  title?: string;
  questions: ImportedExamQuestion[];
  warnings: string[];
  saWarnings: string[];
  pdfController?: PdfDocumentController;
  docxRawPreview?: string;
}

function buildFileExtractionPrompt(opts: {
  subjectName: string;
  hasSeparateAnswerFile: boolean;
  answerStrategy: AnswerImportStrategy;
  generateExplanations: boolean;
  isMainPdf: boolean;
  autoCropPdfFigures: boolean;
  docxImageTokens: string[];
}): string {
  const answerRule =
    opts.answerStrategy === 'solve_all'
      ? `- BỎ QUA các đáp án đánh dấu cũ nếu không chắc chắn; hãy TỰ GIẢI CHÍNH XÁC 100% tất cả các câu hỏi để điền "correct_option".`
      : opts.hasSeparateAnswerFile
        ? `- Đối chiếu kỹ TỆP ĐỀ THI với TỆP ĐÁP ÁN / HƯỚNG DẪN CHẤM đính kèm để lấy chính xác 100% "correct_option" và lời giải. Nếu câu nào khuyết đáp án trong bảng đáp án thì tự giải bổ sung.`
        : `- Ưu tiên trích xuất đáp án đúng được giáo viên đánh dấu trong tài liệu (chữ gạch chân, tô màu đỏ, in đậm, dấu *, hoặc Bảng đáp án / Hướng dẫn giải ở cuối đề). Nếu tài liệu CHƯA CÓ đáp án cho câu nào, hãy TỰ GIẢI CHÍNH XÁC câu đó để điền đầy đủ "correct_option".`;

  const explanationRule = opts.generateExplanations
    ? `- Nếu tài liệu đã có lời giải chi tiết thì giữ nguyên/chuẩn hóa LaTeX vào "explanation". Nếu tài liệu CHƯA CÓ lời giải, hãy biên soạn lời giải ngắn gọn, chính xác vào "explanation".`
    : `- Chỉ trích xuất lời giải có sẵn trong tài liệu vào "explanation" (nếu không có thì để chuỗi rỗng "").`;

  const figureRule = opts.isMainPdf && opts.autoCropPdfFigures
    ? `\n4. NHẬN DIỆN & CẮT HÌNH VẼ / ĐỒ THỊ / BẢNG BIẾN THIÊN TỪ TRANG PDF:
- Nếu một câu hỏi có hình vẽ hình học, đồ thị hàm số, bảng biến thiên vẽ bằng đường kẻ, mạch điện hoặc hình thí nghiệm trên mặt trang PDF, hãy trả thêm trường:
  \`"image_region": { "page": <số_thứ_tự_trang_bắt_đầu_từ_1>, "box_2d": [ymin, xmin, ymax, xmax] }\`
  trong đó \`ymin, xmin, ymax, xmax\` là tọa độ chuẩn hóa từ \`0\` đến \`1000\` bao trọn riêng phần hình vẽ đó (KHÔNG bao gồm phần chữ đề bài xung quanh). Nếu câu không có hình vẽ thì đặt \`"image_region": null\`.`
    : opts.docxImageTokens.length > 0
      ? `\n4. GIỮ NGUYÊN TOKEN HÌNH ẢNH TỪ FILE WORD:
- Tài liệu Word có các token ảnh: ${opts.docxImageTokens.join(', ')}. Nếu câu hỏi hoặc phương án chứa token \`[[DOCX_IMG_k]]\`, hãy đặt token đó vào trường \`"image_token": "[[DOCX_IMG_k]]"\` của câu hỏi đó (hoặc giữ nguyên trong chuỗi nội dung) để hệ thống ghép đúng ảnh gốc.`
      : '';

  return `Bạn là hệ thống AI chuyên bóc tách và số hóa đề thi Việt Nam (${opts.subjectName || 'THPT'}) từ tài liệu gốc sang cấu trúc JSON chuẩn.

NHIỆM VỤ BẮT BUỘC:
1. GIỮ NGUYÊN 100% NỘI DUNG CÂU HỎI & SỐ LIỆU GỐC:
- Bóc tách ĐẦY ĐỦ tất cả các câu hỏi theo đúng thứ tự xuất hiện trong đề thi gốc, không bỏ sót câu nào, không tự ý thay đổi số liệu.
- Mọi công thức Toán, Vật lí, Hóa học phải chuyển sang chuẩn LaTeX đặt trong \`$...$\` (inline) hoặc \`$$...$$\` (block). Chú ý escape \`\\\\\` trong chuỗi JSON (ví dụ \`"\\\\frac{a}{b}"\`, \`"\\\\sqrt{x}"\`).

2. PHÂN LOẠI ĐÚNG DẠNG CÂU HỎI HỆ THỐNG:
- Câu trắc nghiệm 4 lựa chọn A, B, C, D -> \`"type": "mcq"\`, bỏ tiền tố "A.", "B." khỏi nội dung \`option_a..option_d\`, \`"correct_option"\` là \`"A"\` / \`"B"\` / \`"C"\` / \`"D"\`.
- Câu trắc nghiệm Đúng/Sai 4 ý a), b), c), d) (Phần II chuẩn 2025) -> \`"type": "msq"\`, bỏ tiền tố "a)", "b)" khỏi \`option_a..option_d\`, \`"correct_option"\` liệt kê chữ cái của các mệnh đề ĐÚNG cách nhau dấu phẩy (ví dụ \`"A,C"\`, \`"A,B,D"\`; nếu cả 4 ý đều Sai thì để \`""\`).
- Câu trả lời ngắn điền đáp số (Phần III chuẩn 2025) -> \`"type": "sa"\`, \`"correct_option"\` là đáp số ngắn gọn (ví dụ \`"12,5"\`, \`"-3"\`).
- Câu tự luận -> \`"type": "tl"\`.
- Bài đọc điền khuyết nhiều chỗ trống (Tiếng Anh) -> \`"type": "read_cloze"\`, đoạn văn có đánh số \`(1) ____\` trong \`"content"\` và mảng câu hỏi con trong \`"metadata": { "questions": [{ "question": "Question 1", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "explanation": "..." }] }\`.
- Câu sắp xếp hội thoại / thư / đoạn văn -> \`"type": "ordering"\`.
- Bài đọc hiểu nhiều câu hỏi con -> \`"type": "read"\`, đoạn văn trong \`"content"\` và câu hỏi con trong \`"metadata": { "questions": [...] }\`.

3. XỬ LÝ ĐÁP ÁN & LỜI GIẢI:
${answerRule}
${explanationRule}${figureRule}

5. ĐỊNH DẠNG ĐẦU RA (CHỈ XUẤT JSON HỢP LỆ, KHÔNG BỌC MARKDOWN):
{
  "title": "Tiêu đề đề thi trích từ đầu trang...",
  "questions": [
    {
      "type": "mcq",
      "question": "Nội dung câu hỏi...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_option": "A",
      "difficulty_level": "easy",
      "cognitive_level": "nb",
      "explanation": "...",
      "image_region": null
    }
  ]
}`;
}

export async function extractExamFromFilesWithGemini(params: {
  apiKey: string;
  model: string;
  mainFile: File;
  answerFile?: File | null;
  subjectName: string;
  answerStrategy: AnswerImportStrategy;
  generateExplanations: boolean;
  autoCropPdfFigures: boolean;
  onProgress?: (p: FileImportProgress) => void;
  signal?: AbortSignal;
}): Promise<FileImportResult> {
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
  if (params.mainFile.size > MAX_BYTES) {
    throw new Error('Tệp đề thi vượt quá giới hạn 20 MB. Vui lòng nén nhẹ PDF hoặc tách tệp.');
  }
  if (params.answerFile && params.answerFile.size > MAX_BYTES) {
    throw new Error('Tệp đáp án đính kèm vượt quá giới hạn 20 MB.');
  }

  const key = params.apiKey.trim();
  if (!key) {
    throw new Error('Vui lòng nhập Gemini API Key ở khung Kết nối Google Gemini API phía trên.');
  }

  const mainExt = (params.mainFile.name.split('.').pop() || '').toLowerCase();
  const isMainPdf = mainExt === 'pdf' || params.mainFile.type === 'application/pdf';
  const isMainDocx =
    mainExt === 'docx' ||
    params.mainFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isMainPdf && !isMainDocx) {
    throw new Error('Chỉ hỗ trợ tệp đề thi định dạng .pdf hoặc .docx (Word 2010 trở lên).');
  }

  params.onProgress?.({
    step: 1,
    message: isMainPdf
      ? 'Đang nạp trang PDF & chuẩn bị bộ cắt hình tự động (1/3)...'
      : 'Đang giải nén cấu trúc XML, công thức & hình ảnh từ file Word (1/3)...',
  });

  const warnings: string[] = [];
  const parts: any[] = [];
  let pdfController: PdfDocumentController | undefined;
  let docxImages: DocxExtractedImage[] = [];
  let docxRawPreview: string | undefined;

  if (isMainPdf) {
    pdfController = await loadPdfDocumentController(params.mainFile);
    const pdfBase64 = await pdfController.toBase64();
    parts.push({
      text: '=== TÀI LIỆU 1: TỆP ĐỀ THI CHÍNH (PDF) ===',
    });
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    });
  } else {
    const docxParsed = await parseDocxExamFile(params.mainFile);
    warnings.push(...docxParsed.warnings);
    docxImages = docxParsed.images;
    docxRawPreview = docxParsed.annotatedText;

    parts.push({
      text: `=== TÀI LIỆU 1: NỘI DUNG ĐỀ THI TRÍCH XUẤT TỪ WORD (.DOCX) ===\n${docxParsed.annotatedText}`,
    });

    // Also attach up to 15 extracted images inline so Gemini can read values inside graphs/tables if needed
    for (const img of docxImages.slice(0, 15)) {
      const buf = await img.blob.arrayBuffer();
      const b64 = await arrayBufferToBase64(buf);
      parts.push({ text: `Hình đính kèm tương ứng token ${img.token}:` });
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: b64,
        },
      });
    }
  }

  // Handle optional separate Answer Key / Grading Guide file
  if (params.answerFile) {
    const ansExt = (params.answerFile.name.split('.').pop() || '').toLowerCase();
    if (ansExt === 'pdf' || params.answerFile.type === 'application/pdf') {
      const ansBuf = await params.answerFile.arrayBuffer();
      const ansB64 = await arrayBufferToBase64(ansBuf);
      parts.push({ text: '=== TÀI LIỆU 2: TỆP ĐÁP ÁN & HƯỚNG DẪN CHẤM ===' });
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: ansB64,
        },
      });
    } else if (ansExt === 'docx') {
      const ansDocx = await parseDocxExamFile(params.answerFile);
      parts.push({
        text: `=== TÀI LIỆU 2: ĐÁP ÁN & HƯỚNG DẪN CHẤM (.DOCX) ===\n${ansDocx.annotatedText}`,
      });
    }
  }

  const instructionPrompt = buildFileExtractionPrompt({
    subjectName: params.subjectName,
    hasSeparateAnswerFile: Boolean(params.answerFile),
    answerStrategy: params.answerStrategy,
    generateExplanations: params.generateExplanations,
    isMainPdf,
    autoCropPdfFigures: params.autoCropPdfFigures,
    docxImageTokens: docxImages.map(i => i.token),
  });
  parts.push({ text: instructionPrompt });

  params.onProgress?.({
    step: 2,
    message: 'Gemini AI đang đọc tài liệu, nhận diện công thức LaTeX, đáp án & tọa độ hình vẽ (2/3)...',
  });

  const model = params.model || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || detail;
    } catch { /* ignore */ }
    throw new Error(`Lỗi gọi Gemini API khi đọc file: ${detail}`);
  }

  const data = await res.json();
  const rawText = (data?.candidates?.[0]?.content?.parts || [])
    .filter((p: any) => typeof p?.text === 'string' && !p?.thought)
    .map((p: any) => p.text)
    .join('\n');

  if (!rawText.trim()) {
    throw new Error('Gemini không trả về dữ liệu câu hỏi từ tệp này. Hãy thử chuyển sang mô hình Gemini 2.5 Pro hoặc kiểm tra tệp.');
  }

  const parsed = parseAiExamJson(rawText);
  const questions: ImportedExamQuestion[] = parsed.questions;

  params.onProgress?.({
    step: 3,
    message: 'Đang cắt ghép hình vẽ minh họa và tạo bản đối chiếu trực quan (3/3)...',
  });

  // Attach DOCX extracted images or crop PDF figures automatically
  const docxImgMap = new Map(docxImages.map(img => [img.token, img]));

  for (const q of questions) {
    // 1. Check DOCX image tokens
    const explicitTok = typeof (q as any).image_token === 'string' ? (q as any).image_token.trim() : '';
    let matchedImg = explicitTok ? docxImgMap.get(explicitTok) : undefined;
    if (!matchedImg) {
      const fullStr = `${q.question || ''} ${q.content || ''}`;
      for (const [tok, imgObj] of docxImgMap.entries()) {
        if (fullStr.includes(tok)) {
          matchedImg = imgObj;
          break;
        }
      }
    }
    if (matchedImg) {
      q._pendingBlob = matchedImg.blob;
      q._previewUrl = matchedImg.previewUrl;
      if (q.question) q.question = q.question.replace(/\[\[DOCX_IMG_\d+\]\]/g, '').trim();
      if (q.content) q.content = q.content.replace(/\[\[DOCX_IMG_\d+\]\]/g, '').trim();
      delete (q as any).image_token;
    }

    // 2. Auto-crop PDF figure if Gemini returned valid image_region
    if (
      isMainPdf &&
      params.autoCropPdfFigures &&
      pdfController &&
      q.image_region &&
      typeof q.image_region.page === 'number' &&
      Array.isArray(q.image_region.box_2d) &&
      q.image_region.box_2d.length === 4
    ) {
      const [ymin, xmin, ymax, xmax] = q.image_region.box_2d.map(Number) as [number, number, number, number];
      if (ymax > ymin + 15 && xmax > xmin + 15) {
        try {
          const cropped = await pdfController.cropNormalizedBox(q.image_region.page, [ymin, xmin, ymax, xmax]);
          q._pendingBlob = cropped.blob;
          q._previewUrl = cropped.previewUrl;
        } catch (cropErr) {
          console.warn('[ai-file-import] Auto-crop failed for question:', cropErr);
        }
      }
    }
  }

  return {
    title: parsed.title,
    questions,
    warnings,
    saWarnings: parsed.saWarnings,
    pdfController,
    docxRawPreview,
  };
}

/**
 * Uploads any pending figure Blobs in `questions` to `/api/admin/exams/upload-image`
 * and serializes clean JSON ready for form submission.
 */
export async function uploadPendingImagesAndSerialize(
  questions: ImportedExamQuestion[],
  baseUrl: string,
  title?: string
): Promise<string> {
  const cleanQuestions = [];

  for (const q of questions) {
    const copy: Record<string, any> = { ...q };
    const blob = copy._pendingBlob as Blob | undefined;
    delete copy._pendingBlob;
    delete copy._previewUrl;
    delete copy.image_region;

    if (blob && !copy.image_url) {
      const fd = new FormData();
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      fd.append('file', new File([blob], `exam-fig-${Date.now()}.${ext}`, { type: blob.type || 'image/png' }));

      const uploadUrl = `${baseUrl || ''}/api/admin/exams/upload-image`;
      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          copy.image_url = data.url;
        }
      }
    }

    cleanQuestions.push(copy);
  }

  return JSON.stringify(
    {
      ...(title ? { title } : {}),
      questions: cleanQuestions,
    },
    null,
    2
  );
}
