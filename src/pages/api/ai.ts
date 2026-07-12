import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY || '';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { message } = await request.json();
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }

    // 1. If Gemini API Key is configured, fetch response from Google Gemini
    if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('AIzaSy')) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Bạn là trợ lý học tập lớp 12 chuyên nghiệp dành cho học sinh Việt Nam. Hãy trả lời câu hỏi sau một cách dễ hiểu, có ví dụ cụ thể. Sử dụng Markdown để định dạng và sử dụng cú pháp LaTeX (dùng $ cho inline math và $$ cho block math) khi viết các công thức toán, lý, hóa.\n\nCâu hỏi: ${message}`
                }]
              }]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiResponse) {
            return new Response(JSON.stringify({ response: aiResponse }), { status: 200 });
          }
        }
      } catch (geminiError) {
        console.error('Gemini API call failed, falling back to mock responder:', geminiError);
      }
    }

    // 2. Mock Responder Fallback (Intelligent curriculum answer matching)
    const promptLower = message.toLowerCase();
    let reply = '';

    if (promptLower.includes('đạo hàm') || promptLower.includes('toán') || promptLower.includes('tích phân')) {
      reply = `**Đạo hàm và ứng dụng của Đạo hàm trong chương trình Toán 12:**\n\nTrong Toán học lớp 12, Đạo hàm là công cụ cốt lõi để khảo sát sự biến thiên và vẽ đồ thị hàm số.\n\n1. **Công thức đạo hàm hàm số cơ bản:**\n- Hàm đa thức: $(x^n)' = n \\cdot x^{n-1}$\n- Hàm logarit: $(\\ln x)' = \\frac{1}{x}$ và $(\\log_a x)' = \\frac{1}{x \\ln a}$\n- Hàm mũ: $(e^x)' = e^x$ và $(a^x)' = a^x \\ln a$\n\n2. **Ý nghĩa hình học:** Đạo hàm của hàm số $f(x)$ tại điểm $x_0$ là hệ số góc của tiếp tuyến của đồ thị hàm số tại điểm $M(x_0; f(x_0))$:\n$$k = f'(x_0)$$\n\n3. **Cực trị hàm số:** Nếu hàm số $y=f(x)$ đạt cực trị tại điểm $x_0$ và có đạo hàm tại đó thì:\n$$f'(x_0) = 0$$\nBên cạnh đó, điểm cực trị là điểm mà tại đó đạo hàm $f'(x)$ đổi dấu khi đi qua nó.`;
    } else if (promptLower.includes('ohm') || promptLower.includes('vật lý') || promptLower.includes('điện') || promptLower.includes('dao động')) {
      reply = `**Dao động điều hòa và các công thức Vật Lý 12 cần nhớ:**\n\nChương Dao động cơ học là chương mở đầu rất quan trọng trong chương trình Vật lý 12.\n\n1. **Phương trình dao động điều hòa:**\n$$x = A \\cos(\\omega t + \\varphi)$$\n- $x$: Li độ dao động (cm hoặc m).\n- $A$: Biên độ dao động (luôn dương).\n- $\\omega$: Tần số góc (rad/s), $\\omega = \\frac{2\\pi}{T} = 2\\pi f$.\n- $\\varphi$: Pha ban đầu (rad).\n\n2. **Mối liên hệ giữa vận tốc, gia tốc và li độ:**\n- Vận tốc: $v = x' = -\\omega A \\sin(\\omega t + \\varphi)$\n- Gia tốc: $a = v' = x'' = -\\omega^2 x$\n- Hệ thức độc lập thời gian:\n$$A^2 = x^2 + \\frac{v^2}{\\omega^2}$$\n\n3. **Định luật Ohm cho toàn mạch (Vật lý 11 tái quát ở lớp 12):**\n$$I = \\frac{\\mathcal{E}}{R_N + r}$$\nTrong đó $\\mathcal{E}$ là suất điện động của nguồn, $R_N$ là điện trở mạch ngoài, và $r$ là điện trở trong của nguồn.`;
    } else if (promptLower.includes('este') || promptLower.includes('hóa') || promptLower.includes('phản ứng') || promptLower.includes('axit')) {
      reply = `**Chuyên đề Este - Lipit (Hóa học 12):**\n\nEste là hợp chất hữu cơ quan trọng, thường có mùi thơm dễ chịu của hoa quả chín.\n\n1. **Khái niệm:** Khi thay thế nhóm $-OH$ ở nhóm carboxyl của axit cacboxylic bằng nhóm $-OR'$ ta thu được este. Công thức chung của este no, đơn chức, mạch hở:\n$$C_nH_{2n}O_2 \\quad (n \\ge 2)$$\n\n2. **Tính chất hóa học tiêu biểu (Phản ứng thủy phân):**\n- *Trong môi trường axit (thuận nghịch):*\n$$R-COO-R' + H_2O \\overset{H^+, t^o}{\\rightleftharpoons} R-COOH + R'-OH$$\n- *Trong môi trường kiềm (phản ứng xà phòng hóa - một chiều):*\n$$R-COO-R' + NaOH \\xrightarrow{t^o} R-COONa + R'-OH$$\n\n3. **Phản ứng điều chế este (Este hóa):** Cho axit cacboxylic tác dụng với ancol có xúc tác axit $H_2SO_4$ đặc, nóng:\n$$R-COOH + R'-OH \\overset{H_2SO_4 \\text{ đặc}, t^o}{\\rightleftharpoons} R-COO-R' + H_2O$$`;
    } else if (promptLower.includes('gen') || promptLower.includes('sinh') || promptLower.includes('di truyền') || promptLower.includes('dna')) {
      reply = `**Cơ chế di truyền và Biến dị (Sinh học 12):**\n\nĐây là phần kiến thức nền tảng trong Sinh học lớp 12.\n\n1. **Quá trình nhân đôi DNA (Tái bản):**\n- Diễn ra trong nhân tế bào, ở pha S của chu kỳ tế bào.\n- Nguyên tắc: *Bán bảo toàn* (giữ lại một nửa sợi cũ) và *Bổ sung* ($A$ liên kết với $T$, $G$ liên kết với $X$).\n\n2. **Phiên mã và Dịch mã:**\n- *Phiên mã:* Tổng hợp phân tử RNA từ mạch mã gốc của gene.\n- *Dịch mã:* Tổng hợp chuỗi polypeptide (protein) từ khuôn mẫu mRNA.\n\n3. **Cơ chế liên kết bổ sung:**\nSố lượng nucleotide của DNA được xác định theo nguyên tắc bổ sung:\n$$A = T, \\quad G = X$$\n$$N = 2A + 2G = 2T + 2X$$`;
    } else if (promptLower.includes('relative') || promptLower.includes('tiếng anh') || promptLower.includes('grammar') || promptLower.includes('mệnh đề')) {
      reply = `**Mệnh đề quan hệ (Relative Clauses) trong Tiếng Anh 12:**\n\nMệnh đề quan hệ được dùng để bổ nghĩa cho danh từ đứng trước nó.\n\n1. **Đại từ quan hệ làm Chủ ngữ/Tân ngữ:**\n- **Who**: Chỉ người (làm chủ ngữ/tân ngữ).\n- **Whom**: Chỉ người (chỉ làm tân ngữ).\n- **Which**: Chỉ vật (làm chủ ngữ/tân ngữ).\n- **That**: Dùng thay thế cho *who, whom, which* trong mệnh đề xác định (Defining Clause).\n\n2. **Đại từ quan hệ chỉ Sở hữu:**\n- **Whose**: Đứng giữa hai danh từ để chỉ mối quan hệ sở hữu ($N_1 + \\text{whose} + N_2$).\n\n3. **Trạng từ quan hệ (Relative Adverbs):**\n- **When**: Chỉ thời gian (= *at/on/in which*).\n- **Where**: Chỉ nơi chốn (= *at/in/to which*).\n- **Why**: Chỉ lý do (= *for which*).`;
    } else {
      reply = `Chào cậu! Mình là Trợ lý Học tập AI lớp 12 đây.\n\nHãy đặt các câu hỏi cụ thể hơn về các môn học Toán, Lý, Hóa, Sinh, Anh để mình có thể giải thích chi tiết nhất kèm các công thức toán học dưới dạng LaTeX nhé.\n\nVí dụ cậu có thể gõ:\n- *"Công thức tính tích phân từng phần"* \n- *"Mệnh đề quan hệ xác định"* \n- *"Tính chất hóa học của este"*`;
    }

    return new Response(JSON.stringify({ response: reply }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
