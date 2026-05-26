export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobText, profileText } = req.body;

  if (!jobText) {
    return res.status(400).json({ error: 'jobText is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `Você é um assistente especialista em carreira e candidaturas profissionais. Analise a vaga abaixo com base no perfil do candidato e retorne uma análise completa em português brasileiro.

PERFIL DO CANDIDATO:
${profileText || `Bruno Brasileiro — Profissional com mais de 10 anos de experiência em atendimento ao cliente, suporte pós-vendas e rotinas administrativas. Experiência em atendimento multicanal (e-mail, chat, WhatsApp e telefone), triagem e acompanhamento de chamados, interface com áreas internas. Inglês B2 certificado (EF SET 51/100). Preferência por vagas remotas, backoffice, suporte via tickets/chat.`}

VAGA:
${jobText}

Retorne a análise no seguinte formato JSON (apenas o JSON, sem markdown, sem explicações fora do JSON):

{
  "resumo": "resumo em 1 linha do que é a vaga de verdade",
  "check": {
    "oque": "o que é de verdade",
    "exige": "vai exigir o quê no dia a dia",
    "vale": "vale a pena pelo pacote"
  },
  "levantamento": {
    "cargo": "",
    "empresa": "",
    "local": "",
    "modelo": "",
    "salario": "",
    "horario": "",
    "beneficios": "",
    "atividades": "",
    "keywords": []
  },
  "placar": {
    "tecnica": 0,
    "comportamental": 0,
    "custobeneficio": 0,
    "esforco": 0,
    "estrategico": 0,
    "internacional": 0
  },
  "pros": [],
  "contras": [],
  "riscos": [],
  "estrategia": "texto com estratégia de candidatura",
  "veredito": "APLICA AGORA | APLICA COM RESSALVAS | NÃO É PRA VOCÊ | SÓ APLICA SE SALÁRIO COMPENSAR",
  "respostas": {
    "apresentacao": "",
    "pretensao": "",
    "porquequer": ""
  },
  "email": ""
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Gemini API error' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ raw: clean });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
