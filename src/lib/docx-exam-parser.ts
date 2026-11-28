import JSZip from 'jszip';

export interface DocxExtractedImage {
  token: string; // e.g. "[[DOCX_IMG_1]]"
  filename: string;
  mimeType: string;
  blob: Blob;
  previewUrl: string;
}

export interface DocxParseResult {
  annotatedText: string;
  images: DocxExtractedImage[];
  oleOrWmfCount: number;
  warnings: string[];
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function localNameOf(node: Node): string {
  const el = node as Element;
  if (el.localName) return el.localName;
  return (el.nodeName || '').replace(/^.*:/, '');
}

function getAttrByLocalName(el: Element, local: string): string | null {
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    const aLocal = attr.localName || attr.name.replace(/^.*:/, '');
    if (aLocal === local) return attr.value;
  }
  return null;
}

/**
 * Recursively converts Word Office Math Markup Language (<m:oMath>) nodes into LaTeX.
 */
function ommlNodeToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = localNameOf(el);

  const childrenLatex = (parent: Element): string => {
    let out = '';
    for (let i = 0; i < parent.childNodes.length; i++) {
      out += ommlNodeToLatex(parent.childNodes[i]);
    }
    return out;
  };

  const findChild = (parent: Element, childLocal: string): Element | null => {
    for (let i = 0; i < parent.children.length; i++) {
      if (localNameOf(parent.children[i]) === childLocal) {
        return parent.children[i];
      }
    }
    return null;
  };

  switch (tag) {
    case 'oMathPara':
    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'lim':
      return childrenLatex(el);
    case 'r':
    case 't':
      return el.textContent || '';
    case 'f': {
      const num = findChild(el, 'num');
      const den = findChild(el, 'den');
      return `\\frac{${num ? childrenLatex(num) : ''}}{${den ? childrenLatex(den) : ''}}`;
    }
    case 'rad': {
      const deg = findChild(el, 'deg');
      const base = findChild(el, 'e');
      const degStr = deg ? childrenLatex(deg).trim() : '';
      const baseStr = base ? childrenLatex(base) : '';
      return degStr ? `\\sqrt[${degStr}]{${baseStr}}` : `\\sqrt{${baseStr}}`;
    }
    case 'sSup': {
      const base = findChild(el, 'e');
      const sup = findChild(el, 'sup');
      return `${base ? childrenLatex(base) : ''}^{${sup ? childrenLatex(sup) : ''}}`;
    }
    case 'sSub': {
      const base = findChild(el, 'e');
      const sub = findChild(el, 'sub');
      return `${base ? childrenLatex(base) : ''}_{${sub ? childrenLatex(sub) : ''}}`;
    }
    case 'sSubSup': {
      const base = findChild(el, 'e');
      const sub = findChild(el, 'sub');
      const sup = findChild(el, 'sup');
      return `${base ? childrenLatex(base) : ''}_{${sub ? childrenLatex(sub) : ''}}^{${sup ? childrenLatex(sup) : ''}}`;
    }
    case 'nary': {
      const naryPr = findChild(el, 'naryPr');
      const chrEl = naryPr ? findChild(naryPr, 'chr') : null;
      const chrVal = (chrEl && getAttrByLocalName(chrEl, 'val')) || '∫';
      const op = chrVal === '∑' ? '\\sum' : chrVal === '∏' ? '\\prod' : '\\int';
      const sub = findChild(el, 'sub');
      const sup = findChild(el, 'sup');
      const base = findChild(el, 'e');
      const subPart = sub ? `_{${childrenLatex(sub)}}` : '';
      const supPart = sup ? `^{${childrenLatex(sup)}}` : '';
      return `${op}${subPart}${supPart} ${base ? childrenLatex(base) : ''}`;
    }
    case 'd': {
      const dPr = findChild(el, 'dPr');
      const begChr = (dPr && findChild(dPr, 'begChr') && getAttrByLocalName(findChild(dPr, 'begChr')!, 'val')) || '(';
      const endChr = (dPr && findChild(dPr, 'endChr') && getAttrByLocalName(findChild(dPr, 'endChr')!, 'val')) || ')';
      const parts: string[] = [];
      for (let i = 0; i < el.children.length; i++) {
        if (localNameOf(el.children[i]) === 'e') {
          parts.push(childrenLatex(el.children[i]));
        }
      }
      return `\\left${begChr === '{' ? '\\{' : begChr}${parts.join(', ')}\\right${endChr === '}' ? '\\}' : endChr}`;
    }
    case 'eqArr': {
      const rows: string[] = [];
      for (let i = 0; i < el.children.length; i++) {
        if (localNameOf(el.children[i]) === 'e') {
          rows.push(childrenLatex(el.children[i]));
        }
      }
      return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
    }
    default:
      return childrenLatex(el);
  }
}

