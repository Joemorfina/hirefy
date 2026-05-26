export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobText } = req.body;
  if (!jobText) return res.status(400).json({ error: 'jobText is required' });

  const apiKey = process.env.GROQ_API_KEY;

  const prompt = `Você é um assistente especialista em carreira e candidaturas. Analise a vaga abaixo com base no perfil do candidato e retorne uma análise completa em português brasileiro.

PERFIL DO CANDIDATO:
Bruno Brasileiro — Profissional com mais de 10 anos de experiência em atendimento ao cliente, suporte pós-vendas e rotinas administrativas. Experiência em atendimento multicanal (e-mail, chat, WhatsApp e telefone), triagem e acompanhamento de chamados, interface com áreas internas. Inglês B2 certificado (EF SET 51/100). Preferência por vagas remotas, backoffice, suporte via tickets/chat. Evita call center pesado, muitas ligações ou exposição constante em vídeo.

VAGA:
${jobText}

Retorne APENAS um JSON válido, sem markdown, sem texto fora do JSON:

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
  "estrategia": "",
  "veredito": "APLICA AGORA ou APLICA COM RESSALVAS ou NAO E PRA VOCE ou SO APLICA SE SALARIO COMPENSAR",
  "respostas": {
    "apresentacao": "",
    "pretensao": "",
    "porquequer": ""
  }
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Groq API error' });

    const text = data.choices?.[0]?.message?.content || '';
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