function isRedHighlightColor(hexOrName: string | null): boolean {
  if (!hexOrName) return false;
  const v = hexOrName.toLowerCase().trim();
  if (v === 'red' || v === 'darkred') return true;
  if (/^[0-9a-f]{6}$/.test(v)) {
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return r >= 170 && g <= 80 && b <= 80;
  }
  return false;
}

export async function parseDocxExamFile(file: File): Promise<DocxParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Tệp không phải định dạng Word .docx hợp lệ (thiếu word/document.xml). Nếu là file .doc cũ (Word 97-2003), vui lòng lưu sang .docx hoặc .pdf.');
  }

  // Count MathType OLE binaries / WMF / EMF vector objects
  let oleOrWmfCount = 0;
  zip.forEach((relPath) => {
    const lower = relPath.toLowerCase();
    if (
      lower.startsWith('word/embeddings/oleobject') ||
      lower.endsWith('.wmf') ||
      lower.endsWith('.emf')
    ) {
      oleOrWmfCount++;
    }
  });

  // Map relationship rId -> media target path
  const rIdToTarget = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
    const relEls = relsDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < relEls.length; i++) {
      const id = relEls[i].getAttribute('Id');
      const target = relEls[i].getAttribute('Target');
      if (id && target) {
        rIdToTarget.set(id, target.replace(/^\//, ''));
      }
    }
  }

  // Extract web-displayable images on demand by rId
  const images: DocxExtractedImage[] = [];
  const rIdToToken = new Map<string, string>();

  const resolveImageToken = async (rId: string): Promise<string | null> => {
    if (rIdToToken.has(rId)) return rIdToToken.get(rId)!;
    const rawTarget = rIdToTarget.get(rId);
    if (!rawTarget) return null;
    const zipPath = rawTarget.startsWith('word/') ? rawTarget : `word/${rawTarget.replace(/^\.\.\//, '')}`;
    const ext = (zipPath.split('.').pop() || '').toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) return null;

    const imgEntry = zip.file(zipPath);
    if (!imgEntry) return null;
    const blobData = await imgEntry.async('blob');
    const typedBlob = new Blob([blobData], { type: mime });
    const token = `[[DOCX_IMG_${images.length + 1}]]`;
    images.push({
      token,
      filename: zipPath.split('/').pop() || `img-${images.length + 1}.${ext}`,
      mimeType: mime,
      blob: typedBlob,
      previewUrl: URL.createObjectURL(typedBlob),
    });
    rIdToToken.set(rId, token);
    return token;
  };

  const docXml = await docXmlFile.async('string');
  const xmlDoc = new DOMParser().parseFromString(docXml, 'application/xml');
  const bodyEl = xmlDoc.getElementsByTagNameNS('*', 'body')[0] || xmlDoc.documentElement;

  const extractParagraph = async (pEl: Element): Promise<string> => {
    let line = '';
    for (let i = 0; i < pEl.childNodes.length; i++) {
      const child = pEl.childNodes[i];
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const tag = localNameOf(el);

      if (tag === 'oMath' || tag === 'oMathPara') {
        const latex = ommlNodeToLatex(el).trim();
        if (latex) line += ` $${latex}$ `;
        continue;
      }

      if (tag === 'hyperlink') {
        line += await extractParagraph(el);
        continue;
      }

      if (tag === 'r') {
        let isUnderlined = false;
        let isRed = false;
        let runText = '';

        for (let j = 0; j < el.childNodes.length; j++) {
          const rChild = el.childNodes[j];
          if (rChild.nodeType !== Node.ELEMENT_NODE) continue;
          const rEl = rChild as Element;
          const rTag = localNameOf(rEl);

          if (rTag === 'rPr') {
            for (let k = 0; k < rEl.children.length; k++) {
              const prop = rEl.children[k];
              const pName = localNameOf(prop);
              if (pName === 'u') {
                const uVal = getAttrByLocalName(prop, 'val');
                if (!uVal || uVal !== 'none') isUnderlined = true;
              } else if (pName === 'color') {
                if (isRedHighlightColor(getAttrByLocalName(prop, 'val'))) isRed = true;
              } else if (pName === 'highlight') {
                const hl = getAttrByLocalName(prop, 'val');
                if (hl && hl !== 'none') isRed = true;
              }
            }
          } else if (rTag === 't') {
            runText += rEl.textContent || '';
          } else if (rTag === 'tab') {
            runText += '\t';
          } else if (rTag === 'br' || rTag === 'cr') {
            runText += '\n';
          } else if (rTag === 'drawing' || rTag === 'pict' || rTag === 'object') {
            // Find blip r:embed or imagedata r:id
            const blips = rEl.getElementsByTagNameNS('*', 'blip');
            for (let b = 0; b < blips.length; b++) {
              const embedId = getAttrByLocalName(blips[b], 'embed');
              if (embedId) {
                const tok = await resolveImageToken(embedId);
                if (tok) runText += ` ${tok} `;
              }
            }
            const imgDatas = rEl.getElementsByTagNameNS('*', 'imagedata');
            for (let d = 0; d < imgDatas.length; d++) {
              const relId = getAttrByLocalName(imgDatas[d], 'id');
              if (relId) {
                const tok = await resolveImageToken(relId);
                if (tok) runText += ` ${tok} `;
              }
            }
          }
        }

        // Preserve underline/red markers on short option prefixes (e.g. "A.", "B)", "a)", "Đúng")
        const trimmed = runText.trim();
        if (trimmed && trimmed.length <= 25 && (isUnderlined || isRed)) {
          line += `[ĐÁNH_DẤU_ĐÁP_ÁN:${runText}]`;
        } else {
          line += runText;
        }
      }
    }
    return line.trim();
  };

  const blocks: string[] = [];
  for (let i = 0; i < bodyEl.children.length; i++) {
    const node = bodyEl.children[i];
    const tag = localNameOf(node);
    if (tag === 'p') {
      const pText = await extractParagraph(node);
      if (pText) blocks.push(pText);
    } else if (tag === 'tbl') {
      const rows: string[] = [];
      const trList = node.children;
      for (let r = 0; r < trList.length; r++) {
        if (localNameOf(trList[r]) !== 'tr') continue;
        const cells: string[] = [];
        const tcList = trList[r].children;
        for (let c = 0; c < tcList.length; c++) {
          if (localNameOf(tcList[c]) !== 'tc') continue;
          const cellParts: string[] = [];
          for (let p = 0; p < tcList[c].children.length; p++) {
            if (localNameOf(tcList[c].children[p]) === 'p') {
              const txt = await extractParagraph(tcList[c].children[p]);
              if (txt) cellParts.push(txt);
            }
          }
          cells.push(cellParts.join(' '));
        }
        if (cells.some(Boolean)) {
          rows.push(`| ${cells.join(' | ')} |`);
        }
      }
      if (rows.length > 0) {
        blocks.push(rows.join('\n'));
      }
    }
  }

  const warnings: string[] = [];
  if (oleOrWmfCount > 0) {
    warnings.push(
      `Phát hiện ${oleOrWmfCount} đối tượng công thức MathType OLE / ảnh vector WMF trong file Word. Để không bị mất ký hiệu công thức MathType cũ, khuyên bạn mở file Word nhấn Ctrl + P → Lưu dưới dạng PDF rồi tải file PDF lên.`
    );
  }

  return {
    annotatedText: blocks.join('\n'),
    images,
    oleOrWmfCount,
    warnings,
  };
}
